import { RetentionService } from './retention.service';

/**
 * PLN-261117-Order-Cache-Purge — cached orders past the window that nothing
 * else points at are disposable; deleting them is opt-in, a run without the
 * switch only reports the count.
 */
describe('RetentionService — order cache', () => {
  const day = 24 * 60 * 60 * 1000;

  function build(env: Record<string, string | number>, eligibleIds: number[], withOrderRepo = true) {
    let remaining = [...eligibleIds];
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const trxQueries: Array<{ sql: string; params: unknown[] }> = [];
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        if (/^SELECT COUNT/.test(sql)) return [{ n: String(remaining.length) }];
        const limit = Number(/LIMIT (\d+)/.exec(sql)?.[1] ?? 0);
        return remaining.slice(0, limit).map((id) => ({ id: String(id) }));
      }),
      transaction: jest.fn(async (fn: (trx: { query: jest.Mock }) => Promise<void>) => {
        const trx = {
          query: jest.fn(async (sql: string, params: unknown[]) => {
            trxQueries.push({ sql, params });
            if (/DELETE FROM orders_cache/.test(sql)) {
              const ids = new Set((params[0] as string[]).map(Number));
              remaining = remaining.filter((id) => !ids.has(id));
            }
          }),
        };
        await fn(trx);
      }),
    };
    const repo = () => ({
      delete: jest.fn(async () => ({ affected: 0 })),
      createQueryBuilder: () => ({
        delete: function () { return this; },
        where: function () { return this; },
        andWhere: function () { return this; },
        execute: async () => ({ affected: 0 }),
      }),
    });
    const audits: Array<{ metadata: Record<string, unknown> }> = [];
    const svc = new RetentionService(
      repo() as never, repo() as never, repo() as never, repo() as never,
      repo() as never, repo() as never, repo() as never, repo() as never,
      { get: (k: string, d: unknown) => env[k] ?? d } as never,
      { write: jest.fn(async (a: { metadata: Record<string, unknown> }) => audits.push(a)) } as never,
      { deleteOlderThan: jest.fn(async () => 0), purgeUnattached: jest.fn(async () => 0) } as never,
      (withOrderRepo ? { manager } : undefined) as never,
    );
    return { svc, manager, queries, trxQueries, audits, left: () => remaining };
  }

  it('by default only reports how many orders it would take — nothing is deleted', async () => {
    const { svc, manager, audits, left } = build({}, [1, 2, 3]);
    const res = await svc.purgeExpired();
    expect(res).toMatchObject({ orderCacheRetentionDays: 180, orderCachePurgeEnabled: false, ordersEligible: 3, orders: 0 });
    expect(manager.transaction).not.toHaveBeenCalled();
    expect(left()).toEqual([1, 2, 3]);
    // The operator reads the number in the audit log before switching it on.
    expect(audits[0].metadata).toMatchObject({ ordersEligible: 3, orders: 0, orderCachePurgeEnabled: false });
  });

  it('the window is 180 days, on both the order date and the last update', async () => {
    const { svc, queries } = build({}, []);
    const before = Date.now();
    await svc.purgeExpired();
    const count = queries.find((q) => /^SELECT COUNT/.test(q.sql))!;
    expect(count.params).toHaveLength(2);
    for (const p of count.params as Date[]) {
      const age = (before - p.getTime()) / day;
      expect(age).toBeGreaterThan(179.9);
      expect(age).toBeLessThan(180.1);
    }
    expect(count.sql).toContain('COALESCE(o.ordered_at, o.created_at) < ?');
    expect(count.sql).toContain('o.updated_at < ?');
  });

  it('keeps an order that an inquiry, a notification or a review still points at', async () => {
    const { svc, queries } = build({}, []);
    await svc.purgeExpired();
    const sql = queries[0].sql.replace(/\s+/g, ' ');
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM inquiries i WHERE i.order_id = o.id)');
    expect(sql).toContain("n.ref_type = 'order' AND n.ref_id = o.id");
    expect(sql).toContain("n.ref_type = 'order_item' AND n.ref_id = oi.id");
    expect(sql).toContain('JOIN reviews r ON r.order_item_id = oi.id');
  });

  it('when enabled, deletes fulfillments, then items, then the orders, in batches', async () => {
    const ids = Array.from({ length: 1200 }, (_, i) => i + 1);
    const { svc, manager, trxQueries, left } = build({ ORDER_CACHE_PURGE_ENABLED: 'true' }, ids);
    const res = await svc.purgeExpired();
    expect(res).toMatchObject({ orderCachePurgeEnabled: true, ordersEligible: 1200, orders: 1200 });
    expect(left()).toEqual([]);
    expect(manager.transaction).toHaveBeenCalledTimes(3); // 500 + 500 + 200
    expect(trxQueries.slice(0, 3).map((q) => q.sql)).toEqual([
      'DELETE FROM fulfillments WHERE order_id IN (?)',
      'DELETE FROM order_items WHERE order_id IN (?)',
      'DELETE FROM orders_cache WHERE id IN (?)',
    ]);
    expect((trxQueries[0].params[0] as string[]).length).toBe(500);
  });

  it('honours ORDER_CACHE_RETENTION_DAYS, and falls back to 180 on a bad value', async () => {
    const a = await build({ ORDER_CACHE_RETENTION_DAYS: 365 }, []).svc.purgeExpired();
    expect(a.orderCacheRetentionDays).toBe(365);
    const b = await build({ ORDER_CACHE_RETENTION_DAYS: 'soon' }, []).svc.purgeExpired();
    expect(b.orderCacheRetentionDays).toBe(180);
    const c = await build({ ORDER_CACHE_RETENTION_DAYS: 0 }, []).svc.purgeExpired();
    expect(c.orderCacheRetentionDays).toBe(180);
  });

  it('a build without the order repository reports nothing and does not fail', async () => {
    const res = await build({ ORDER_CACHE_PURGE_ENABLED: 'true' }, [1], false).svc.purgeExpired();
    expect(res).toMatchObject({ ordersEligible: 0, orders: 0 });
  });
});
