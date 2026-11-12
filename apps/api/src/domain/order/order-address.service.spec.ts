import { Repository } from 'typeorm';
import { ADDRESS_TIMEOUT_MS, OrderAddressService } from './order-address.service';
import { OrderCache } from './entity/order-cache.entity';
import { OrderMapper } from './order.mapper';
import { ShopifyAdminClient } from './shopify-admin.client';
import { SessionService } from '../session/session.service';
import { TenantService } from '../tenant/tenant.service';

/**
 * Order Detail addresses (ivy-docs T04 D1): read live from Shopify, never
 * stored, and never an error for the store's sake — only "not yours" is.
 */
const SHIPPING = {
  name: 'Hyein Kim',
  address1: '25 HARBOR PARK DR',
  address2: '',
  city: 'PORT WASHINGTON',
  province: 'New York',
  zip: '11050-4605',
  country: 'United States',
  countryCodeV2: 'US',
  phone: '123123123',
};

describe('ShopifyAdminClient.fetchOrderAddresses', () => {
  function client(answer: unknown) {
    const c = new ShopifyAdminClient();
    const calls: Array<{ query: string; vars: Record<string, unknown> }> = [];
    (c as unknown as { gql: unknown }).gql = jest.fn(
      async (_s: string, _t: string, query: string, vars: Record<string, unknown>) => {
        calls.push({ query, vars });
        if (answer instanceof Error) throw answer;
        return answer;
      },
    );
    return { c, calls };
  }

  it('asks for exactly one order by its gid and returns both addresses', async () => {
    const { c, calls } = client({ data: { order: { shippingAddress: SHIPPING, billingAddress: null } } });
    await expect(c.fetchOrderAddresses('shop.myshopify.com', 'tok', '820982911946154508')).resolves.toEqual({
      shipping: SHIPPING,
      billing: null,
    });
    expect(calls[0].vars).toEqual({ id: 'gid://shopify/Order/820982911946154508' });
    expect(calls[0].query).toMatch(/shippingAddress \{[^}]*phone/);
    expect(calls[0].query).toMatch(/billingAddress \{/);
  });

  it('a protected-customer-data refusal is "denied", not an error', async () => {
    for (const msg of [
      'Admin API error: This app is not approved to access the Order object. See https://partners.shopify.com',
      'Admin API error: Access denied for shippingAddress field.',
    ]) {
      const { c } = client(new Error(msg));
      await expect(c.fetchOrderAddresses('s', 't', '1')).resolves.toBe('denied');
    }
  });

  it('other failures still throw; an unknown order is null', async () => {
    await expect(client(new Error('Admin API returned 503')).c.fetchOrderAddresses('s', 't', '1')).rejects.toThrow('503');
    await expect(client({ data: { order: null } }).c.fetchOrderAddresses('s', 't', '1')).resolves.toBeNull();
  });
});

describe('OrderMapper.toAddress', () => {
  it('maps Shopify fields, blanks become null, the country code is upper-case', () => {
    expect(OrderMapper.toAddress({ ...SHIPPING, countryCodeV2: 'us' })).toEqual({
      name: 'Hyein Kim',
      address1: '25 HARBOR PARK DR',
      address2: null,
      city: 'PORT WASHINGTON',
      province: 'New York',
      zip: '11050-4605',
      country: 'United States',
      countryCode: 'US',
      phone: '123123123',
    });
  });

  it('no address, or one with every line blank, is null', () => {
    expect(OrderMapper.toAddress(null)).toBeNull();
    expect(OrderMapper.toAddress({ name: ' ', address1: '', city: null })).toBeNull();
  });
});

describe('OrderAddressService.addressesForSession', () => {
  const ORDER = { id: 5, tenantId: 1, customerId: 42, provider: 'shopify', shopifyOrderId: '9001' } as OrderCache;

  function build(opts: {
    order?: Partial<OrderCache> | null;
    conn?: { shopDomain: string; token: string } | null;
    read?: () => Promise<unknown>;
  } = {}) {
    const order = opts.order === null ? null : { ...ORDER, ...(opts.order ?? {}) };
    const fetchOrderAddresses = jest.fn(opts.read ?? (async () => ({ shipping: SHIPPING, billing: null })));
    const getShopifyConnection = jest.fn(async () =>
      opts.conn === undefined ? { shopDomain: 'ivyusa.myshopify.com', token: 'shpat' } : opts.conn,
    );
    const svc = new OrderAddressService(
      { findOne: jest.fn(async () => order) } as unknown as Repository<OrderCache>,
      { requireCustomerId: jest.fn(async () => 42) } as unknown as SessionService,
      { getShopifyConnection } as unknown as TenantService,
      { fetchOrderAddresses } as unknown as ShopifyAdminClient,
    );
    return { svc, fetchOrderAddresses, getShopifyConnection };
  }

  it("returns the order's addresses from the tenant's own store", async () => {
    const { svc, fetchOrderAddresses, getShopifyConnection } = build();
    const r = await svc.addressesForSession('tok', 5);
    expect(r.available).toBe(true);
    expect(r.billing).toBeNull();
    expect(r.shipping).toMatchObject({ address1: '25 HARBOR PARK DR', countryCode: 'US', phone: '123123123' });
    expect(getShopifyConnection).toHaveBeenCalledWith(1);
    expect(fetchOrderAddresses).toHaveBeenCalledWith('ivyusa.myshopify.com', 'shpat', '9001');
  });

  it("someone else's order, or no order, is the same 404 as the detail", async () => {
    await expect(build({ order: { customerId: 7 } }).svc.addressesForSession('tok', 5)).rejects.toMatchObject({
      status: 404,
    });
    await expect(build({ order: null }).svc.addressesForSession('tok', 5)).rejects.toMatchObject({ status: 404 });
  });

  it('not a Shopify order, or no store connection → unavailable, without calling Shopify', async () => {
    const cafe24 = build({ order: { provider: 'cafe24' } });
    await expect(cafe24.svc.addressesForSession('tok', 5)).resolves.toEqual({ available: false, billing: null, shipping: null });
    expect(cafe24.fetchOrderAddresses).not.toHaveBeenCalled();

    const noConn = build({ conn: null });
    await expect(noConn.svc.addressesForSession('tok', 5)).resolves.toMatchObject({ available: false });
    expect(noConn.fetchOrderAddresses).not.toHaveBeenCalled();
  });

  it('access not granted, store error or unknown order → unavailable, never a 500', async () => {
    for (const read of [async () => 'denied', async () => null, async () => { throw new Error('Admin API returned 502'); }]) {
      await expect(build({ read }).svc.addressesForSession('tok', 5)).resolves.toEqual({
        available: false,
        billing: null,
        shipping: null,
      });
    }
  });

  it(`gives up after ${ADDRESS_TIMEOUT_MS} ms`, async () => {
    jest.useFakeTimers();
    try {
      const { svc } = build({ read: () => new Promise(() => {}) });
      const pending = svc.addressesForSession('tok', 5);
      await jest.advanceTimersByTimeAsync(ADDRESS_TIMEOUT_MS);
      await expect(pending).resolves.toMatchObject({ available: false });
    } finally {
      jest.useRealTimers();
    }
  });
});
