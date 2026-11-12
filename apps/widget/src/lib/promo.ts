// Source path, not '@sharptalk/types': see lib/widget-tabs.ts.
import { PROMO_KIND, isPromoKind, type PromoKind } from '../../../../packages/types/src/common/promo';

/**
 * Coupon or event, for a promo row (ivy-docs T05 D3). The API names it from
 * the row's campaign; rows sent before T05 carry no kind, and fall back to the
 * guess the widget always made: a campaign with a link is an event, one
 * without is a coupon.
 */
export function promoKind(n: { category: string; kind?: string | null; linkUrl?: string | null }): PromoKind | null {
  if (n.category !== 'event') return null;
  if (isPromoKind(n.kind)) return n.kind;
  return n.linkUrl ? PROMO_KIND.EVENT : PROMO_KIND.COUPON;
}

/**
 * The link a promo may open: https only. Campaigns are checked when they are
 * sent, but the feed is also written by other emitters, and a `javascript:`
 * or plain-http URL must never become a tap target.
 */
export function safeLink(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  try {
    return new URL(u).protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** Copy text to the clipboard; false when the browser refuses (no permission, no API). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch {
    return false;
  }
}
