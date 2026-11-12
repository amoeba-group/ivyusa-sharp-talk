import type { OrderAddress } from './types';

/**
 * The country in the shopper's language ("United States" / "미국" / "Hoa Kỳ"),
 * from the ISO code when the store sent one, else the store's own wording.
 */
export function countryName(a: Pick<OrderAddress, 'country' | 'countryCode'>, lang: string): string | null {
  const code = a.countryCode?.trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) {
    try {
      const name = new Intl.DisplayNames([lang || 'en', 'en'], { type: 'region' }).of(code);
      if (name && name !== code) return name;
    } catch {
      // An engine without Intl.DisplayNames, or a language it does not know.
    }
  }
  return a.country?.trim() || null;
}

/**
 * The lines of a postal address as Order Detail shows them (ivy-docs T04 D2,
 * Figma 1008:3254 EN / 1006:4282 KO): name · street · street 2 · "CITY
 * Province" · ZIP · country · phone. Both frames put the ZIP on its own line.
 * Missing parts are skipped rather than left as blank lines.
 */
export function addressLines(a: OrderAddress, lang: string): string[] {
  const locality = [a.city, a.province]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ');
  return [a.name, a.address1, a.address2, locality, a.zip, countryName(a, lang), a.phone]
    .map((l) => l?.trim() ?? '')
    .filter((l) => l.length > 0);
}

/**
 * The order number as the design writes it: "IVY-39891" stays as is; a bare
 * Shopify number gets the store's "#" ("#1002"), the way it reads everywhere
 * else in a Shopify store.
 */
export function displayOrderNumber(orderNumber: string): string {
  return /^\d+$/.test(orderNumber) ? `#${orderNumber}` : orderNumber;
}
