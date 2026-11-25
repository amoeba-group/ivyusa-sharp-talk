import { useQueries } from '@tanstack/react-query';
import { PackageSearch } from 'lucide-react';
import { useAnalytics } from '../../lib/analytics';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { getTracking } from '../../services/orderService';
import { useOrders } from '../../hooks/useOrders';
import { StatusPill } from '../ui/StatusPill';
import { Spinner } from '../ui/Spinner';
import { TrackingStepperH } from '../orders/TrackingStepperH';
import { isShipmentish } from '../orders/order-status';
import { groupByRead } from '../../lib/format';
import { asStepLabels, deliveryCardStatus, isDeliveredStep } from '../../lib/delivery';
import { GroupHeader } from './GroupHeader';
import { useMarkRead, useNotifications } from '../../hooks/useNotifications';
import { useNewSnapshot } from '../../hooks/useNewSnapshot';
import { NOTIFICATION_SCOPE } from '../../lib/widget-tabs';
// Source path, not '@sharptalk/types': see lib/widget-tabs.ts.
import { NOTIFICATION_REF } from '../../../../../packages/types/src/common/enum.types';
import type { NotificationItem, OrderSummary, Tracking } from '../../lib/types';

/**
 * How many shipments render their progress. Tracking is one request per order
 * (`GET /orders/:id/tracking`), so an unbounded list would fan out to a request
 * per row. Five is what the design shows before the shopper scrolls, and the
 * rest stay reachable through "see all orders".
 */
const TRACKED_MAX = 5;

/** The widget's step table, validated: the key is an array (see `asStepLabels`). */
function trackingStepLabels(t: TFunction): string[] {
  return asStepLabels(t('orders.trackingSteps', { returnObjects: true }));
}

/** When the order was placed — the list is newest first by it (T03 §7-3). */
const placedAt = (o: OrderSummary): string => o.orderedAt ?? o.createdAt;

/** The notices that track an order's status — what makes its card New (PRD v1 slide 9). */
const STATUS_NOTICE_CATEGORIES: readonly string[] = ['payment', 'shipping'];

const OUTLINE_BUTTON =
  'mt-3 flex w-full items-center justify-center rounded-st-md border border-gray-300 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50';

/**
 * One delivery card (ivy-docs T03, SCR-IVY-05, Figma `1007:1069`): order number
 * and status pill, item summary, the 4-step stepper, the status message and
 * Track Order.
 */
function ShipmentCard({
  order,
  tracking,
  loading,
  onOpen,
  unread = false,
  focused = false,
  onSeen,
}: {
  order: OrderSummary;
  tracking: Tracking | undefined;
  loading: boolean;
  onOpen: () => void;
  /** The order has a status notice the shopper has not read: highlighted, with the dot. */
  unread?: boolean;
  /** Reached from the truck button in Order Detail (PRD v1 slide 7 ②). */
  focused?: boolean;
  /** Track Order was used: the order's notices are read. */
  onSeen?: () => void;
}) {
  const { t } = useTranslation();
  const analytics = useAnalytics();
  const fallbackSteps = trackingStepLabels(t);
  const stepCount = tracking?.steps?.length || fallbackSteps.length;
  const delivered = !!tracking && isDeliveredStep(tracking.stepIndex, stepCount);
  // Pill, stepper and message all follow the tracking step once it loads (D4).
  const status = deliveryCardStatus(order, tracking, fallbackSteps.length);

  const summary = order.firstItemTitle
    ? order.itemCount > 1
      ? t('orders.itemsMore', { title: order.firstItemTitle, count: order.itemCount - 1 })
      : order.firstItemTitle
    : t('orders.itemCount', { count: order.itemCount });

  return (
    <div
      data-testid="delivery-card"
      data-id={order.id}
      data-unread={unread ? 'true' : 'false'}
      data-focused={focused ? 'true' : undefined}
      className={`border-b border-gray-100 px-4 py-4 ${unread ? 'bg-highlight' : 'bg-white'} ${
        focused ? 'ring-2 ring-inset ring-primary-500' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-bold text-gray-900">{order.orderNumber}</span>
        <span className="flex items-center gap-2">
          <StatusPill status={status} />
          {unread && (
            <span aria-label={t('notifications.unread')} className="block h-2 w-2 rounded-full bg-error" />
          )}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-700">{summary}</p>

      <div className="mt-4">
        {loading && !tracking ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <TrackingStepperH
            tracking={tracking ?? { status: '', carrier: null, trackingNumber: null, stepIndex: -1, steps: [] }}
            labels={fallbackSteps}
          />
        )}
      </div>

      {tracking && (
        <p
          className={`mt-3 text-center text-sm font-bold ${
            // warning-ink, not warning: the design's orange #FF6900 is 2.89:1 on
            // white; the ink shade reads at 4.56:1 (BUG-021, as T06 did for Write Review).
            delivered ? 'text-gray-900' : 'text-warning-ink'
          }`}
        >
          {delivered ? t('orders.shipmentDelivered') : t('orders.shipmentInTransit')}
        </p>
      )}

      {/* Q-05 / PLN-260923 P2: the carrier's own page in a new tab when we have
          one, otherwise the order detail inside the widget. */}
      {tracking?.trackingUrl ? (
        <a
          href={tracking.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            onSeen?.();
            analytics.trackingView(order.id, true);
          }}
          className={OUTLINE_BUTTON}
        >
          {t('orders.trackingCta')}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => {
            onSeen?.();
            onOpen();
          }}
          className={OUTLINE_BUTTON}
        >
          {t('orders.trackingCta')}
        </button>
      )}
    </div>
  );
}

/**
 * The Delivery chip (PLN-260817 W-2, ivy-docs T03).
 *
 * The cards show live shipment progress, which lives on the order, not on the
 * notification row that announced it. Orders on their way or delivered, newest
 * five, under the same New / Recent bands as the Order chip (IVY PRD v1
 * slide 9): a card is New while its order has a status notice the shopper had
 * not read when this opening of the widget began. Using Track Order reads them.
 *
 * `focusOrderId` (the truck button in Order Detail, PRD v1 slide 7 ②) puts
 * that order's card first, outlined — also an order not shipped yet, whose card
 * then sits on Preparing.
 */
export function ShipmentList({
  sessionToken,
  onOpenOrder,
  focusOrderId = null,
}: {
  sessionToken: string | null;
  onOpenOrder: (orderId: string) => void;
  focusOrderId?: string | null;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useOrders(sessionToken);
  const focus = focusOrderId ? (data ?? []).find((o) => String(o.id) === String(focusOrderId)) : undefined;
  const shipments = (data ?? [])
    .filter((o) => isShipmentish(o) && o !== focus)
    .sort((a, b) => Date.parse(placedAt(b)) - Date.parse(placedAt(a)))
    .slice(0, focus ? TRACKED_MAX - 1 : TRACKED_MAX);
  const cards = focus ? [focus, ...shipments] : shipments;

  // The order half of the feed — the Order chip's own query, so one request.
  const { data: notices } = useNotifications(sessionToken, 'all', NOTIFICATION_SCOPE.ORDER);
  const markRead = useMarkRead(sessionToken);
  const isNewNotice = useNewSnapshot(notices);
  const noticesOf = new Map<string, NotificationItem[]>();
  for (const n of notices ?? []) {
    if (n.refType !== NOTIFICATION_REF.ORDER || !n.refId || !STATUS_NOTICE_CATEGORIES.includes(n.category)) continue;
    const list = noticesOf.get(String(n.refId)) ?? [];
    list.push(n);
    noticesOf.set(String(n.refId), list);
  }
  const unreadOf = (o: OrderSummary) => (noticesOf.get(String(o.id)) ?? []).filter((n) => !n.readAt);
  const isNewOrder = (o: OrderSummary) => (noticesOf.get(String(o.id)) ?? []).some((n) => isNewNotice(n.id));
  const readOrder = (o: OrderSummary) => {
    for (const n of unreadOf(o)) markRead.mutate(n.id);
  };

  const trackingQueries = useQueries({
    queries: cards.map((o) => ({
      queryKey: ['tracking', o.id, sessionToken],
      queryFn: () => getTracking(o.id, sessionToken!),
      enabled: !!sessionToken,
      staleTime: 60_000,
    })),
  });

  if (isLoading) return <Spinner label={t('common.loading')} />;
  if (isError) return <p className="py-8 text-center text-sm text-gray-400">{t('common.error')}</p>;
  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
        <PackageSearch className="h-6 w-6" />
        <span className="text-sm">{t('orders.noShipments')}</span>
      </div>
    );
  }

  const trackingOf = new Map(cards.map((o, i) => [o.id, trackingQueries[i]]));
  const card = (order: OrderSummary, focused = false) => {
    const q = trackingOf.get(order.id);
    return (
      <ShipmentCard
        key={order.id}
        order={order}
        tracking={q?.data}
        loading={!!q?.isLoading}
        onOpen={() => onOpenOrder(order.id)}
        unread={unreadOf(order).length > 0}
        focused={focused}
        onSeen={() => readOrder(order)}
      />
    );
  };

  return (
    <div>
      {focus && card(focus, true)}
      {groupByRead(shipments, isNewOrder).map((g) => (
        <div key={g.key}>
          <GroupHeader group={g.key} />
          {g.items.map((order) => card(order))}
        </div>
      ))}
    </div>
  );
}
