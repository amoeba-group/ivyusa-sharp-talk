import { ShopifyProxyService } from './shopify-proxy.service';

/**
 * The link from a vouched-for Shopify customer id to our customer row — shared
 * by the app proxy and the signed-identify path
 * (PLN-261118-IVY-Signed-Shopify-Identity), so the two cannot drift apart.
 */
describe('ShopifyProxyService — linking a Shopify customer', () => {
  function build(opts: { customer?: Record<string, unknown> | null; connected?: boolean } = {}) {
    const customer = opts.customer === undefined ? { id: 9, name: 'Kiho', email: 'k@example.com' } : opts.customer;
    const customerService = {
      findOrCreateByShopifyId: jest.fn(async () => customer),
      linkPlatform: jest.fn(async () => undefined),
      backfillProfileByShopifyId: jest.fn(async () => undefined),
    };
    const tenantService = {
      getShopifyConnection: jest.fn(async () => (opts.connected === false ? null : { shopDomain: 's.myshopify.com', token: 't' })),
    };
    const adminClient = { fetchCustomer: jest.fn(async () => ({ firstName: 'Kiho', lastName: 'Lee', email: 'k@example.com' })) };
    const syncService = { syncOrdersForCustomer: jest.fn(async () => 3) };
    let registered: ((tenantId: number, id: string) => Promise<unknown>) | undefined;
    const embed = {
      registerPlatformIdentity: jest.fn((platform: string, fn: (tenantId: number, id: string) => Promise<unknown>) => {
        if (platform === 'shopify') registered = fn;
      }),
    };
    const svc = new ShopifyProxyService(
      {} as never,
      customerService as never,
      tenantService as never,
      adminClient as never,
      syncService as never,
      embed as never,
    );
    svc.onModuleInit();
    return { svc, customerService, tenantService, adminClient, syncService, resolve: (id: string) => registered!(1, id) };
  }
  const settle = () => new Promise((r) => setImmediate(r));

  it('finds or creates the customer, links the platform and pulls their orders', async () => {
    const h = build();
    const customer = await h.svc.linkCustomer(1, '7001');
    await settle();
    expect(customer).toMatchObject({ id: 9 });
    expect(h.customerService.findOrCreateByShopifyId).toHaveBeenCalledWith(1, '7001');
    expect(h.customerService.linkPlatform).toHaveBeenCalledWith(1, 9, 'shopify', '7001', 'Kiho');
    expect(h.syncService.syncOrdersForCustomer).toHaveBeenCalledWith(1, '7001');
    // Name and email are known: no Admin API call for the profile.
    expect(h.adminClient.fetchCustomer).not.toHaveBeenCalled();
  });

  it('fetches the profile when the row has no name or email yet', async () => {
    const h = build({ customer: { id: 9, name: null, email: null } });
    await h.svc.linkCustomer(1, '7001');
    await settle();
    expect(h.adminClient.fetchCustomer).toHaveBeenCalledWith('s.myshopify.com', 't', '7001');
    expect(h.customerService.backfillProfileByShopifyId).toHaveBeenCalledWith(1, '7001', { email: 'k@example.com', name: 'Kiho Lee' });
  });

  it('an erased customer is not rebuilt: nothing linked, nothing fetched', async () => {
    const h = build({ customer: null });
    expect(await h.svc.linkCustomer(1, '7001')).toBeNull();
    await settle();
    expect(h.customerService.linkPlatform).not.toHaveBeenCalled();
    expect(h.syncService.syncOrdersForCustomer).not.toHaveBeenCalled();
  });

  it('registers the signed-identify resolver, which refuses a tenant with no Shopify connection', async () => {
    const connected = build();
    expect(await connected.resolve('7001')).toMatchObject({ id: 9 });

    const bare = build({ connected: false });
    expect(await bare.resolve('7001')).toBe('not_connected');
    expect(bare.customerService.findOrCreateByShopifyId).not.toHaveBeenCalled();
  });
});
