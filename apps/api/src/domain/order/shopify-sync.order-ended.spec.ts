import { ShopifySyncService } from './shopify-sync.service';
import { OrderCache } from './entity/order-cache.entity';
import { EVENTS } from '../../infrastructure/infrastructure.module';

/**
 * Cancelled and refunded orders (IVY PRD v1 N-02, PLN-261125 §2.4): the sync
 * reads Shopify's cancellation and full refund, stores them as the order's
 * status, and tells the shopper once while the change is recent.
 */
describe('ShopifySyncService.upsertOrder — cancelled / refunded', () => {
  const HOUR = 3_600_000;
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  function build(existingOrder?: Partial<OrderCache>) {
    const orders: OrderCache[] = [];
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(existingOrder ? ({ id: 7, ...existingOrder } as OrderCache) : null),
      create: jest.fn((x: Partial<OrderCache>) => ({ ...x }) as OrderCache),
      save: jest.fn((x: OrderCache) => {
        const row = { id: 7, ...x } as OrderCache;
        orders.push(row);
        return Promise.resolve(row);
      }),
    };
    const itemRepo = { create: jest.fn(), delete: jest.fn(), save: jest.fn() };
    const publish = jest.fn(async (_event: string, _payload: unknown) => undefined);
    const svc = new ShopifySyncService(
      orderRepo as never,
      itemRepo as never,
      { fetchOrders: jest.fn() } as never,
      { getShopifyConnection: jest.fn() } as never,
      { findOrCreateByEmail: jest.fn().mockResolvedValue({ id: 42 }), linkPlatform: jest.fn(async () => undefined) } as never,
      { publish } as never,
    );
    const notices = () =>
      publish.mock.calls.filter(([event]) => event === EVENTS.NOTIFICATION).map(([, payload]) => payload as Record<string, unknown>);
    return { svc, orders, notices };
  }

  const order = (extra: Record<string, unknown> = {}) =>
    ({
      id: 1001,
      name: '#IVY-1001',
      email: 'a@x.com',
      financial_status: 'paid',
      fulfillment_status: null,
      total_price: '42.00',
      updated_at: ago(HOUR),
      ...extra,
    }) as never;

  it('a cancelled order is Cancelled and the shopper hears it once, on the Order chip', async () => {
    const { svc, orders, notices } = build({ statusInternal: 'paid', customerId: 42, tenantId: 1 });
    await svc.upsertOrder(1, order({ cancelled_at: ago(HOUR), financial_status: 'voided' }));
    expect(orders[0]).toMatchObject({ statusInternal: 'cancelled', statusUi: 'Cancelled' });
    expect(notices()).toEqual([
      expect.objectContaining({
        customerId: 42,
        category: 'payment',
        statusBadge: 'Cancelled',
        refType: 'order',
        refId: 7,
      }),
    ]);
  });

  it('a full refund is Refunded and noticed; a partial refund changes nothing', async () => {
    const full = build({ statusInternal: 'delivered', customerId: 42, tenantId: 1 });
    await full.svc.upsertOrder(1, order({ financial_status: 'refunded' }));
    expect(full.orders[0]).toMatchObject({ statusInternal: 'refunded', statusUi: 'Refunded' });
    expect(full.notices()).toEqual([expect.objectContaining({ statusBadge: 'Refunded' })]);

    const partial = build({ statusInternal: 'paid', customerId: 42, tenantId: 1 });
    await partial.svc.upsertOrder(1, order({ financial_status: 'partially_refunded' }));
    expect(partial.orders[0]).toMatchObject({ statusInternal: 'paid' });
    expect(partial.notices()).toEqual([]);
  });

  it('cancellation wins over a fulfilled rollup', async () => {
    const { svc, orders } = build({ statusInternal: 'shipping', customerId: 42, tenantId: 1 });
    await svc.upsertOrder(1, order({ cancelled_at: ago(HOUR), fulfillment_status: 'fulfilled' }));
    expect(orders[0].statusInternal).toBe('cancelled');
  });

  it('no second notice when the order was already cancelled', async () => {
    const { svc, notices } = build({ statusInternal: 'cancelled', customerId: 42, tenantId: 1 });
    await svc.upsertOrder(1, order({ cancelled_at: ago(HOUR) }));
    expect(notices()).toEqual([]);
  });

  it('an old cancellation read by a re-sync is stored but not announced', async () => {
    const { svc, orders, notices } = build({ statusInternal: 'paid', customerId: 42, tenantId: 1 });
    await svc.upsertOrder(1, order({ cancelled_at: ago(30 * 24 * HOUR), updated_at: ago(HOUR) }));
    expect(orders[0].statusInternal).toBe('cancelled');
    expect(notices()).toEqual([]);
  });
});
