/**
 * Product families (PLN-260807 P1, PLN-261127).
 *
 * A storefront sells some colours and sizes as products of their own: "KISS
 * imPRESS Color Press On Nails - Cosmic", "… - Bubble Kiss", twelve handles in
 * all. The catalogue sync folds each family into ONE knowledge document named
 * after a representative member (catalog-sync.service). These helpers are that
 * fold, shared, so the chat can tell which member a question names.
 */

/**
 * A variant suffix is announced by a dash: "… Nail Polish Core Colors - Aphrodite".
 *
 * Only titles that carry one are folded. An earlier rule — the first five
 * normalized words — folded more rows but merged whole product LINES: the five
 * KISS "Pure Glow Vita Bright" products (cleanser, toner, moisturizer, eye
 * patches, serum) collapsed into one document titled after the serum, and four
 * real products became unreachable. Measured against the live catalogue, this
 * rule folds 444 rows and leaves only two suspect groups, both genuine size
 * variants of one dressing.
 *
 * `in` is deliberately not a separator, though "Press-On Nails in Amiable"
 * reads like one: it would also split "2 in 1 Curling Iron" and "All In One
 * Lamination Kit" (4 such titles in the catalogue).
 */
export const VARIANT_SEPARATOR = /\s[–—-]\s/;

/**
 * The family a title belongs to: the part before its variant separator, or
 * the whole title when it has none. Identical titles therefore still fold —
 * the storefront carries 30 rows literally named "Gold Finger Solid Color
 * Nails" — while two different products never merge just because they share
 * an opening phrase.
 */
export function productFamilyKey(title: string): string {
  const [head, ...rest] = title.split(VARIANT_SEPARATOR);
  return normalizeTitle(rest.length ? head : title);
}

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/** Lower-cased runs of letters and digits — the split titleMatchScore compares on. */
export function questionWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/**
 * Words too common to name a variant by themselves: "Do you have it for me?"
 * must not name a shade called "For You".
 */
const FILLER = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'are', 'was', 'has', 'have', 'this', 'that', 'can', 'all',
  'not', 'but', 'its', 'our', 'out', 'any', 'how', 'what', 'who', 'why', 'when', 'does', 'did', 'get',
  'got', 'too', 'very', 'just', 'from', 'into', 'one', 'new', 'set', 'size', 'color', 'colour', 'shade',
]);

/**
 * The words that name this member within its family: its suffix, minus the
 * words the family's own name already has. "… Press On Nails - Bubble Kiss" →
 * `bubble` ("kiss" is the brand). Null when the title has no suffix, or when
 * nothing is left that a question could not contain by chance — "RED by KISS
 * … Cap - Red" (red is the brand), "… - Do It".
 */
export function variantWords(title: string): string[] | null {
  const [head, ...rest] = title.split(VARIANT_SEPARATOR);
  if (!rest.length) return null;
  const family = new Set(questionWords(head));
  const words = [...new Set(questionWords(rest.join(' ')))].filter((w) => !family.has(w));
  return words.some((w) => w.length >= 3 && !FILLER.has(w)) ? words : null;
}
