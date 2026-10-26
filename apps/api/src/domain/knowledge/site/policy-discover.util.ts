import { decodeEntities } from './html-text.util';
import { ALLOW_ALL, parseRobots, RobotsPolicy } from './robots.util';
import { SiteFetcher } from './safe-fetch.util';

/**
 * Policy-page discovery (PLN-261026 S1): home-page links, sitemap.xml and
 * platform well-known paths, scored by a six-language keyword dictionary.
 * Only the operator's own site is considered — a link to a payment provider's
 * privacy policy is not this store's policy.
 */

export const POLICY_KIND = {
  REFUND: 'refund',
  SHIPPING: 'shipping',
  PRIVACY: 'privacy',
  TERMS: 'terms',
  PAYMENT: 'payment',
  FAQ: 'faq',
  OTHER: 'other',
} as const;
export type PolicyKind = (typeof POLICY_KIND)[keyof typeof POLICY_KIND];

export type CandidateSource = 'link' | 'sitemap' | 'known';

export interface PolicyCandidate {
  url: string;
  title: string;
  kind: PolicyKind;
  source: CandidateSource;
  robotsBlocked: boolean;
  /** A PDF or other document file — the console points to file import instead. */
  fileLink: boolean;
  score: number;
}

export interface DiscoverResult {
  /** The site as resolved (after redirects), e.g. https://go2joy.vn/vi-vn. */
  site: string;
  platform: 'shopify' | 'cafe24' | null;
  candidates: PolicyCandidate[];
  /** Home page HTML, kept for boilerplate learning by the caller. */
  homeHtml: string;
}

export const MAX_CANDIDATES = 20;
const MAX_SITEMAP_URLS = 500;

/**
 * Keyword → kind, checked against the decoded path and the link text. Order
 * matters: the first matching kind labels the page ("return-and-refund").
 */
const KIND_KEYWORDS: Array<{ kind: PolicyKind; words: string[] }> = [
  {
    kind: POLICY_KIND.REFUND,
    words: [
      'refund', 'return', 'exchange', 'cancel',
      '환불', '반품', '교환', '취소',
      'hoàn tiền', 'hoan-tien', 'đổi trả', 'doi-tra', 'hủy', 'huy-',
      '返品', '返金', '交換', 'キャンセル',
      '退货', '退款', '换货', '取消',
      'reembolso', 'devolución', 'devolucion', 'cambio', 'cancelación',
    ],
  },
  {
    kind: POLICY_KIND.SHIPPING,
    words: [
      'shipping', 'delivery',
      '배송', '배달',
      'vận chuyển', 'van-chuyen', 'giao hàng', 'giao-hang',
      '配送', '発送', '送料',
      '运费', '发货', '配送',
      'envío', 'envio', 'entrega',
    ],
  },
  {
    kind: POLICY_KIND.PRIVACY,
    words: [
      'privacy', 'cookie', 'personal data',
      '개인정보',
      'bảo mật', 'bao-mat', 'quyền riêng tư',
      'プライバシー', '個人情報',
      '隐私', '个人信息',
      'privacidad', 'datos personales',
    ],
  },
  {
    kind: POLICY_KIND.TERMS,
    words: [
      'terms', 'conditions', 'agreement', 'legal', 'regulation', 'complaint', 'dispute',
      '약관', '이용안내', '이용 안내', '운영정책', '분쟁',
      'điều khoản', 'dieu-khoan', 'thỏa thuận', 'thoa-thuan', 'quy chế', 'quy-che', 'quy định', 'khiếu nại', 'khieu-nai', 'tranh chấp',
      '利用規約', '規約', '特定商取引',
      '条款', '协议', '服务条款',
      'términos', 'terminos', 'condiciones', 'aviso legal',
    ],
  },
  {
    kind: POLICY_KIND.PAYMENT,
    words: ['payment', '결제', 'thanh toán', 'thanh-toan', '支払', '支付', 'pago'],
  },
  {
    kind: POLICY_KIND.FAQ,
    words: ['faq', 'help', 'support', '자주 묻는', '고객센터', 'câu hỏi', 'hỗ trợ', 'よくある', 'ヘルプ', '常见问题', '帮助', 'preguntas', 'ayuda'],
  },
];

/** Generic "policy" words: a page named only "Policy" (go2joy /vi-vn/policy) still counts. */
const POLICY_WORDS = ['policy', 'policies', '정책', 'chính sách', 'chinh-sach', 'ポリシー', '方針', '政策', 'política', 'politica'];

/** Paths that are never a policy page even when a keyword hits ("return-to-top", "blog/shipping-news"). */
const EXCLUDE = /\/(blog|blogs|news|career|careers|jobs|tuyen-dung|products?|collections?|cart|checkout|account|login|signin|search|tag|tags)(\/|$)|\.(js|css|png|jpe?g|gif|webp|svg|ico|zip|mp4)(\?|$)/i;

const FILE_LINK = /\.(pdf|docx?|hwp)(\?|$)/i;

const SHOPIFY_KNOWN = [
  ['/policies/refund-policy', 'Refund policy'],
  ['/policies/shipping-policy', 'Shipping policy'],
  ['/policies/privacy-policy', 'Privacy policy'],
  ['/policies/terms-of-service', 'Terms of service'],
] as const;
const CAFE24_KNOWN = [
  ['/member/agreement.html', '이용약관'],
  ['/member/privacy.html', '개인정보처리방침'],
  ['/shopinfo/guide.html', '이용안내'],
] as const;

/** Same site = same host ignoring a leading www. (subdomains are other sites). */
export function sameSite(a: string, b: string): boolean {
  try {
    const host = (u: string) => new URL(u).hostname.toLowerCase().replace(/^www\./, '');
    return host(a) === host(b);
  } catch {
    return false;
  }
}

/** Drop fragments, tracking params and a trailing slash so one page is one candidate. */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|ref$)/i.test(key)) u.searchParams.delete(key);
  }
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  // `?` left with no params is the same page (go2joy links /policy?).
  return u.toString().replace(/\?$/, '');
}

export function classify(url: string, text: string): { kind: PolicyKind; score: number } | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    return null;
  }
  if (EXCLUDE.test(path)) return null;
  const label = text.toLowerCase();
  const hay = `${path} ${label}`;

  let score = 0;
  let kind: PolicyKind | null = null;
  for (const entry of KIND_KEYWORDS) {
    const inPath = entry.words.some((w) => path.includes(w));
    const inText = entry.words.some((w) => label.includes(w));
    if (inPath || inText) {
      kind ??= entry.kind;
      score += (inPath ? 2 : 0) + (inText ? 2 : 0);
    }
  }
  const generic = POLICY_WORDS.some((w) => hay.includes(w));
  if (generic) score += 2;
  if (!kind && !generic) return null;
  // A FAQ/help hit alone is weaker than an actual policy word.
  if (kind === POLICY_KIND.FAQ && !generic) score -= 1;
  return { kind: kind ?? POLICY_KIND.OTHER, score };
}

export function extractLinks(html: string, baseUrl: string): Array<{ url: string; text: string }> {
  const out: Array<{ url: string; text: string }> = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const raw = href?.[1] ?? href?.[2] ?? href?.[3];
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw.trim())) continue;
    let url: string;
    try {
      url = new URL(decodeEntities(raw.trim()), baseUrl).toString();
    } catch {
      continue;
    }
    if (!/^https?:/i.test(url)) continue;
    const text = decodeEntities(m[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    out.push({ url, text });
  }
  return out;
}

export function parseSitemap(xml: string): { urls: string[]; childMaps: string[] } {
  const locs = (tag: string) =>
    [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<loc>\\s*([^<\\s]+)\\s*<\\/loc>`, 'gi'))].map((m) =>
      decodeEntities(m[1]),
    );
  return { urls: locs('url'), childMaps: locs('sitemap') };
}

function detectPlatform(html: string): DiscoverResult['platform'] {
  if (/cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(html)) return 'shopify';
  if (/cafe24|ec-base-|\/ind-script\//i.test(html)) return 'cafe24';
  return null;
}

function pathOf(url: string): string {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
}

function titleFromPath(url: string): string {
  const last = decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean).pop() ?? url;
  return last.replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_]+/g, ' ').trim() || url;
}

/**
 * Find policy-page candidates for `siteUrl`. Every source is best-effort: a
 * storefront shield can refuse the home page alone (ivyusa.com: `/` 429 while
 * sitemap and /policies/* answer 200), so a failed home page only drops the
 * link source — it rethrows only when nothing at all was found.
 */
export async function discoverPolicyPages(siteUrl: string, fetcher: SiteFetcher): Promise<DiscoverResult> {
  let homeError: unknown = null;
  const home = await fetcher(siteUrl, { accept: 'html' }).catch((e: unknown) => {
    homeError = e;
    return null;
  });
  const site = home?.url ?? siteUrl;
  const origin = new URL(site).origin;

  const robotsText = await fetcher(`${origin}/robots.txt`, { accept: 'text', timeoutMs: 5000, maxBytes: 256 * 1024 })
    .then((r) => r.body)
    .catch(() => '');
  const robots: RobotsPolicy = robotsText ? parseRobots(robotsText) : ALLOW_ALL;
  // Shopify's generated robots.txt has a recognizable shape — the platform is
  // still known when the home page was refused.
  const shopifyRobots =
    /Disallow:\s*\/checkouts?\//i.test(robotsText) && /Disallow:\s*\/policies\//i.test(robotsText);
  const platform = (home ? detectPlatform(home.body) : null) ?? (shopifyRobots ? 'shopify' : null);

  const found = new Map<string, PolicyCandidate>();
  const consider = (rawUrl: string, text: string, source: CandidateSource, bonus = 0) => {
    if (!sameSite(rawUrl, site)) return;
    let url: string;
    try {
      url = normalizeUrl(rawUrl);
    } catch {
      return;
    }
    if (url === normalizeUrl(site)) return;
    const hit = classify(url, text);
    if (!hit) return;
    const prev = found.get(url);
    const score = hit.score + bonus;
    if (prev) {
      // Keep the best label (link text beats a sitemap's bare URL).
      if (!prev.title || (source === 'link' && prev.source !== 'link' && text)) prev.title = text || prev.title;
      prev.score = Math.max(prev.score, score);
      return;
    }
    found.set(url, {
      url,
      title: text || titleFromPath(url),
      kind: hit.kind,
      source,
      robotsBlocked: !robots.isAllowed(pathOf(url)),
      fileLink: FILE_LINK.test(new URL(url).pathname),
      score,
    });
  };

  if (home) for (const link of extractLinks(home.body, site)) consider(link.url, link.text, 'link', 1);

  const sitemapUrls = await readSitemap(origin, fetcher);
  for (const u of sitemapUrls) consider(u, '', 'sitemap');

  // Platform unknown (no home page, no telltale robots.txt) → probe both sets.
  const known: ReadonlyArray<readonly [string, string]> =
    platform === 'shopify'
      ? SHOPIFY_KNOWN
      : platform === 'cafe24'
        ? CAFE24_KNOWN
        : home
          ? []
          : [...SHOPIFY_KNOWN, ...CAFE24_KNOWN];
  const missingKnown = known.filter(([path]) => !found.has(normalizeUrl(`${origin}${path}`)));
  await Promise.all(
    missingKnown.map(async ([path, label]) => {
      if (!robots.isAllowed(path)) {
        // Never fetch a disallowed path — not even to confirm it exists. On a
        // known platform the page exists by convention, so it is listed (as
        // blocked) for the operator to see why it cannot be read; Shopify's
        // default robots.txt disallows /policies/ for every bot.
        if (platform) consider(`${origin}${path}`, label, 'known');
        return;
      }
      try {
        const res = await fetcher(`${origin}${path}`, { accept: 'html', timeoutMs: 5000, maxBytes: 64 * 1024 });
        // A redirect home means the store has no such page.
        if (sameSite(res.url, site) && new URL(res.url).pathname !== '/' && normalizeUrl(res.url) !== normalizeUrl(site)) {
          consider(`${origin}${path}`, label, 'known');
        }
      } catch {
        /* absent page — not a candidate */
      }
    }),
  );

  const candidates = rankCandidates([...found.values()]);
  if (!home && !candidates.length) throw homeError;
  return { site, platform, candidates, homeHtml: home?.body ?? '' };
}

/** Blocked candidates are shown (so the operator learns why) but never crowd out readable ones. */
const MAX_BLOCKED_SHOWN = 5;

/**
 * Best first, but one kind cannot fill the list: ivyusa's sitemap holds a
 * dozen per-brand privacy pages that would otherwise push out its single
 * returns page. Round-robin across kinds in score order.
 */
export function rankCandidates(all: PolicyCandidate[]): PolicyCandidate[] {
  const byScore = (a: PolicyCandidate, b: PolicyCandidate) => b.score - a.score || a.url.length - b.url.length;
  const allowed = all.filter((c) => !c.robotsBlocked).sort(byScore);
  const blocked = all.filter((c) => c.robotsBlocked).sort(byScore);

  const queues = new Map<PolicyKind, PolicyCandidate[]>();
  for (const c of allowed) queues.set(c.kind, [...(queues.get(c.kind) ?? []), c]);
  const interleaved: PolicyCandidate[] = [];
  while (interleaved.length < allowed.length) {
    for (const q of queues.values()) {
      const next = q.shift();
      if (next) interleaved.push(next);
    }
  }
  const blockedShown = blocked.slice(0, Math.min(MAX_BLOCKED_SHOWN, MAX_CANDIDATES));
  return [...interleaved.slice(0, MAX_CANDIDATES - blockedShown.length), ...blockedShown];
}

async function readSitemap(origin: string, fetcher: SiteFetcher): Promise<string[]> {
  try {
    const root = parseSitemap((await fetcher(`${origin}/sitemap.xml`, { accept: 'xml', timeoutMs: 8000 })).body);
    const urls = [...root.urls];
    // One level of sitemap index. Product/collection/blog maps are never
    // fetched: their URLs are excluded anyway, and every extra request counts
    // against storefront rate limits (Shopify/Cloudflare 429s a burst).
    const children = root.childMaps
      .filter((u) => !/product|collection|blog|article|image|video/i.test(u))
      .slice(0, 5);
    for (const child of children) {
      if (urls.length >= MAX_SITEMAP_URLS) break;
      try {
        urls.push(...parseSitemap((await fetcher(child, { accept: 'xml', timeoutMs: 8000 })).body).urls);
      } catch {
        /* skip a broken child map */
      }
    }
    return urls.slice(0, MAX_SITEMAP_URLS);
  } catch {
    return [];
  }
}
