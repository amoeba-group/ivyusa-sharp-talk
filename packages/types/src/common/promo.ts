/**
 * Promo notifications (ivy-docs T05). A campaign is an EVENT (sparkle, magenta)
 * or a COUPON (gift, navy) that may carry one shared code. Both live in the
 * campaign's `content` JSON (`kind`, `couponCode`); a notification points at its
 * campaign through `ref_type = 'campaign'` and inherits them (PLN-261112 D2).
 *
 * Dependency-free on purpose: the widget and the console deep-import this
 * source file (a value import from `@sharptalk/types` breaks browser builds).
 */
export const PROMO_KIND = { EVENT: 'event', COUPON: 'coupon' } as const;
export type PromoKind = (typeof PROMO_KIND)[keyof typeof PROMO_KIND];

export const COUPON_CODE_MAX = 32;

/** Letters, digits, `-` and `_`; 1–32 characters. What Shopify discount codes look like in practice. */
const COUPON_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function isPromoKind(v: unknown): v is PromoKind {
  return v === PROMO_KIND.EVENT || v === PROMO_KIND.COUPON;
}

/** True for a code a campaign may carry. Callers trim first. */
export function isValidCouponCode(v: unknown): v is string {
  return typeof v === 'string' && COUPON_CODE_RE.test(v);
}

/**
 * The promo pair a campaign's `content` JSON carries, normalised. A campaign
 * without `kind` is an event — what every campaign was before T05, and what
 * the console still defaults to. Only a coupon keeps a code.
 */
export function promoFromContent(content: Record<string, unknown> | null | undefined): {
  kind: PromoKind;
  couponCode: string | null;
} {
  const kind = isPromoKind(content?.kind) ? content.kind : PROMO_KIND.EVENT;
  const raw = typeof content?.couponCode === 'string' ? content.couponCode.trim() : '';
  return { kind, couponCode: kind === PROMO_KIND.COUPON && raw ? raw : null };
}
