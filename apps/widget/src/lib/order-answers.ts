// Source path, not '@sharptalk/types': a value import from the package breaks the browser build.
import { isOrderDelivered, isOrderInTransit } from '../../../../packages/types/src/common/order-status';

/**
 * Which order the Payment check and Delivery inquiry cards talk about, and what
 * they say about it (IVY PRD v1 C-01, PLN-261125 §2.5). Pure, so the rules are
 * testable without React.
 */

type Dated = { orderedAt?: string | null; createdAt: string };
type Status = { statusInternal?: string | null; statusUi?: string | null };

const placed = (o: Dated): number => Date.parse(o.orderedAt ?? o.createdAt) || 0;

/** The newest order — "payment status card of recent order". */
export function latestOrder<T extends Dated>(orders: readonly T[]): T | null {
  return orders.reduce<T | null>((best, o) => (!best || placed(o) > placed(best) ? o : best), null);
}

/** The order a Delivery inquiry is about: the newest one on its way, else the newest. */
export function deliveryOrder<T extends Dated & Status>(orders: readonly T[]): T | null {
  return latestOrder(orders.filter((o) => isOrderInTransit(o))) ?? latestOrder(orders);
}

export type PaymentState = 'paid' | 'pending' | 'cancelled' | 'refunded';

/**
 * From the status WE store (`status_internal`), never from the platform's
 * wording. Everything past payment — preparing, shipping, delivered — was paid.
 */
export function paymentState(order: Pick<Status, 'statusInternal'>): PaymentState {
  switch ((order.statusInternal ?? '').toLowerCase().trim()) {
    case 'pending_payment':
      return 'pending';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    default:
      return 'paid';
  }
}

/** The pill tone for each payment state — the widget's Badge tones. */
export const PAYMENT_TONE: Record<PaymentState, string> = {
  paid: 'success',
  pending: 'default',
  cancelled: 'neutral',
  refunded: 'neutral',
};

export type DeliveryStage = 'preparing' | 'inTransit' | 'delivered';

export function deliveryStage(order: Status): DeliveryStage {
  if (isOrderDelivered(order)) return 'delivered';
  if (isOrderInTransit(order)) return 'inTransit';
  return 'preparing';
}
