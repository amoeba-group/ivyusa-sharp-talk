/**
 * HTML → readable policy text (PLN-261026 S1), dependency-free.
 *
 * Storefront pages are mostly chrome: ivyusa's refund page is 510KB of which
 * the policy is a few KB, the rest mega-menu (REQ §4). So the main-content
 * region is located first and nav/header/footer are cut before any text is
 * taken. Headings, lists and tables survive as markdown — the board stores
 * markdown and the LLM uses headings as article boundaries.
 */

/** Below this the page is treated as "rendered in the browser" (go2joy: chrome only). */
export const THIN_TEXT_CHARS = 400;
/** A region where most of the text is link labels is a menu, not a policy. */
const THIN_LINK_RATIO = 0.5;
/** A content region must hold at least this much to beat the next candidate. */
const REGION_MIN_CHARS = 200;
/** Per-page cap: ~4 LLM chunks. Longer terms are cut, and the job says so. */
export const MAX_PAGE_CHARS = 48_000;

export interface PageText {
  title: string;
  /**
   * The page's own name: first <h1> of the body, else its first short line.
   * Many sites reuse one <title> on every page (go2joy: the brand slogan),
   * so this is what tells "Refund policy" from "Terms".
   */
  heading: string;
  text: string;
  /** True when the page has no readable body (SPA shell, menu-only page). */
  thin: boolean;
  truncated: boolean;
}

/** Open-tag patterns for the main content region, most specific first. */
const REGION_OPENERS: RegExp[] = [
  /<(\w+)\b[^>]*\bclass=["'][^"']*\bshopify-policy__body\b[^"']*["'][^>]*>/i,
  /<(main)\b[^>]*>/i,
  /<(article)\b[^>]*>/i,
  /<(\w+)\b[^>]*\brole=["']main["'][^>]*>/i,
  /<(\w+)\b[^>]*\bid=["'](?:contents?|main-?content|MainContent)["'][^>]*>/i,
];

const DROP_RAW = ['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas'];
const DROP_BALANCED = ['nav', 'header', 'footer', 'aside', 'form', 'button', 'select'];
const BLOCK_TAGS =
  'p|div|section|ul|ol|tr|dl|dt|dd|blockquote|pre|address|figure|figcaption|details|summary|main|article|table|tbody|thead|tfoot';

/**
 * Lines of the site's home page — the template every page shares. Sites that
 * do not mark chrome with <nav>/<footer> (go2joy: plain <div>s holding the
 * company address) are told apart from policy text by this, not by line
 * length: Korean policy sentences are as short as English menu labels.
 */
export function boilerplateLines(homeHtml: string): Set<string> {
  const cleaned = dropRaw(homeHtml.replace(/<!--[\s\S]*?-->/g, ''));
  const body = sliceRegion(cleaned, /<(body)\b[^>]*>/i) ?? cleaned;
  return new Set(
    regionToText(body, false)
      .text.split('\n')
      .map(lineKey)
      .filter((l) => l.length > 0),
  );
}

/** Compare lines without markdown markers — a footer link and a heading can share words. */
function lineKey(line: string): string {
  return line.replace(/^(?:#+|-)\s+/, '').trim();
}

export function extractPageText(html: string, boilerplate?: Set<string>): PageText {
  const title = decodeEntities(stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
  const cleaned = dropRaw(html.replace(/<!--[\s\S]*?-->/g, ''));

  let chosen: { text: string; linkRatio: number } | null = null;
  for (const opener of REGION_OPENERS) {
    const region = sliceRegion(cleaned, opener);
    if (!region) continue;
    const converted = regionToText(region);
    if (converted.text.length >= REGION_MIN_CHARS) {
      chosen = converted;
      break;
    }
  }
  if (!chosen) {
    const body = sliceRegion(cleaned, /<(body)\b[^>]*>/i) ?? cleaned;
    chosen = regionToText(body);
  }

  let full = chosen.text;
  if (boilerplate?.size) {
    full = full
      .split('\n')
      .filter((l) => !boilerplate.has(lineKey(l)))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const truncated = full.length > MAX_PAGE_CHARS;
  const text = truncated ? full.slice(0, MAX_PAGE_CHARS) : full;
  const thin = text.length < THIN_TEXT_CHARS || chosen.linkRatio > THIN_LINK_RATIO;
  return { title, heading: pageHeading(text), text, thin, truncated };
}

const MAX_HEADING_CHARS = 120;

function pageHeading(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim());
  const line = lines.find((l) => l.startsWith('# ')) ?? lines[0] ?? '';
  const plain = line.replace(/^#+\s*/, '').trim();
  return plain.length <= MAX_HEADING_CHARS ? plain : '';
}

function dropRaw(html: string): string {
  let out = html;
  for (const tag of DROP_RAW) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), ' ');
  }
  return out;
}

/** The element whose open tag matches `opener`, through its balanced close tag. */
export function sliceRegion(html: string, opener: RegExp): string | null {
  const m = opener.exec(html);
  if (!m || m.index === undefined) return null;
  const tag = m[1].toLowerCase();
  const end = elementEnd(html, m.index, tag);
  return html.slice(m.index, end);
}

/** Index just past the element that opens at `start`, balancing same-name tags. */
function elementEnd(html: string, start: number, tag: string): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) {
      depth -= 1;
      if (depth <= 0) return re.lastIndex;
    } else if (!m[0].endsWith('/>')) {
      depth += 1;
    }
  }
  return html.length;
}

function dropBalanced(html: string, tag: string): string {
  const opener = new RegExp(`<${tag}\\b[^>]*>`, 'i');
  let out = html;
  // Bounded: each pass removes one element, so a page cannot loop forever.
  for (let guard = 0; guard < 500; guard += 1) {
    const m = opener.exec(out);
    if (!m) break;
    const end = elementEnd(out, m.index, tag);
    out = `${out.slice(0, m.index)}\n${out.slice(end)}`;
  }
  return out;
}

function regionToText(region: string, dropChrome = true): { text: string; linkRatio: number } {
  let html = region;
  // The home page keeps its chrome: that chrome IS the boilerplate to learn.
  if (dropChrome) for (const tag of DROP_BALANCED) html = dropBalanced(html, tag);

  const linkChars = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => normalizeInline(m[1]).length)
    .reduce((a, b) => a + b, 0);

  // Adjacent inline elements (`<span>Hotline:</span><a>1900…</a>`) would fuse
  // into one word once tags are stripped.
  html = html.replace(/(<\/(?:span|a|label|strong|b|em|i|small)>)(?=<)/gi, '$1 ');
  html = html.replace(/<table\b[\s\S]*?<\/table>/gi, (t) => `\n\n${tableToMarkdown(t)}\n\n`);
  html = html.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi,
    (_m, level: string, inner: string) => `\n\n${'#'.repeat(Number(level))} ${normalizeInline(inner)}\n\n`,
  );
  html = html
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, 'gi'), '\n');

  const text = decodeEntities(stripTags(html))
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    // A bullet left with nothing after it is an empty <li> wrapper.
    .filter((l, i, all) => l !== '-' && !(l === '' && all[i - 1] === ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const linkRatio = text.length ? linkChars / text.length : 1;
  return { text, linkRatio };
}

function tableToMarkdown(table: string): string {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) =>
      normalizeInline(c[1]).replace(/\|/g, '\\|'),
    ),
  );
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (!width) return normalizeInline(table);
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
  const [head, ...body] = rows.map(pad);
  return [
    `| ${head.join(' | ')} |`,
    `| ${Array(width).fill('---').join(' | ')} |`,
    ...body.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function normalizeInline(html: string): string {
  return decodeEntities(stripTags(html.replace(/<br\s*\/?>/gi, ' ')))
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  yen: '¥',
  pound: '£',
  times: '×',
  deg: '°',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1].toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? m;
  });
}
