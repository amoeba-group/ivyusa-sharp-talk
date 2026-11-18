import { ShopifySyncService } from './shopify-sync.service';
import { ShopifyAdminClient } from './shopify-admin.client';
import { summarizeFulfillments } from './shopify-shipment';
import { OrderCache } from './entity/order-cache.entity';
import { Fulfillment } from './entity/fulfillment.entity';
import { EVENTS } from '../../infrastructure/infrastructure.module';

/**
 * Shipment details through the order sync (PLN-261118).
 *
 * The store's webhooks do not reach production (the load balancer turns away
 * non-browser clients), and they were the only writer of the delivered status,
 * the tracking number and the shipping notice. The sync reads the parcels with
 * the orders instead.
 */
describe('summarizeFulfillments', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 18, h)).toISOString();

  it('says nothing when the payload carries no parcels', () => {
    expect(summarizeFulfillments(undefined)).toBeNull();
    expect(summarizeFulfillments(null)).toBeNull();
    expect(summarizeFulfillments([])).toBeNull();
  });

  it('skips cancelled and failed parcels', () => {
    expect(summarizeFulfillments([{ status: 'cancelled', shipment_status: 'delivered' }])).toBeNull();
    const s = summarizeFulfillments([
      { status: 'cancelled', shipment_status: 'delivered', tracking_number: 'OLD' },
      { status: 'success', shipment_status: 'in_transit', tracking_number: 'NEW' },
    ]);
    expect(s).toMatchObject({ status: 'in_transit', trackingNumber: 'NEW' });
  });

  it.each([
    ['delivered', 'delivered'],
    ['in_transit', 'in_transit'],
    ['out_for_delivery', 'in_transit'],
    ['attempted_delivery', 'in_transit'],
    ['label_printed', 'shipped'],
    ['fulfilled', 'shipped'],
    [null, 'shipped'],
  ])('maps shipment status %s → %s', (shipment, expected) => {
    expect(summarizeFulfillments([{ status: 'success', shipment_status: shipment }])?.status).toBe(expected);
  });

  it('is delivered only when every parcel is', () => {
    const two = (a: string, b: string) =>
      summarizeFulfillments([
        { status: 'success', shipment_status: a },
        { status: 'success', shipment_status: b },
      ])?.status;
    expect(two('delivered', 'delivered')).toBe('delivered');
    expect(two('delivered', 'in_transit')).toBe('in_transit');
    expect(two('delivered', 'label_printed')).toBe('in_transit');
    expect(two('label_printed', 'confirmed')).toBe('shipped');
  });

  it('takes tracking from the parcel that changed last, and reports that time', () => {
    const s = summarizeFulfillments([
      { status: 'success', tracking_number: 'A1', tracking_company: 'UPS', updated_at: at(1) },
      { status: 'success', tracking_number: 'B2', tracking_company: 'USPS', tracking_url: 'https://t/B2', updated_at: at(5) },
      { status: 'success', updated_at: at(9) }, // newest, but nothing to track
    ]);
    expect(s).toMatchObject({ trackingNumber: 'B2', carrier: 'USPS', trackingUrl: 'https://t/B2' });
    expect(s?.changedAt?.toISOString()).toBe(at(9));
  });
});

describe('ShopifySyncService.upsertOrder — shipment', () => {
  const HOUR = 3_600_000;
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  function build(existingOrder?: Partial<OrderCache>, existingShipment?: Partial<Fulfillment>) {
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
    const shipments: Fulfillment[] = [];
    const fulfillRepo = {
      findOne: jest.fn().mockResolvedValue(existingShipment ? ({ id: 3, orderId: 7, tenantId: 1, ...existingShipment } as Fulfillment) : null),
      create: jest.fn((x: Partial<Fulfillment>) => ({ ...x }) as Fulfillment),
      save: jest.fn((x: Fulfillment) => {
        shipments.push(x);
        return Promise.resolve(x);
      }),
    };
    const publish = jest.fn(async (_event: string, _payload: unknown) => undefined);
    const svc = new ShopifySyncService(
      orderRepo as never,
      itemRepo as never,
      { fetchOrders: jest.fn() } as never,
      { getShopifyConnection: jest.fn() } as never,
      { findOrCreateByEmail: jest.fn().mockResolvedValue({ id: 42 }), linkPlatform: jest.fn(async () => undefined) } as never,
      { publish } as never,
      fulfillRepo as never,
    );
    const notices = () => publish.mock.calls.filter(([event]) => event === EVENTS.NOTIFICATION);
    return { svc, orders, shipments, fulfillRepo, notices };
  }

  const order = (fulfillments: unknown, extra: Record<string, unknown> = {}) =>
    ({
      id: 1001,
      name: '#IVY-1001',
      email: 'a@x.com',
      financial_status: 'paid',
      fulfillment_status: 'fulfilled',
      total_price: '42.00',
      fulfillments,
      ...extra,
    }) as never;

  it('records the parcel and marks the order delivered', async () => {
    const { svc, orders, shipments } = build();

    await svc.upsertOrder(
      1,
      order([{ status: 'success', shipment_status: 'delivered', tracking_number: '1Z999', tracking_company: 'UPS', tracking_url: 'https://ups.example/1Z999', updated_at: ago(HOUR) }]),
    );

    expect(orders[0]).toMatchObject({ statusInternal: 'delivered', statusUi: 'Delivered' });
    expect(shipments[0]).toMatchObject({
      tenantId: 1,
      orderId: 7,
      status: 'delivered',
      trackingNumber: '1Z999',
      carrier: 'UPS',
      trackingUrl: 'https://ups.example/1Z999',
    });
  });

  it('keeps a shipped order In Transit until the parcel arrives', async () => {
    const { svc, orders, shipments } = build();
    await svc.upsertOrder(1, order([{ status: 'success', shipment_status: 'in_transit', updated_at: ago(HOUR) }]));
    expect(orders[0].statusInternal).toBe('shipping');
    expect(shipments[0].status).toBe('in_transit');
  });

  it('does not pull a delivered order back when the payload is silent about parcels', async () => {
    const { svc, orders, fulfillRepo } = build({ statusInternal: 'delivered', statusUi: 'Delivered', tenantId: 1 });
    await svc.upsertOrder(1, order(undefined));
    expect(orders[0].statusInternal).toBe('delivered');
    expect(fulfillRepo.save).not.toHaveBeenCalled();
  });

  it('follows the store when the parcels say the order is not delivered after all', async () => {
    const { svc, orders } = build({ statusInternal: 'delivered', tenantId: 1 });
    await svc.upsertOrder(1, order([{ status: 'success', shipment_status: 'in_transit', updated_at: ago(HOUR) }]));
    expect(orders[0].statusInternal).toBe('shipping');
  });

  it('leaves a partly fulfilled order as Preparing', async () => {
    const { svc, orders } = build();
    await svc.upsertOrder(
      1,
      order([{ status: 'success', shipment_status: 'delivered', updated_at: ago(HOUR) }], { fulfillment_status: 'partial' }),
    );
    expect(orders[0].statusInternal).toBe('preparing');
  });

  describe('shipping notice', () => {
    const delivered = (updatedAt: string) => [{ status: 'success', shipment_status: 'delivered', updated_at: updatedAt }];

    it('is sent when the status moved recently', async () => {
      const { svc, notices } = build(undefined, { status: 'in_transit' });
      await svc.upsertOrder(1, order(delivered(ago(HOUR))));
      expect(notices()).toHaveLength(1);
      expect(notices()[0][1]).toMatchObject({
        tenantId: 1,
        customerId: 42,
        category: 'shipping',
        body: 'Your order IVY-1001 is now Delivered.',
        refType: 'order',
        refId: 7,
      });
    });

    it('is sent for a parcel seen for the first time, if recent', async () => {
      const { svc, notices } = build();
      await svc.upsertOrder(1, order(delivered(ago(HOUR))));
      expect(notices()).toHaveLength(1);
    });

    it('is not sent when the same status is read again', async () => {
      const { svc, notices, fulfillRepo } = build(undefined, { status: 'delivered' });
      await svc.upsertOrder(1, order(delivered(ago(HOUR))));
      expect(notices()).toHaveLength(0);
      expect(fulfillRepo.save).not.toHaveBeenCalled();
    });

    it('is not sent for a change older than 48 hours (re-reading history)', async () => {
      const { svc, notices, shipments } = build();
      await svc.upsertOrder(1, order(delivered(ago(49 * HOUR))));
      expect(shipments).toHaveLength(1); // still recorded
      expect(notices()).toHaveLength(0);
    });

    it('is not sent when the store did not date the change', async () => {
      const { svc, notices } = build();
      await svc.upsertOrder(1, order([{ status: 'success', shipment_status: 'delivered' }]));
      expect(notices()).toHaveLength(0);
    });

    it('is not sent for an order with no customer', async () => {
      const { svc, notices, shipments } = build();
      await svc.upsertOrder(1, order(delivered(ago(HOUR)), { email: null, customer: null }));
      expect(shipments).toHaveLength(1);
      expect(notices()).toHaveLength(0);
    });

    it('updates tracking without a notice when only the number changed', async () => {
      const { svc, notices, shipments } = build(undefined, { status: 'delivered', trackingNumber: 'OLD' });
      await svc.upsertOrder(
        1,
        order([{ status: 'success', shipment_status: 'delivered', tracking_number: 'NEW', updated_at: ago(HOUR) }]),
      );
      expect(shipments[0].trackingNumber).toBe('NEW');
      expect(notices()).toHaveLength(0);
    });
  });
});

describe('ShopifyAdminClient — parcels in the orders query', () => {
  const page = (withParcels: boolean) => ({
    data: {
      orders: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [
          {
            legacyResourceId: '1005',
            name: '#1005',
            ...(withParcels
              ? {
                  fulfillments: [
                    {
                      status: 'SUCCESS',
                      displayStatus: 'OUT_FOR_DELIVERY',
                      updatedAt: '2026-11-18T03:00:00Z',
                      deliveredAt: null,
                      trackingInfo: [{ number: '9400', company: 'USPS', url: 'https://usps.example/9400' }],
                    },
                  ],
                }
              : {}),
          },
        ],
      },
    },
  });

  function client(behaviour: (attempt: number, query: string) => unknown) {
    const c = new ShopifyAdminClient();
    const queries: string[] = [];
    (c as unknown as { gql: unknown }).gql = jest.fn(async (_shop: string, _token: string, query: string) => {
      queries.push(query);
      const out = behaviour(queries.length, query);
      if (out instanceof Error) throw out;
      return out;
    });
    return { c, queries };
  }

  it('asks for the parcels and maps them onto the webhook field names', async () => {
    const { c, queries } = client(() => page(true));
    const { orders } = await c.fetchOrders('s.myshopify.com', 't');
    expect(queries[0]).toContain('fulfillments(first: 5)');
    expect(orders[0].fulfillments).toEqual([
      {
        status: 'success',
        shipment_status: 'out_for_delivery',
        tracking_number: '9400',
        tracking_company: 'USPS',
        tracking_url: 'https://usps.example/9400',
        updated_at: '2026-11-18T03:00:00Z',
        delivered_at: null,
      },
    ]);
  });

  it.each([
    ['no access to the field', new Error('Admin API error: Access denied for fulfillments field')],
    ['the query costs too much', new Error('Admin API error: Query cost is 1210, which exceeds the single query max cost limit (1000)')],
    ['the API version lacks a field', new Error("Admin API error: Field 'deliveredAt' doesn't exist on type 'Fulfillment'")],
  ])('drops only the parcels when %s, keeping the line-item tier', async (_why, refusal) => {
    const { c, queries } = client((attempt) => (attempt === 1 ? refusal : page(false)));
    const { orders } = await c.fetchOrders('s.myshopify.com', 't');
    expect(queries).toHaveLength(2);
    expect(queries[1]).not.toContain('fulfillments(');
    expect(queries[1]).toContain('variant {'); // still the rich tier
    expect(orders[0].fulfillments).toBeUndefined();
  });

  it('does not ask a store that refused again within the hour', async () => {
    const { c, queries } = client((attempt) =>
      attempt === 1 ? new Error('Admin API error: Access denied for fulfillments field') : page(false),
    );
    await c.fetchOrders('s.myshopify.com', 't');
    await c.fetchOrders('s.myshopify.com', 't');
    expect(queries).toHaveLength(3);
    expect(queries[2]).not.toContain('fulfillments(');
  });

  it('does not retry on a transport failure', async () => {
    const { c, queries } = client(() => new Error('Admin API returned 502'));
    await expect(c.fetchOrders('s.myshopify.com', 't')).rejects.toThrow('502');
    expect(queries).toHaveLength(1);
  });

  it('does not blame the parcels when the store fails without them too', async () => {
    let throttled = true;
    const { c, queries } = client(() => (throttled ? new Error('Admin API error: Throttled') : page(true)));
    await expect(c.fetchOrders('s.myshopify.com', 't')).rejects.toThrow('Throttled');
    throttled = false;
    await c.fetchOrders('s.myshopify.com', 't');
    expect(queries[queries.length - 1]).toContain('fulfillments(first: 5)');
  });

  it('still steps the line-item tier down on a line-item denial, parcels kept', async () => {
    const { c, queries } = client((attempt) =>
      attempt === 1 ? new Error('Admin API error: Access denied for variant field') : page(true),
    );
    await c.fetchOrders('s.myshopify.com', 't');
    expect(queries[1]).not.toContain('variant {');
    expect(queries[1]).toContain('fulfillments(first: 5)');
  });
});
