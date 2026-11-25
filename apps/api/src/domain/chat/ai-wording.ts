/**
 * Fact guard for AI-written wording (IVY PRD v1 C-02, PLN-261125-IVY-PRD-v1-Phase5).
 *
 * The AI may phrase a scripted answer, or a line next to an order card, in its
 * own words. The facts must not move: PRD slide 20 says "AI polishes the
 * wording, but steps and numbers follow the scenario". A rewrite is only used
 * when this guard finds every fact of the source in it and nothing new;
 * otherwise the caller keeps the source text. It is deliberately strict:
 * a refused rewrite costs a less natural sentence, a wrong one costs a
 * shopper the wrong return window.
 */

const URL_RE = /https?:\/\/[^\s)\]>"'<]+/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// "6.95", "1,234", "10", "2026" — a run of digits with inner separators.
const NUMBER_RE = /\d+(?:[.,]\d+)*/g;
// "1. text" / "2) text" at the start of a line — the widget's step cards (T12).
const STEP_RE = /^\s*(\d{1,2})[.)]\s+\S/gm;
// Markdown link targets: the widget renders `[text](url)` as a link.
const MD_LINK_RE = /\]\((https?:\/\/[^)\s]+)\)/g;

export interface WordingFacts {
  urls: string[];
  emails: string[];
  numbers: string[];
  steps: string[];
  links: string[];
  bold: number;
}

const uniq = (xs: string[]) => [...new Set(xs)];

/**
 * One spelling per number. Separators differ by language ("1,000" / "1.000",
 * "6.95" / "6,95"), and an amount loses its cents in prose: "$42.00" is said
 * "$42", "$42.50" stays "$42.50". So a two-digit fraction is read as money and
 * its zeros dropped; anything else is compared digit by digit.
 */
function normalizeNumber(n: string): string {
  const money = /^(\d+)[.,](\d{2})$/.exec(n);
  if (money) return String(Number(`${money[1]}.${money[2]}`));
  return n.replace(/[.,]/g, '.');
}

/** Trailing punctuation a URL picks up from the sentence around it. */
const trimUrl = (u: string) => u.replace(/[.,;:!?]+$/, '');

export function wordingFacts(text: string): WordingFacts {
  const urls = uniq((text.match(URL_RE) ?? []).map(trimUrl));
  const emails = uniq((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()));
  // Numbers inside a URL or an address are part of that fact, not prose.
  const prose = text.replace(URL_RE, ' ').replace(EMAIL_RE, ' ');
  const numbers = uniq((prose.match(NUMBER_RE) ?? []).map(normalizeNumber));
  const steps = [...text.matchAll(STEP_RE)].map((m) => m[1]);
  const links = uniq([...text.matchAll(MD_LINK_RE)].map((m) => trimUrl(m[1])));
  const bold = (text.match(/\*\*/g) ?? []).length;
  return { urls, emails, numbers, steps, links, bold };
}

export interface GuardResult {
  ok: boolean;
  /** Why a rewrite was refused — logged, never shown. */
  reason?: string;
}

export interface GuardOptions {
  /** Shortest / longest rewrite allowed, as a share of the source's length. */
  minRatio?: number;
  maxRatio?: number;
  /** Hard cap on the rewrite's length, in characters. */
  maxChars?: number;
}

/**
 * Does `rewrite` keep every fact of `source` and add none?
 *
 * - every URL, email and markdown link target of the source, and no new ones;
 * - the same set of numbers: none dropped ("10 days" must stay 10), none added
 *   (an invented price or date is the failure this exists for);
 * - the same numbered step lines in the same order, so the widget can still
 *   draw its step cards, and the same count of `**` bold markers;
 * - a length in proportion: a two-line answer is not a page.
 */
export function keepsFacts(source: string, rewrite: string, opts: GuardOptions = {}): GuardResult {
  const out = rewrite.trim();
  if (!out) return { ok: false, reason: 'empty' };
  const max = opts.maxChars ?? 4000;
  if (out.length > max) return { ok: false, reason: 'too long' };
  const ratio = out.length / Math.max(1, source.trim().length);
  if (ratio < (opts.minRatio ?? 0.5) || ratio > (opts.maxRatio ?? 1.8)) {
    return { ok: false, reason: `length ratio ${ratio.toFixed(2)}` };
  }
  const a = wordingFacts(source);
  const b = wordingFacts(out);
  const same = (x: string[], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  if (!same(a.urls, b.urls)) return { ok: false, reason: 'urls differ' };
  if (!same(a.emails, b.emails)) return { ok: false, reason: 'emails differ' };
  if (!same(a.links, b.links)) return { ok: false, reason: 'links differ' };
  if (!same(a.numbers, b.numbers)) {
    const missing = a.numbers.filter((n) => !b.numbers.includes(n));
    const added = b.numbers.filter((n) => !a.numbers.includes(n));
    return { ok: false, reason: `numbers differ (missing ${missing.join(',') || '-'}; added ${added.join(',') || '-'})` };
  }
  if (a.steps.join(',') !== b.steps.join(',')) return { ok: false, reason: 'steps differ' };
  if (a.bold !== b.bold) return { ok: false, reason: 'bold differs' };
  return { ok: true };
}

/**
 * Numbers of a generated line must all come from the facts it was given — the
 * card note has no source sentence to compare with, only data.
 */
export function onlyKnownNumbers(text: string, facts: string): GuardResult {
  const known = wordingFacts(facts).numbers;
  const used = wordingFacts(text).numbers;
  const added = used.filter((n) => !known.includes(n));
  return added.length ? { ok: false, reason: `unknown numbers ${added.join(',')}` } : { ok: true };
}

/** Strip what models like to wrap an answer in: quotes, a leading label. */
export function cleanModelText(text: string): string {
  let t = text.trim();
  t = t.replace(/^(?:rewritten message|message|answer|reply)\s*:\s*/i, '');
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith('“') && t.endsWith('”'))) t = t.slice(1, -1).trim();
  return t;
}
