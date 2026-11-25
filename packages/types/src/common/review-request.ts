import type { LocalizedText } from './language';

/**
 * Review requests after delivery (IVY PRD v1 N-05, PLN-261125-IVY-PRD-v1-Phase4 §2).
 *
 * The tenant sets N, the number of days after delivery (`tenants.review_request_days`).
 * Null means the feature is off. Each delivered order is asked once.
 */
export const REVIEW_REQUEST_DAYS_MIN = 1;
export const REVIEW_REQUEST_DAYS_MAX = 60;
/** What the console offers when the tenant switches it on. */
export const REVIEW_REQUEST_DAYS_DEFAULT = 7;
/**
 * A delivery older than N plus this many days is never asked about. Without
 * the limit, switching the feature on, or a sync that only now learns of an old
 * delivery, would reach orders from months ago.
 */
export const REVIEW_REQUEST_GRACE_DAYS = 7;

export function isReviewRequestDays(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= REVIEW_REQUEST_DAYS_MIN && (n as number) <= REVIEW_REQUEST_DAYS_MAX;
}

/** Notification title, in the language of the shopper's latest chat session. */
export const REVIEW_REQUEST_TITLE: LocalizedText = {
  EN: 'How was your order?',
  ES: '¿Qué te pareció tu pedido?',
  KO: '주문하신 상품은 어떠셨나요?',
  VI: 'Bạn thấy đơn hàng thế nào?',
  JA: 'ご注文の商品はいかがでしたか？',
  ZH: '您对订单满意吗？',
};

/** Notification body; `{item}` = the product to review, `{order}` = the order number. */
export const REVIEW_REQUEST_BODY: LocalizedText = {
  EN: 'Leave a review for {item} ({order}).',
  ES: 'Deja una reseña de {item} ({order}).',
  KO: '{item} 리뷰를 남겨 주세요. ({order})',
  VI: 'Hãy để lại đánh giá cho {item} ({order}).',
  JA: '{item}のレビューをお寄せください（{order}）。',
  ZH: '欢迎为 {item} 留下评价（{order}）。',
};
