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
import { groupByDate } from '../../lib/format';
import { asStepLabels, deliveryCardStatus, isDeliveredStep } from '../../lib/delivery';
import { DateGroupHeader } from './DateGroupHeader';
import type { OrderSummary, Tracking } from '../../lib/types';

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

/** When the order was placed — what the card's date band goes by (T03 §7-3). */
const placedAt = (o: OrderSummary): string => o.orderedAt ?? o.createdAt;

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
}: {
  order: OrderSummary;
  tracking: Tracking | undefined;
  loading: boolean;
  onOpen: () => void;
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
    <div data-testid="delivery-card" data-id={order.id} className="border-b border-gray-100 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-bold text-gray-900">{order.orderNumber}</span>
        <StatusPill status={status} />
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
            delivered ? 'text-gray-900' : 'text-warning'
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
          onClick={() => analytics.trackingView(order.id, true)}
          className={OUTLINE_BUTTON}
        >
          {t('orders.trackingCta')}
        </a>
      ) : (
        <button type="button" onClick={onOpen} className={OUTLINE_BUTTON}>
          {t('orders.trackingCta')}
        </button>
      )}
    </div>
  );
}

/**
 * The Delivery chip (PLN-260817 W-2, ivy-docs T03).
 *
 * This is the one filter that does NOT read the notification feed: the design
 * shows live shipment progress here, which lives on the order, not on the
 * notification row that announced it. Orders on their way or delivered, newest
 * five, under the same date bands as the Order chip — by the day the order was
 * placed, in the shopper's own time zone.
 */
export function ShipmentList({
  sessionToken,
  onOpenOrder,
}: {
  sessionToken: string | null;
  onOpenOrder: (orderId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useOrders(sessionToken);
  const shipments = (data ?? [])
    .filter(isShipmentish)
    .sort((a, b) => Date.parse(placedAt(b)) - Date.parse(placedAt(a)))
    .slice(0, TRACKED_MAX);

  const trackingQueries = useQueries({
    queries: shipments.map((o) => ({
      queryKey: ['tracking', o.id, sessionToken],
      queryFn: () => getTracking(o.id, sessionToken!),
      enabled: !!sessionToken,
      staleTime: 60_000,
    })),
  });

  if (isLoading) return <Spinner label={t('common.loading')} />;
  if (isError) return <p className="py-8 text-center text-sm text-gray-400">{t('common.error')}</p>;
  if (shipments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
        <PackageSearch className="h-6 w-6" />
        <span className="text-sm">{t('orders.noShipments')}</span>
      </div>
    );
  }

  const trackingOf = new Map(shipments.map((o, i) => [o.id, trackingQueries[i]]));
  const groups = groupByDate(
    shipments.map((order) => ({ createdAt: placedAt(order), order })),
    i18n.language,
  );

  return (
    <div>
      {groups.map((g) => (
        <div key={g.label}>
          <DateGroupHeader group={g} />
          {g.items.map(({ order }) => {
            const q = trackingOf.get(order.id);
            return (
              <ShipmentCard
                key={order.id}
                order={order}
                tracking={q?.data}
                loading={!!q?.isLoading}
                onOpen={() => onOpenOrder(order.id)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
