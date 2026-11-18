import { FULFILLMENT_STATUS, FulfillmentStatus } from '@sharptalk/types';
import type { ShopifyOrderFulfillmentDto } from './shopify-admin.client';

/** What an order's parcels add up to (PLN-261118). */
export interface ShipmentSummary {
  /** Delivered only when every parcel is; otherwise the furthest any parcel got. */
  status: FulfillmentStatus;
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
  /** When the store last changed any of these parcels; null when it did not say. */
  changedAt: Date | null;
}

/** Shopify `shipment_status` → ours. Same table the fulfillment webhook uses. */
export function shipmentStatusOf(shipment?: string | null): FulfillmentStatus {
  const s = (shipment ?? '').toLowerCase();
  if (s === 'delivered') return FULFILLMENT_STATUS.DELIVERED;
  if (s === 'in_transit' || s === 'out_for_delivery' || s === 'attempted_delivery') {
    return FULFILLMENT_STATUS.IN_TRANSIT;
  }
  return FULFILLMENT_STATUS.SHIPPED;
}

/** A parcel that never left: cancelled, or the fulfillment request failed. */
function isVoid(f: ShopifyOrderFulfillmentDto): boolean {
  const s = (f.status ?? '').toLowerCase();
  return s === 'cancelled' || s === 'canceled' || s === 'error' || s === 'failure';
}

function time(v?: string | null): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Roll an order's fulfillments into the one row the cache keeps per order.
 *
 * @returns null when the payload carries no shipment to speak of — the field is
 *   absent, or every parcel is void. Callers must read that as "nothing said",
 *   never as "not shipped": a payload without the field must not undo what an
 *   earlier one established.
 */
export function summarizeFulfillments(
  list: ShopifyOrderFulfillmentDto[] | null | undefined,
): ShipmentSummary | null {
  if (!Array.isArray(list)) return null;
  const parcels = list.filter((f) => f && !isVoid(f));
  if (!parcels.length) return null;

  const statuses = parcels.map((f) => shipmentStatusOf(f.shipment_status));
  const status = statuses.every((s) => s === FULFILLMENT_STATUS.DELIVERED)
    ? FULFILLMENT_STATUS.DELIVERED
    : statuses.some((s) => s !== FULFILLMENT_STATUS.SHIPPED)
      ? FULFILLMENT_STATUS.IN_TRANSIT
      : FULFILLMENT_STATUS.SHIPPED;

  // Tracking comes from the parcel that changed last and actually has a number.
  const newestFirst = [...parcels].sort((a, b) => time(b.updated_at) - time(a.updated_at));
  const tracked = newestFirst.find((f) => f.tracking_number) ?? newestFirst[0];
  const latest = Math.max(...parcels.map((f) => time(f.updated_at)));

  return {
    status,
    trackingNumber: tracked.tracking_number ? String(tracked.tracking_number).slice(0, 64) : null,
    carrier: tracked.tracking_company ? String(tracked.tracking_company).slice(0, 64) : null,
    trackingUrl: tracked.tracking_url ?? tracked.tracking_urls?.[0] ?? null,
    changedAt: latest > 0 ? new Date(latest) : null,
  };
}
