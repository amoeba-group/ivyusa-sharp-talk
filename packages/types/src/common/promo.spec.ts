import { COUPON_CODE_MAX, PROMO_KIND, isPromoKind, isValidCouponCode, promoFromContent } from './promo';

describe('promo (ivy-docs T05)', () => {
  it('knows exactly two kinds', () => {
    expect(isPromoKind(PROMO_KIND.EVENT)).toBe(true);
    expect(isPromoKind(PROMO_KIND.COUPON)).toBe(true);
    expect(isPromoKind('campaign')).toBe(false);
    expect(isPromoKind(undefined)).toBe(false);
  });

  it('accepts codes like the design ones', () => {
    for (const c of ['SCHOOL20', 'IVY10', 'back-to_school', 'A'.repeat(COUPON_CODE_MAX)]) {
      expect(isValidCouponCode(c)).toBe(true);
    }
  });

  it('rejects empty, too long, spaces and symbols', () => {
    for (const c of ['', ' SCHOOL20', 'SCHOOL 20', 'A'.repeat(COUPON_CODE_MAX + 1), '<b>X</b>', '20%OFF', null, 20]) {
      expect(isValidCouponCode(c)).toBe(false);
    }
  });
});

describe('promoFromContent', () => {
  it('a campaign without a kind is an event; only a coupon keeps its code', () => {
    expect(promoFromContent(null)).toEqual({ kind: 'event', couponCode: null });
    expect(promoFromContent({ message: 'Mad Shade' })).toEqual({ kind: 'event', couponCode: null });
    expect(promoFromContent({ kind: 'event', couponCode: 'X1' })).toEqual({ kind: 'event', couponCode: null });
    expect(promoFromContent({ kind: 'coupon', couponCode: ' SCHOOL20 ' })).toEqual({ kind: 'coupon', couponCode: 'SCHOOL20' });
    expect(promoFromContent({ kind: 'coupon' })).toEqual({ kind: 'coupon', couponCode: null });
    expect(promoFromContent({ kind: 'bogus' })).toEqual({ kind: 'event', couponCode: null });
  });
});
