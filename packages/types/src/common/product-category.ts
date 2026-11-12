/**
 * Product Help categories (ivy-docs T10 D2). A tenant lists the store
 * collections a shopper can browse under "Popular products": a name per
 * language and the Shopify collection handle — the part after `/collections/`
 * in the store URL. They live on the Product Help scenario button, so there is
 * no table and no migration.
 *
 * Dependency-free on purpose: the widget and the console deep-import this
 * source file (a value import from `@sharptalk/types` breaks browser builds).
 */
export const PRODUCT_CATEGORY_MAX = 20;
export const PRODUCT_CATEGORY_LABEL_MAX = 40;
const HANDLE_MAX = 100;

/** Letters (any script), digits, `-` and `_`, starting with a letter or digit. */
const HANDLE_RE = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;

/**
 * The collection handle an operator meant: a bare handle, or a pasted store URL
 * (`https://ivyusa.com/collections/nails?sort_by=best-selling` → `nails`).
 * Null when nothing usable is left.
 */
export function collectionHandleFrom(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  const fromUrl = s.match(/\/collections\/([^/?#\s]+)/i);
  if (fromUrl) s = fromUrl[1];
  try {
    s = decodeURIComponent(s);
  } catch {
    // A stray "%" is just not a handle; the pattern below rejects it.
  }
  s = s.toLowerCase();
  return s.length > 0 && s.length <= HANDLE_MAX && HANDLE_RE.test(s) ? s : null;
}

/** The storefront page for a collection, sorted the way "Popular products" is. */
export function collectionUrl(storefrontOrigin: string, handle: string): string {
  return `${storefrontOrigin.replace(/\/+$/, '')}/collections/${encodeURIComponent(handle)}?sort_by=best-selling`;
}
