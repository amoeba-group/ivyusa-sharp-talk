import { assertPublicUrl, SsrfBlockedError } from '../../tenant/ecommerce-probe.util';

/**
 * Server-side fetch of a tenant-supplied website (PLN-261026 S1).
 *
 * The URL comes from the operator, so this is an SSRF surface: redirects are
 * followed by hand and EVERY hop is re-checked against the public-address
 * allowlist — `redirect: 'follow'` would let a public page bounce the request
 * to 169.254.169.254 unchecked.
 */

export const SITE_USER_AGENT =
  'Mozilla/5.0 (compatible; SharpTalkBot/1.0; +https://sharptalk.amoeba.site)';

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
/** Shopify policy pages measured 510KB; anything past this is not a policy page. */
const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;
const MAX_RETRY_AFTER_MS = 5_000;

export type SiteFetchFailure = 'blocked' | 'unreachable' | 'http' | 'not_html';

export class SiteFetchError extends Error {
  constructor(
    message: string,
    readonly kind: SiteFetchFailure,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface FetchedPage {
  /** Final URL after redirects — the base for resolving relative links. */
  url: string;
  status: number;
  contentType: string;
  body: string;
  /** True when the body was cut at maxBytes. */
  truncated: boolean;
}

export interface SafeFetchOptions {
  /** html (default) accepts text/html + xhtml; xml accepts xml; text accepts text/plain. */
  accept?: 'html' | 'xml' | 'text';
  timeoutMs?: number;
  maxBytes?: number;
}

export type SiteFetcher = (url: string, opts?: SafeFetchOptions) => Promise<FetchedPage>;

const ACCEPT_HEADER: Record<NonNullable<SafeFetchOptions['accept']>, string> = {
  html: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  xml: 'application/xml,text/xml;q=0.9,*/*;q=0.5',
  text: 'text/plain,*/*;q=0.5',
};

function typeAllowed(accept: NonNullable<SafeFetchOptions['accept']>, contentType: string): boolean {
  const ct = contentType.toLowerCase();
  // A server that omits the header gets the benefit of the doubt; the
  // extractor's thin-content check catches a binary that slipped through.
  if (!ct) return true;
  if (accept === 'html') return ct.includes('text/html') || ct.includes('xhtml');
  if (accept === 'xml') return ct.includes('xml') || ct.includes('text/plain');
  return ct.startsWith('text/');
}

export const safeFetch: SiteFetcher = async (rawUrl, opts = {}) => {
  const accept = opts.accept ?? 'html';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  let url = rawUrl;
  let retried = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; ) {
    try {
      await assertPublicUrl(url);
    } catch (e) {
      if (e instanceof SsrfBlockedError) throw new SiteFetchError(e.message, 'blocked');
      throw new SiteFetchError((e as Error).message, 'unreachable');
    }

    let res: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': SITE_USER_AGENT, Accept: ACCEPT_HEADER[accept] },
      });
    } catch (e) {
      clearTimeout(timer);
      throw new SiteFetchError((e as Error).message || 'fetch failed', 'unreachable');
    }

    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timer);
      const location = res.headers.get('location');
      if (!location) throw new SiteFetchError('redirect without location', 'http', res.status);
      url = new URL(location, url).toString();
      hop += 1;
      continue;
    }

    // Storefront bot shields answer 429 first (ivyusa.com, REQ §4) — one
    // polite retry honoring a short Retry-After, never a loop.
    if (res.status === 429 && !retried) {
      clearTimeout(timer);
      retried = true;
      const after = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(after) && after > 0 ? Math.min(after * 1000, MAX_RETRY_AFTER_MS) : 1500;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    try {
      if (!res.ok) throw new SiteFetchError(`HTTP ${res.status}`, 'http', res.status);
      const contentType = res.headers.get('content-type') ?? '';
      if (!typeAllowed(accept, contentType)) {
        throw new SiteFetchError(`unexpected content-type ${contentType}`, 'not_html', res.status);
      }
      const { bytes, truncated } = await readCapped(res, maxBytes);
      return {
        url,
        status: res.status,
        contentType,
        body: decodeBody(bytes, contentType),
        truncated,
      };
    } catch (e) {
      if (e instanceof SiteFetchError) throw e;
      throw new SiteFetchError((e as Error).message || 'read failed', 'unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
  throw new SiteFetchError('too many redirects', 'http');
};

async function readCapped(res: Response, maxBytes: number): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!res.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.byteLength;
    if (total >= maxBytes) {
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const p of parts) {
    const take = Math.min(p.byteLength, out.byteLength - offset);
    out.set(p.subarray(0, take), offset);
    offset += take;
    if (offset >= out.byteLength) break;
  }
  return { bytes: out, truncated };
}

/**
 * Header charset first, then the page's own <meta charset> — Korean Cafe24
 * shops still serve EUC-KR, which read as UTF-8 is unrecoverable mojibake.
 */
export function decodeBody(bytes: Uint8Array, contentType: string): string {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? undefined;
  const charset = (fromHeader ?? fromMeta ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
