import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CJM_STAGE,
  FULFILLMENT_STATUS,
  NOTIFICATION_REF,
  ORDER_STATUS_INTERNAL,
  ORDER_STATUS_UI,
  internalToUiStatus,
} from '@sharptalk/types';
import { OrderCache } from './entity/order-cache.entity';
import { OrderItem } from './entity/order-item.entity';
import { Fulfillment } from './entity/fulfillment.entity';
import { safeTrackingUrl } from './carrier-tracking';
import { ShopifyAdminClient, ShopifyOrderDto } from './shopify-admin.client';
import { ShipmentSummary, summarizeFulfillments } from './shopify-shipment';
import { TenantService } from '../tenant/tenant.service';
import { CustomerService } from '../customer/customer.service';
import { EventBusService, EVENTS } from '../../infrastructure/infrastructure.module';
import { PLATFORM } from '../customer/customer-platform-link.service';

/**
 * Shopify money → number. Amounts arrive as strings ("55.00"), sometimes as
 * numbers, and sometimes not at all. `null` means "the payload said nothing",
 * which callers must not confuse with 0 (PLN-260920 P2).
 */
function money(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const SHOPIFY = 'shopify';
/** Overlap subtracted from the last_sync_at cursor — upserts are idempotent, so
 *  re-pulling a few minutes protects against clock skew and error-stamped cursors. */
const CURSOR_LOOKBACK_MS = 10 * 60_000;
/** Page cap per batch (50 orders each) — bounds one request's work. A sync that
 *  hits it carries on in the background, batch after batch (BUG-033). */
const MAX_PAGES = 20;
/** Background batches per store before it stops and waits for the next trigger
 *  (200 × 1,000 orders). */
const MAX_CONTINUATIONS = 200;
/** Breathing room between background batches — the store's API budget is shared. */
const CONTINUATION_PAUSE_MS = 500;
/**
 * How far back a store's FIRST sync reads. Not the whole store: the widget needs
 * the orders still in play, older ones are fetched when someone asks for them
 * (`lookupOrderByNumber`, login backfill). 60 is also what Shopify serves without
 * `read_all_orders` (PLN-261117 B3).
 */
function initialWindowDays(): number {
  const n = Number(process.env.SHOPIFY_INITIAL_SYNC_DAYS);
  return Number.isInteger(n) && n > 0 ? n : 60;
}
/** "1001", "#1001", " ivy-1001 " → one comparable form. */
function normalizeOrderNumber(v: string | number | null | undefined): string {
  return String(v ?? '').trim().replace(/^#/, '').toLowerCase();
}
/** Per-customer login backfill: page cap and re-run suppression window. */
const CUSTOMER_BACKFILL_MAX_PAGES = 2;
const CUSTOMER_BACKFILL_TTL_MS = 10 * 60_000;
/**
 * A shipment change older than this is recorded without telling the shopper
 * (PLN-261118 §2.4): re-reading a store's history must not announce parcels
 * that arrived weeks ago.
 */
const SHIPMENT_NOTICE_MAX_AGE_MS = 48 * 3_600_000;
/** Clock slack for the delivery check logged by `syncBatch`. */
const DELIVERY_AFTER_UPDATE_SLACK_MS = 5 * 60_000;

/** Shopify topic → our webhook path (under /api/v1/webhooks/shopify/). */
const WEBHOOK_TOPICS: Array<{ topic: string; path: string }> = [
  { topic: 'orders/create', path: 'orders/create' },
  { topic: 'orders/updated', path: 'orders/updated' },
  { topic: 'fulfillments/create', path: 'fulfillments/create' },
  { topic: 'fulfillments/update', path: 'fulfillments/update' },
];

export interface ShopifySyncResult {
  ok: boolean;
  synced: number;
  detail: string;
  /** Present (true) only when this batch stopped at its cap with orders left. */
  more?: boolean;
}

export interface ShopifyWebhookRegisterResult {
  ok: boolean;
  registered: number;
  existing: number;
  failed: number;
  detail: string;
}

/**
 * Pulls orders (and their customers) from the Shopify Admin API into the local
 * cache (orders_cache / customers). On-demand; records the result in
 * integration_status. Fail-safe: any error → 'error', partial rows are kept.
 */
@Injectable()
export class ShopifySyncService {
  private readonly logger = new Logger(ShopifySyncService.name);

  constructor(
    @InjectRepository(OrderCache) private readonly orderRepo: Repository<OrderCache>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly client: ShopifyAdminClient,
    private readonly tenantService: TenantService,
    private readonly customerService: CustomerService,
    private readonly bus: EventBusService,
    // Appended and optional so callers that build the service by hand keep working.
    @Optional()
    @InjectRepository(Fulfillment)
    private readonly fulfillRepo?: Repository<Fulfillment>,
  ) {}

  /**
   * Sync this store's orders into the cache. One batch runs inside the call;
   * when it stops at its cap with orders left, the rest is read in the
   * background, batch after batch, so "Sync now" never leaves a store half read
   * (BUG-033: it used to stop at 500 and move the cursor past the rest).
   */
  async syncOrders(tenantId: number): Promise<ShopifySyncResult> {
    if (this.backfilling.has(tenantId)) {
      return {
        ok: true,
        synced: 0,
        detail: 'A sync is already running for this store — check again in a minute',
        more: true,
      };
    }
    const { resumeFrom, ...result } = await this.syncBatch(tenantId);
    if (resumeFrom) this.continueInBackground(tenantId, resumeFrom);
    return result;
  }

  /**
   * Forget how far this store was read and read the recent window again — for a
   * store whose first sync was cut short. Upserts by Shopify order id, so
   * nothing is duplicated.
   */
  async resyncRecent(tenantId: number): Promise<ShopifySyncResult> {
    if (this.backfilling.has(tenantId)) return this.syncOrders(tenantId);
    await this.tenantService.clearShopifySyncCursor(tenantId);
    return this.syncOrders(tenantId);
  }

  /** Stores with a background continuation in flight. */
  private readonly backfilling = new Set<number>();

  private continueInBackground(tenantId: number, from: Date): void {
    if (this.backfilling.has(tenantId)) return;
    this.backfilling.add(tenantId);
    void (async () => {
      try {
        let next: Date | undefined = from;
        for (let i = 0; next && i < MAX_CONTINUATIONS; i++) {
          await new Promise((resolve) => setTimeout(resolve, CONTINUATION_PAUSE_MS));
          const batch = await this.syncBatch(tenantId, next);
          if (!batch.ok) break;
          next = batch.resumeFrom;
        }
      } catch (e) {
        this.logger.warn(`Background order sync for tenant ${tenantId} stopped: ${(e as Error).message}`);
      } finally {
        this.backfilling.delete(tenantId);
      }
    })();
  }

  /**
   * Read one batch, oldest change first, so a batch that stops early knows
   * exactly where it stopped: `resumeFrom` is the last change it read.
   *
   * @param from exact resume point of a continuation; absent = start from the
   *   stored cursor, or from the initial window on a store never synced.
   */
  private async syncBatch(
    tenantId: number,
    from?: Date,
  ): Promise<ShopifySyncResult & { resumeFrom?: Date }> {
    const conn = await this.tenantService.getShopifyConnection(tenantId);
    if (!conn) {
      return this.record(
        tenantId,
        false,
        0,
        'Shopify shop domain or a valid access token is missing — reconnect the store',
      );
    }

    // Incremental cursor (PERF-5): THIS tenant's last successful sync minus a
    // lookback overlap. It used to be the provider-wide integration_status row,
    // so with two Shopify stores one store's run advanced the other's cursor
    // past orders it had never read (FIX-261019).
    const startedAt = new Date();
    const cursor = from ? null : await this.tenantService.getShopifySyncCursor(tenantId);
    const firstSync = !from && !cursor;
    const windowDays = initialWindowDays();
    const sinceDate = from
      ? from
      : cursor
        ? new Date(cursor.getTime() - CURSOR_LOOKBACK_MS)
        : new Date(startedAt.getTime() - windowDays * 86_400_000);
    const since = sinceDate.toISOString();

    let synced = 0;
    let pages = 0;
    let pageInfo: string | null = null;
    let lastUpdated: Date | null = null;
    let delivered = 0;
    let deliveredUntouched = 0;
    try {
      do {
        const page = await this.client.fetchOrders(conn.shopDomain, conn.token, {
          updatedAtMin: pageInfo ? undefined : since,
          pageInfo: pageInfo ?? undefined,
        });
        synced += await this.upsertPage(tenantId, page.orders);
        for (const o of page.orders) {
          const at = o.updated_at ? new Date(o.updated_at) : null;
          if (at && !Number.isNaN(at.getTime()) && (!lastUpdated || at > lastUpdated)) lastUpdated = at;
          // PLN-261118 §2.5: this sync finds an order by its `updated_at`. If a
          // parcel can be delivered without the store touching the order, such
          // orders show up here with a delivery later than their last update.
          for (const f of o.fulfillments ?? []) {
            const deliveredAt = f.delivered_at ? new Date(f.delivered_at).getTime() : NaN;
            if (Number.isNaN(deliveredAt)) continue;
            delivered++;
            if (at && deliveredAt - at.getTime() > DELIVERY_AFTER_UPDATE_SLACK_MS) deliveredUntouched++;
          }
        }
        pageInfo = page.nextPageInfo;
        pages++;
      } while (pageInfo && pages < MAX_PAGES);
    } catch (e) {
      if (synced === 0) return this.record(tenantId, false, 0, `Sync failed: ${(e as Error).message}`);
      // Partial progress is kept; report it but flag the interruption. The
      // cursor stays put so the unread pages are retried next run.
      return this.record(tenantId, true, synced, `Synced ${synced} order(s), interrupted: ${(e as Error).message}`);
    }

    if (delivered > 0) {
      this.logger.log(
        `Delivery check tenant=${tenantId}: ${delivered} delivered parcel(s) read, ` +
          `${deliveredUntouched} delivered after the order's last update`,
      );
    }

    if (pageInfo) {
      // Stopped at the cap with orders left. The cursor moves only as far as
      // this batch actually read — never to "now" — and only forward: a batch
      // that got nowhere (more orders changed in one instant than a batch
      // holds) must not loop on the same page.
      const resumeFrom = lastUpdated && lastUpdated > sinceDate ? lastUpdated : undefined;
      const detail = resumeFrom
        ? `Synced ${synced} order(s) up to ${resumeFrom.toISOString()} — more remain, continuing in the background`
        : `Synced ${synced} order(s) — more remain; run the sync again`;
      const result = await this.record(tenantId, true, synced, detail, resumeFrom);
      return { ...result, more: true, resumeFrom };
    }

    const detail = firstSync
      ? `Synced ${synced} order(s) (first sync, last ${windowDays} days)`
      : `Synced ${synced} order(s) updated since ${since}`;
    // Cursor = when this run STARTED, so orders updated while it ran fall
    // inside the next window (plus the lookback overlap).
    return this.record(tenantId, true, synced, detail, startedAt);
  }

  /**
   * Fetch ONE order from the store by its number and cache it — for an order
   * outside what the sync holds (PLN-261117 B3). With `email`, the order is
   * cached only when it belongs to that address: a guest who knows a number
   * must not pull someone else's order into reach.
   *
   * @returns the cached rows (empty when the store has no such order). Throws
   *   when the store cannot be asked — callers decide what a failure means.
   */
  async lookupOrderByNumber(
    tenantId: number,
    orderNumber: string,
    opts: { email?: string } = {},
  ): Promise<OrderCache[]> {
    const wanted = normalizeOrderNumber(orderNumber);
    if (!wanted) return [];
    const conn = await this.tenantService.getShopifyConnection(tenantId);
    if (!conn) return [];
    const page = await this.client.fetchOrders(conn.shopDomain, conn.token, {
      name: orderNumber,
      limit: 10,
      newestFirst: true,
    });
    const email = opts.email?.trim().toLowerCase();
    const matches = page.orders.filter((o) => {
      // The store's search is not an exact match; keep only the order asked for.
      if (normalizeOrderNumber(o.order_number ?? o.name) !== wanted) return false;
      if (!email) return true;
      const owner = (o.customer?.email ?? o.email ?? '').trim().toLowerCase();
      return owner !== '' && owner === email;
    });
    const rows: OrderCache[] = [];
    for (const o of matches) rows.push(await this.upsertOrder(tenantId, o));
    return rows;
  }

  /**
   * Pull one customer's orders into the cache (login-time backfill). The full
   * sync + webhooks only cover orders placed after the store connected, so a
   * customer signing in for the first time would otherwise see an empty "my
   * orders". Bounded (2 pages = 100 orders) and suppressed per customer for
   * 10 min — identity resolves on every storefront page load.
   */
  async syncOrdersForCustomer(tenantId: number, shopifyCustomerId: string): Promise<number> {
    const key = `${tenantId}:${shopifyCustomerId}`;
    const now = Date.now();
    const last = this.customerBackfillAt.get(key);
    if (last && now - last < CUSTOMER_BACKFILL_TTL_MS) return 0;
    if (this.customerBackfillAt.size > 5_000) this.customerBackfillAt.clear(); // cheap bound
    this.customerBackfillAt.set(key, now);

    const conn = await this.tenantService.getShopifyConnection(tenantId);
    if (!conn) return 0;
    let synced = 0;
    let pages = 0;
    let pageInfo: string | null = null;
    do {
      const page = await this.client.fetchOrders(conn.shopDomain, conn.token, {
        customerId: pageInfo ? undefined : shopifyCustomerId,
        // The most recent ones: a shopper with more orders than the cap wants
        // the latest, not the oldest (BUG-033).
        newestFirst: pageInfo ? undefined : true,
        pageInfo: pageInfo ?? undefined,
      });
      synced += await this.upsertPage(tenantId, page.orders);
      pageInfo = page.nextPageInfo;
      pages++;
    } while (pageInfo && pages < CUSTOMER_BACKFILL_MAX_PAGES);
    if (synced > 0) this.logger.log(`Backfilled ${synced} order(s) for customer ${key}`);
    return synced;
  }

  /** Last backfill instant per `${tenantId}:${shopifyCustomerId}` (see TTL above). */
  private readonly customerBackfillAt = new Map<string, number>();

  /** Upsert one page with the existing rows prefetched in a single IN() query. */
  private async upsertPage(tenantId: number, orders: ShopifyOrderDto[]): Promise<number> {
    if (!orders.length) return 0;
    const ids = orders.map((o) => String(o.id));
    const existing = await this.orderRepo.find({ where: { shopifyOrderId: In(ids) } });
    const byShopifyId = new Map(existing.map((r) => [r.shopifyOrderId, r]));
    let synced = 0;
    for (const order of orders) {
      try {
        await this.upsertOrder(tenantId, order, byShopifyId.get(String(order.id)));
        synced++;
      } catch (e) {
        this.logger.warn(`Skipped order ${order.id}: ${(e as Error).message}`);
      }
    }
    return synced;
  }

  /**
   * Subscribe the store to our order/fulfillment webhooks (uses the stored token).
   * Idempotent — a topic already subscribed counts as 'existing', not a failure.
   * Note: HMAC verification needs SHOPIFY_WEBHOOK_SECRET = the app's API secret key.
   */
  async registerWebhooks(tenantId: number): Promise<ShopifyWebhookRegisterResult> {
    const conn = await this.tenantService.getShopifyConnection(tenantId);
    if (!conn) {
      return {
        ok: false,
        registered: 0,
        existing: 0,
        failed: 0,
        detail: 'Shopify credential missing or invalid — reconnect the store',
      };
    }
    const base = (process.env.SHOPIFY_APP_URL ?? '').replace(/\/+$/, '');
    if (!base) {
      return {
        ok: false,
        registered: 0,
        existing: 0,
        failed: 0,
        detail: 'SHOPIFY_APP_URL is not set (needed for the webhook address)',
      };
    }

    let registered = 0;
    let existing = 0;
    let failed = 0;
    for (const { topic, path } of WEBHOOK_TOPICS) {
      const address = `${base}/api/v1/webhooks/shopify/${path}`;
      try {
        const r = await this.client.createWebhook(conn.shopDomain, conn.token, topic, address);
        if (r === 'created') registered++;
        else existing++;
      } catch (e) {
        failed++;
        this.logger.warn(`Register webhook ${topic} failed: ${(e as Error).message}`);
      }
    }
    return {
      ok: failed === 0,
      registered,
      existing,
      failed,
      detail: `Registered ${registered}, already present ${existing}, failed ${failed}`,
    };
  }

  /** Map a Shopify order → orders_cache (+ linked customer). Public: reused by webhooks. */
  async upsertOrder(tenantId: number, o: ShopifyOrderDto, prefetched?: OrderCache): Promise<OrderCache> {
    let customerId: number | null = null;
    // Erased identities come back null. Shopify still holds the address after we
    // scrub it, so this is the poll that used to undo an erasure minutes later.
    let identityErased = false;
    const email = o.customer?.email ?? o.email ?? null;
    if (email) {
      const name =
        [o.customer?.first_name, o.customer?.last_name].filter(Boolean).join(' ') || undefined;
      const shopifyCustomerId = o.customer?.id != null ? String(o.customer.id) : undefined;
      const customer = await this.customerService.findOrCreateByEmail(
        tenantId,
        email,
        name,
        shopifyCustomerId,
      );
      if (customer) {
        customerId = customer.id;
        await this.customerService.linkPlatform(tenantId, customer.id, PLATFORM.SHOPIFY, shopifyCustomerId, name);
      } else identityErased = true;
    }

    const rollup = this.mapStatus(o.financial_status, o.fulfillment_status, o.cancelled_at);
    // Where the parcels are (PLN-261118). Null = this payload does not say.
    const shipment = summarizeFulfillments(o.fulfillments);
    const shopifyOrderId = String(o.id);
    // Store the bare number. Webhooks carry `order_number` (1002) while the
    // GraphQL sync only has `name` ("#1002"), so the same order flipped format
    // depending on which path touched it last — that broke guest lookup (an exact
    // string match against what the shopper types) and made the UI, which adds its
    // own '#', render "##1002".
    const orderNumber = (
      o.order_number != null ? String(o.order_number) : o.name ?? shopifyOrderId
    ).replace(/^#/, '');
    const total = money(o.total_price);
    // Breakdown (PLN-260920 P2). `null` when the payload is silent — a minimal
    // orders/updated webhook must not overwrite a known subtotal with nothing,
    // so the assignment below keeps the cached value in that case. Zero is a
    // real answer though (free shipping), which is why this is not `|| null`.
    const subtotal = money(o.subtotal_price);
    const discountTotal = money(o.total_discounts);
    const shippingTotal = money(o.total_shipping_price_set?.shop_money?.amount);
    // Summed QUANTITY, not the number of rows: "Subtotal · 3 items" counts what
    // the shopper bought. Only when the payload actually carries the lines.
    const itemQty = Array.isArray(o.line_items)
      ? o.line_items.reduce((n, li) => n + (li.quantity != null && li.quantity > 0 ? li.quantity : 1), 0)
      : null;

    let row =
      prefetched ??
      (await this.orderRepo.findOne({
        where: { tenantId, provider: SHOPIFY, shopifyOrderId },
      }));
    const isNew = !row;
    if (!row) {
      row = this.orderRepo.create({ provider: SHOPIFY, shopifyOrderId });
    }
    row.tenantId = tenantId;
    // Never downgrade a known link to NULL. A later payload can legitimately carry
    // no customer/email — Shopify redacts protected customer fields until PCD is
    // approved, and an orders/updated webhook can arrive minimal — and blindly
    // assigning `customerId` then unlinked an order the shopper had been seeing,
    // silently: the order stays in the cache but drops out of "my orders" forever,
    // with nothing logged. Resolved wins, otherwise keep what we already knew.
    // Erasure overrides the keep-what-we-knew rule below: the order stays cached for
    // the merchant's books but must not point at the person who asked to be deleted.
    row.customerId = identityErased ? null : customerId ?? row.customerId ?? null;
    row.orderNumber = orderNumber;
    // The rollup only knows "fulfilled"; that every parcel arrived comes from
    // the parcels. A payload silent about them (an order webhook, a store that
    // refused the field) must not pull a delivered order back to In Transit —
    // it used to, on the very next sync.
    const wasDelivered = row.statusInternal === ORDER_STATUS_INTERNAL.DELIVERED;
    const previousStatus = row.statusInternal ?? null;
    const internal =
      rollup !== ORDER_STATUS_INTERNAL.SHIPPING
        ? rollup
        : shipment
          ? shipment.status === FULFILLMENT_STATUS.DELIVERED
            ? ORDER_STATUS_INTERNAL.DELIVERED
            : ORDER_STATUS_INTERNAL.SHIPPING
          : wasDelivered
            ? ORDER_STATUS_INTERNAL.DELIVERED
            : rollup;
    row.statusInternal = internal;
    row.statusUi = internalToUiStatus(internal);
    row.total = total;
    row.subtotal = subtotal ?? row.subtotal ?? null;
    row.discountTotal = discountTotal ?? row.discountTotal ?? null;
    row.shippingTotal = shippingTotal ?? row.shippingTotal ?? null;
    row.itemQty = itemQty ?? row.itemQty ?? null;
    row.currency = o.currency ?? row.currency ?? 'USD';
    // Order-placed time when the payload names it; otherwise keep what we had —
    // the widget's recent-orders window falls back to the cache-insert time.
    if (o.created_at) {
      const placed = new Date(o.created_at);
      if (!Number.isNaN(placed.getTime())) row.orderedAt = placed;
    }
    const saved = await this.orderRepo.save(row);
    await this.syncLineItems(tenantId, saved.id, o);
    if (shipment) await this.syncShipment(saved, shipment);
    await this.noticeOrderEnded(saved, previousStatus, o);

    // Journey breadcrumb (PLN-260807 F3, A-7): only a genuinely NEW cached order
    // with a known customer — orders/updated webhooks and re-sync passes hit the
    // same upsert, and re-emitting would fake repeat purchases on the timeline.
    // Fire-and-forget: a bus hiccup must never fail the webhook/sync path.
    if (isNew && saved.customerId != null) {
      void this.bus
        .publish(EVENTS.CJM, {
          tenantId,
          customerId: saved.customerId,
          stage: CJM_STAGE.PURCHASE,
          eventType: 'order_created',
          payload: { orderNumber: saved.orderNumber },
        })
        .catch((e) => this.logger.warn(`order_created CJM emit failed: ${(e as Error).message}`));
    }
    return saved;
  }

  /**
   * Mirror the order's line items into order_items so the widget can show WHAT
   * was bought (FR-020), not just the total. Replace-on-write keeps the cache in
   * step with edits/refunds that change the cart. `line_items` absent (a payload
   * that simply doesn't carry them) leaves existing rows untouched; an explicit
   * empty array clears them. Never fatal: a failure here must not lose the order.
   */
  private async syncLineItems(
    tenantId: number,
    orderId: number,
    o: ShopifyOrderDto,
  ): Promise<void> {
    if (o.line_items == null) return;
    try {
      const rows = o.line_items
        .map((li) => {
          const priceRaw = li.price;
          const price =
            priceRaw != null && priceRaw !== '' && !Number.isNaN(Number(priceRaw))
              ? Number(priceRaw)
              : null;
          return this.itemRepo.create({
            tenantId,
            orderId,
            productId: li.product_id != null ? String(li.product_id) : null,
            // Shopify webhooks use `title`; some payloads only carry `name`.
            title: (li.title ?? li.name ?? '').slice(0, 255) || 'Item',
            optionText: li.variant_title ? String(li.variant_title).slice(0, 255) : null,
            imageUrl: li.image_url ? String(li.image_url).slice(0, 1024) : null,
            // Over-long URLs are dropped, not truncated — a cut URL is a broken link.
            productUrl: li.product_url && li.product_url.length <= 1024 ? li.product_url : null,
            qty: li.quantity != null && li.quantity > 0 ? li.quantity : 1,
            price,
          });
        });
      await this.itemRepo.delete({ orderId });
      if (rows.length) await this.itemRepo.save(rows);
    } catch (e) {
      this.logger.warn(`Line items for order ${orderId} not cached: ${(e as Error).message}`);
    }
  }

  /**
   * Keep the order's one `fulfillments` row in step with the store's parcels —
   * the same row the fulfillment webhook writes, for a store whose webhooks do
   * not reach us (PLN-261118). Never fatal: a failure here must not lose the order.
   *
   * The shopper hears about it only when the status actually moved, moved
   * recently, and the order is theirs. A sync reads the same order again and
   * again, and a re-sync reads months of them.
   */
  private async syncShipment(order: OrderCache, s: ShipmentSummary): Promise<void> {
    if (!this.fulfillRepo) return;
    try {
      const url = safeTrackingUrl(s.trackingUrl ?? undefined);
      let row = await this.fulfillRepo.findOne({ where: { orderId: order.id } });
      const statusMoved = row?.status !== s.status;
      // IVY PRD v1 N-05: the delivery time the review request counts from. Kept
      // once set — a later read of the same order must not move it.
      const delivered = s.status === FULFILLMENT_STATUS.DELIVERED;
      if (!row) {
        row = this.fulfillRepo.create({
          tenantId: order.tenantId,
          orderId: order.id,
          status: s.status,
          trackingNumber: s.trackingNumber,
          carrier: s.carrier,
          trackingUrl: url,
          deliveredAt: delivered ? (s.deliveredAt ?? new Date()) : null,
        });
      } else {
        const next = {
          trackingNumber: s.trackingNumber ?? row.trackingNumber,
          carrier: s.carrier ?? row.carrier,
          trackingUrl: url ?? row.trackingUrl,
        };
        // A row delivered before the column existed gets its time on the next read.
        const needsDeliveredAt = delivered && row.deliveredAt == null;
        const same =
          !statusMoved &&
          !needsDeliveredAt &&
          next.trackingNumber === row.trackingNumber &&
          next.carrier === row.carrier &&
          next.trackingUrl === row.trackingUrl &&
          row.tenantId != null;
        if (same) return;
        row.status = s.status;
        Object.assign(row, next);
        row.tenantId = row.tenantId ?? order.tenantId;
        if (needsDeliveredAt) row.deliveredAt = s.deliveredAt ?? new Date();
      }
      await this.fulfillRepo.save(row);

      const recent =
        s.changedAt != null && Date.now() - s.changedAt.getTime() <= SHIPMENT_NOTICE_MAX_AGE_MS;
      if (!statusMoved || !recent || order.customerId == null) return;
      const statusUi = order.statusUi ?? s.status;
      await this.bus.publish(EVENTS.NOTIFICATION, {
        tenantId: order.tenantId,
        customerId: order.customerId,
        category: 'shipping',
        title: 'Shipping update',
        body: `Your order ${order.orderNumber} is now ${statusUi}.`,
        statusBadge: statusUi,
        refType: NOTIFICATION_REF.ORDER,
        refId: order.id,
      });
      await this.bus.publish(EVENTS.CJM, {
        tenantId: order.tenantId,
        customerId: order.customerId,
        stage: CJM_STAGE.DELIVERY,
        eventType: 'shipment_update',
        payload: { orderNumber: order.orderNumber, status: s.status },
      });
    } catch (e) {
      this.logger.warn(`Shipment for order ${order.id} not cached: ${(e as Error).message}`);
    }
  }

  /**
   * "Your order was cancelled / refunded" (IVY PRD v1 N-02): once, when the
   * status first becomes one of the two, for an order that is the shopper's,
   * and only when it happened recently — a re-sync reads months of old orders
   * and must not announce a cancellation from last spring. Same window as the
   * shipment notices. Never fatal: the order is already saved.
   */
  private async noticeOrderEnded(order: OrderCache, previousStatus: string | null, o: ShopifyOrderDto): Promise<void> {
    const status = order.statusInternal;
    if (status !== ORDER_STATUS_INTERNAL.CANCELLED && status !== ORDER_STATUS_INTERNAL.REFUNDED) return;
    if (previousStatus === status || order.customerId == null) return;
    const at = Date.parse(
      (status === ORDER_STATUS_INTERNAL.CANCELLED ? o.cancelled_at : o.updated_at) ?? o.updated_at ?? '',
    );
    if (Number.isNaN(at) || Date.now() - at > SHIPMENT_NOTICE_MAX_AGE_MS) return;
    const cancelled = status === ORDER_STATUS_INTERNAL.CANCELLED;
    try {
      await this.bus.publish(EVENTS.NOTIFICATION, {
        tenantId: order.tenantId,
        customerId: order.customerId,
        category: 'payment',
        title: cancelled ? 'Order cancelled' : 'Order refunded',
        body: cancelled
          ? `Your order ${order.orderNumber} was cancelled.`
          : `Your order ${order.orderNumber} was refunded.`,
        statusBadge: cancelled ? ORDER_STATUS_UI.CANCELLED : ORDER_STATUS_UI.REFUNDED,
        refType: NOTIFICATION_REF.ORDER,
        refId: order.id,
      });
    } catch (e) {
      this.logger.warn(`Order ${order.id} ${status} notice not sent: ${(e as Error).message}`);
    }
  }

  /**
   * Shopify order rollup → internal status (POL-014 progression).
   * cancelled → cancelled; fully refunded → refunded (IVY PRD v1 N-02 — a
   * partial refund leaves the order where it was);
   * fulfilled → shipping (In Transit); partially fulfilled → preparing;
   * otherwise (paid/unfulfilled or pending) → paid (Confirmed). Delivered is only
   * reached via fulfillment webhooks (shipment_status=delivered).
   */
  private mapStatus(financial?: string | null, fulfillment?: string | null, cancelledAt?: string | null): string {
    if (cancelledAt) return ORDER_STATUS_INTERNAL.CANCELLED;
    if ((financial ?? '').toLowerCase() === 'refunded') return ORDER_STATUS_INTERNAL.REFUNDED;
    if (fulfillment === 'fulfilled') return ORDER_STATUS_INTERNAL.SHIPPING;
    if (fulfillment === 'partial') return ORDER_STATUS_INTERNAL.PREPARING;
    return ORDER_STATUS_INTERNAL.PAID;
  }

  private async record(
    tenantId: number,
    ok: boolean,
    synced: number,
    detail: string,
    syncedAt?: Date,
  ): Promise<ShopifySyncResult> {
    // Everything lands on this tenant's credential row — state for the
    // platforms tile and dashboard (PLN-261019 D1) and the sync cursor
    // (FIX-261019). Nothing is written to the provider-wide integration_status
    // row any more: it is not tenant-scoped, so it cannot hold either.
    await this.tenantService.recordShopifyOutcome(tenantId, ok, detail, { syncedAt });
    return { ok, synced, detail };
  }
}
