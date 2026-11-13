import {
  NOTICE_STATUS,
  isOrderDelivered,
  type NoticeStatus,
} from '../../../../packages/types/src/common/order-status';

/**
 * Delivery card rules (ivy-docs T03, SCR-IVY-05, BR-06). Pure functions so the
 * stepper, the pill and the message cannot disagree, and so they can be tested
 * without a browser.
 *
 * `stepIndex` is the server's `TrackingResponse.stepIndex`: 0 preparing,
 * 1 processing, 2 in transit, 3 delivered. -1 means "no tracking yet".
 */
export type DeliveryStepState = 'done' | 'current' | 'todo';

/** True once the shipment reached the last step (Delivered). */
export function isDeliveredStep(stepIndex: number, count: number): boolean {
  return count > 0 && stepIndex >= count - 1;
}

/**
 * State of step `i`: steps already passed are `done`, the one the shipment is
 * on is `current`, the rest `todo`. Delivered is an end state, not a step in
 * progress, so once it is reached every step reads `done`.
 */
export function deliveryStepState(i: number, stepIndex: number, count: number): DeliveryStepState {
  if (isDeliveredStep(stepIndex, count) || i < stepIndex) return 'done';
  return i === stepIndex ? 'current' : 'todo';
}

/**
 * `orders.trackingSteps` is the one translation key that is an ARRAY, and
 * i18next's `returnObjects` hands back whatever the bundle holds. A locale that
 * lost the key, or defined it as a string, would make this a non-array, and a
 * `.map` downstream would throw and take the card down. Validate, never cast.
 */
export function asStepLabels(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string') : [];
}

/**
 * The words under the steps (T14 D2). The server sends them in the session's
 * language at fetch time, and the widget keeps a fetch for a minute, so after
 * the shopper switched language the steps stayed in the old one. The widget's
 * own table (`orders.trackingSteps`, six languages, the same words as the
 * server's `DELIVERY_STEPS_BY_LANG`) follows the switch at once, so it wins
 * whenever it has as many steps as the shipment. A shipment with a different
 * number of steps keeps the server's words: the table does not describe it.
 */
export function deliveryStepLabels(
  serverSteps: readonly string[] | null | undefined,
  local: readonly string[],
): readonly string[] {
  if (!serverSteps?.length) return local;
  return serverSteps.length === local.length ? local : serverSteps;
}

/**
 * The card's pill (T03 D4). The tracking step wins once it has loaded, so the
 * pill, the stepper and the message always say the same thing even when the
 * order row lags behind the fulfillment. Before that, the order's own status.
 */
export function deliveryCardStatus(
  order: { statusInternal?: string | null; statusUi?: string | null },
  tracking: { stepIndex: number; steps?: readonly string[] | null } | null | undefined,
  fallbackCount: number,
): NoticeStatus {
  if (tracking) {
    const count = tracking.steps?.length || fallbackCount;
    return isDeliveredStep(tracking.stepIndex, count) ? NOTICE_STATUS.DELIVERED : NOTICE_STATUS.IN_TRANSIT;
  }
  return isOrderDelivered(order) ? NOTICE_STATUS.DELIVERED : NOTICE_STATUS.IN_TRANSIT;
}
