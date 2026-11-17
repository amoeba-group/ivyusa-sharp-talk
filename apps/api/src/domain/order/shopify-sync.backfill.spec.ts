import { ShopifySyncService } from './shopify-sync.service';
import { OrderCache } from './entity/order-cache.entity';

/**
 * PLN-261117 B3 / BUG-033 — a sync that stops at its page cap must not move the
 * cursor past the orders it never read, and must carry on by itself; the first
 * sync reads a bounded window; one order can be fetched on demand.
 */
describe('ShopifySyncService — resumable sync, initial window, on-demand lookup', () => {
  const PAGE_CAP = 20;

  function order(id: number, updatedAt: string, extra: Record<string, unknown> = {}) {
    return { id, name: `#${id}`, financial_status: 'paid', updated_at: updatedAt, ...extra };
  }

  function build(opts: { cursor?: Date | null; conn?: unknown } = {}) {
    const saved: OrderCache[] = [];
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((x: Partial<OrderCache>) => ({ ...x }) as OrderCache),
      save: jest.fn((x: OrderCache) => {
        saved.push(x);
        return Promise.resolve(x);
      }),
    };
    const itemRepo = {
      create: jest.fn((x: Record<string, unknown>) => ({ ...x })),
      delete: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((rows: unknown[]) => Promise.resolve(rows)),
    };
    const client = { fetchOrders: jest.fn() };
    const tenantService = {
      getShopifyConnection: jest
        .fn()
        .mockResolvedValue(opts.conn === undefined ? { shopDomain: 's.myshopify.com', token: 't' } : opts.conn),
      recordShopifyOutcome: jest.fn().mockResolvedValue(undefined),
      getShopifySyncCursor: jest.fn().mockResolvedValue(opts.cursor ?? null),
      clearShopifySyncCursor: jest.fn().mockResolvedValue(undefined),
    };
    const customerService = {
      findOrCreateByEmail: jest.fn().mockResolvedValue({ id: 42 }),
      linkPlatform: jest.fn(async () => undefined),
    };
    const svc = new ShopifySyncService(
      orderRepo as never,
      itemRepo as never,
      client as never,
      tenantService as never,
      customerService as never,
      { publish: jest.fn(async () => undefined) } as never,
    );
    return { svc, saved, client, tenantService };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('first sync reads only the initial window (60 days), not the whole store', async () => {
    const { svc, client, tenantService } = build();
    client.fetchOrders.mockResolvedValue({ orders: [order(1, '2026-11-01T00:00:00Z')], nextPageInfo: null });
    const before = Date.now();
    const res = await svc.syncOrders(7);

    const since = (client.fetchOrders.mock.calls[0][2] as { updatedAtMin?: string }).updatedAtMin as string;
    const days = (before - new Date(since).getTime()) / 86_400_000;
    expect(days).toBeGreaterThan(59.9);
    expect(days).toBeLessThan(60.1);
    expect(res).toEqual({ ok: true, synced: 1, detail: 'Synced 1 order(s) (first sync, last 60 days)' });
    // Finished: the cursor is "when this run started".
    const syncedAt = (tenantService.recordShopifyOutcome.mock.calls[0][3] as { syncedAt: Date }).syncedAt;
    expect(syncedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('stopping at the cap moves the cursor only to the last order read, then continues in the background', async () => {
    jest.useFakeTimers();
    const { svc, client, tenantService } = build();
    let call = 0;
    client.fetchOrders.mockImplementation(async () => {
      call++;
      // 25 pages in all: the first batch (20) stops at the cap, the second finishes.
      const stamp = new Date(Date.UTC(2026, 9, 1, 0, call)).toISOString();
      return { orders: [order(call, stamp)], nextPageInfo: call < 25 ? `p${call}` : null };
    });

    const res = await svc.syncOrders(7);
    const lastOfBatch = new Date(Date.UTC(2026, 9, 1, 0, PAGE_CAP));
    expect(client.fetchOrders).toHaveBeenCalledTimes(PAGE_CAP);
    expect(res.more).toBe(true);
    expect(res.synced).toBe(PAGE_CAP);
    expect(res.detail).toContain('more remain, continuing in the background');
    // NOT "now": everything after this instant is still unread.
    expect(tenantService.recordShopifyOutcome).toHaveBeenLastCalledWith(7, true, expect.any(String), {
      syncedAt: lastOfBatch,
    });

    // A second "Sync now" while the rest is being read does not start another reader.
    const again = await svc.syncOrders(7);
    expect(again).toMatchObject({ ok: true, synced: 0, more: true });
    expect(client.fetchOrders).toHaveBeenCalledTimes(PAGE_CAP);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(client.fetchOrders).toHaveBeenCalledTimes(25);
    // The continuation starts exactly where the batch stopped — no lookback, no gap.
    const resumed = client.fetchOrders.mock.calls[PAGE_CAP][2] as { updatedAtMin?: string };
    expect(resumed.updatedAtMin).toBe(lastOfBatch.toISOString());
    // Done: the last outcome is a finished run, cursor = its start time.
    const last = tenantService.recordShopifyOutcome.mock.calls.at(-1) as [number, boolean, string, { syncedAt: Date }];
    expect(last[2]).toContain('updated since');
    expect(last[3].syncedAt.getTime()).toBeGreaterThan(lastOfBatch.getTime());

    // And the store can be synced again afterwards.
    client.fetchOrders.mockResolvedValue({ orders: [], nextPageInfo: null });
    await expect(svc.syncOrders(7)).resolves.toMatchObject({ ok: true, synced: 0 });
  });

  it('a batch that makes no progress leaves the cursor alone and does not loop', async () => {
    jest.useFakeTimers();
    const cursor = new Date('2026-10-01T12:00:00Z');
    const { svc, client, tenantService } = build({ cursor });
    // More orders changed in one instant than a batch holds — and that instant
    // is where the window starts, so the batch ends where it began.
    const sameInstant = new Date(cursor.getTime() - 10 * 60_000).toISOString();
    client.fetchOrders.mockImplementation(async () => ({ orders: [order(1, sameInstant)], nextPageInfo: 'next' }));

    const res = await svc.syncOrders(7);
    expect(res.more).toBe(true);
    expect(res.detail).toContain('run the sync again');
    expect(tenantService.recordShopifyOutcome).toHaveBeenLastCalledWith(7, true, expect.any(String), {
      syncedAt: undefined,
    });
    await jest.advanceTimersByTimeAsync(5_000);
    expect(client.fetchOrders).toHaveBeenCalledTimes(PAGE_CAP);
  });

  it('resyncRecent forgets the cursor before syncing', async () => {
    const { svc, client, tenantService } = build({ cursor: new Date('2026-11-10T00:00:00Z') });
    client.fetchOrders.mockResolvedValue({ orders: [], nextPageInfo: null });
    await svc.resyncRecent(7);
    expect(tenantService.clearShopifySyncCursor).toHaveBeenCalledWith(7);
    expect(tenantService.clearShopifySyncCursor.mock.invocationCallOrder[0]).toBeLessThan(
      client.fetchOrders.mock.invocationCallOrder[0],
    );
  });

  it('login backfill asks for the most recent orders first', async () => {
    const { svc, client } = build();
    client.fetchOrders.mockResolvedValue({ orders: [], nextPageInfo: null });
    await svc.syncOrdersForCustomer(7, '5');
    expect(client.fetchOrders.mock.calls[0][2]).toMatchObject({ customerId: '5', newestFirst: true });
  });

  describe('lookupOrderByNumber', () => {
    it('caches only the order asked for, whatever form the number was typed in', async () => {
      const { svc, client, saved } = build();
      client.fetchOrders.mockResolvedValue({
        orders: [order(10, '2026-01-01T00:00:00Z', { name: '#1001' }), order(11, '2026-01-02T00:00:00Z', { name: '#10010' })],
        nextPageInfo: null,
      });
      const rows = await svc.lookupOrderByNumber(7, ' #1001 ');
      expect(client.fetchOrders.mock.calls[0][2]).toMatchObject({ name: ' #1001 ' });
      expect(rows).toHaveLength(1);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ orderNumber: '1001', tenantId: 7 });
    });

    it('with an email, caches nothing unless the order belongs to that email', async () => {
      const { svc, client, saved } = build();
      client.fetchOrders.mockResolvedValue({
        orders: [order(10, '2026-01-01T00:00:00Z', { name: '#1001', email: 'Owner@X.com' })],
        nextPageInfo: null,
      });
      await expect(svc.lookupOrderByNumber(7, '1001', { email: 'someone@else.com' })).resolves.toEqual([]);
      expect(saved).toHaveLength(0);
      await expect(svc.lookupOrderByNumber(7, '1001', { email: ' owner@x.com ' })).resolves.toHaveLength(1);
      expect(saved).toHaveLength(1);
    });

    it('an order whose email the store withholds is not handed to a guest', async () => {
      const { svc, client, saved } = build();
      client.fetchOrders.mockResolvedValue({
        orders: [order(10, '2026-01-01T00:00:00Z', { name: '#1001', email: null })],
        nextPageInfo: null,
      });
      await expect(svc.lookupOrderByNumber(7, '1001', { email: 'a@x.com' })).resolves.toEqual([]);
      expect(saved).toHaveLength(0);
    });

    it('returns nothing without a store connection and does not call out', async () => {
      const { svc, client } = build({ conn: null });
      await expect(svc.lookupOrderByNumber(7, '1001')).resolves.toEqual([]);
      expect(client.fetchOrders).not.toHaveBeenCalled();
    });
  });
});
