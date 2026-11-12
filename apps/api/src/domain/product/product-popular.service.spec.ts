import { ProductPopularService, POPULAR_SIZE, POPULAR_TIMEOUT_MS, popularCacheKey } from './product-popular.service';
import { ShopifyAdminClient } from '../order/shopify-admin.client';

/** "Popular products" (ivy-docs T10 D3): configured collections only, cached, never throws for the store. */
describe('ProductPopularService', () => {
  const card = { handle: 'gel', title: 'Gel Polish Starter Set', vendor: 'KISS', price: 24.99, currency: 'USD', imageUrl: null, productUrl: 'https://ivyusa.com/products/gel' };

  function build(opts: { categories?: string[]; enabled?: boolean; conn?: boolean; storefrontUrl?: string | null } = {}) {
    const cache = new Map<string, { v: string; ttl?: number }>();
    const redis = {
      get: jest.fn(async (k: string) => cache.get(k)?.v ?? null),
      set: jest.fn(async (k: string, v: string, ttl?: number) => void cache.set(k, { v, ttl })),
    };
    const config = {
      scenarioButtons: [
        {
          id: 'product_inquiry',
          action: 'product_help',
          enabled: opts.enabled ?? true,
          label: 'Product inquiry',
          categories: (opts.categories ?? ['nails']).map((id) => ({ id, label: id })),
        },
      ],
    };
    const client = { fetchCollectionBestSellers: jest.fn(async () => [card]) };
    const tenantService = {
      getShopifyConnection: jest.fn(async () => (opts.conn === false ? null : { shopDomain: 'ivyusa.myshopify.com', token: 't' })),
    };
    const svc = new ProductPopularService(
      { findOne: jest.fn(async () => config) } as never,
      {
        findOne: jest.fn(async () => ({ id: 1, shopDomain: 'ivyusa.myshopify.com', storefrontUrl: opts.storefrontUrl === undefined ? 'https://ivyusa.com' : opts.storefrontUrl })),
      } as never,
      { findByToken: jest.fn(async () => ({ tenantId: 1 })) } as never,
      tenantService as never,
      client as never,
      redis as never,
    );
    return { svc, client, cache, tenantService };
  }

  it('serves the store best sellers for a configured collection, with the storefront link', async () => {
    const { svc, client } = build();
    const res = await svc.popularForSession('tok', ' Nails ');
    expect(res).toEqual({
      available: true,
      products: [card],
      collectionUrl: 'https://ivyusa.com/collections/nails?sort_by=best-selling',
    });
    expect(client.fetchCollectionBestSellers).toHaveBeenCalledWith('ivyusa.myshopify.com', 't', 'nails', POPULAR_SIZE);
  });

  it('answers a repeat from the cache (15 minutes) without asking the store', async () => {
    const { svc, client, cache } = build();
    await svc.popularForSession('tok', 'nails');
    await svc.popularForSession('tok', 'nails');
    expect(client.fetchCollectionBestSellers).toHaveBeenCalledTimes(1);
    expect(cache.get(popularCacheKey(1, 'nails'))?.ttl).toBe(900);
  });

  it('refuses a collection the tenant did not configure, or one on a disabled button', async () => {
    await expect(build().svc.popularForSession('tok', 'admin-secret')).rejects.toMatchObject({ status: 400 });
    await expect(build().svc.popularForSession('tok', undefined)).rejects.toMatchObject({ status: 400 });
    await expect(build({ enabled: false }).svc.popularForSession('tok', 'nails')).rejects.toMatchObject({ status: 400 });
  });

  it('a store error or a missing connection is "unavailable", remembered for a minute only', async () => {
    const failing = build();
    failing.client.fetchCollectionBestSellers.mockRejectedValueOnce(new Error('Admin API returned 503'));
    const res = await failing.svc.popularForSession('tok', 'nails');
    expect(res).toEqual({ available: false, products: [], collectionUrl: 'https://ivyusa.com/collections/nails?sort_by=best-selling' });
    expect(failing.cache.get(popularCacheKey(1, 'nails'))?.ttl).toBe(60);

    const unconnected = build({ conn: false, storefrontUrl: null });
    expect(await unconnected.svc.popularForSession('tok', 'nails')).toEqual({
      available: false,
      products: [],
      // No storefront URL set: the shop's own domain still reaches the store.
      collectionUrl: 'https://ivyusa.myshopify.com/collections/nails?sort_by=best-selling',
    });
  });

  it('gives up after the timeout instead of holding the chat', async () => {
    jest.useFakeTimers();
    try {
      const { svc, client } = build();
      client.fetchCollectionBestSellers.mockImplementationOnce(() => new Promise(() => undefined));
      const pending = svc.popularForSession('tok', 'nails');
      await jest.advanceTimersByTimeAsync(POPULAR_TIMEOUT_MS + 1);
      expect((await pending).available).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ShopifyAdminClient.fetchCollectionBestSellers', () => {
  const node = (over: Record<string, unknown> = {}) => ({
    handle: 'gel',
    title: 'Gel Polish Starter Set',
    vendor: 'KISS ',
    status: 'ACTIVE',
    onlineStoreUrl: 'https://ivyusa.com/products/gel',
    featuredMedia: { preview: { image: { url: 'https://cdn.shopify.com/gel.jpg' } } },
    priceRangeV2: { minVariantPrice: { amount: '24.99', currencyCode: 'USD' } },
    ...over,
  });

  function stub(body: unknown) {
    const client = new ShopifyAdminClient();
    const gql = jest.spyOn(client as never as { gql: () => Promise<unknown> }, 'gql').mockResolvedValue(body);
    return { client, gql };
  }

  it('keeps active, published products in best-selling order, up to the limit', async () => {
    const { client, gql } = stub({
      data: {
        collectionByIdentifier: {
          products: {
            nodes: [
              node(),
              node({ handle: 'draft', status: 'DRAFT' }),
              node({ handle: 'hidden', onlineStoreUrl: null }),
              node({ handle: 'b', title: 'B', featuredMedia: null, priceRangeV2: null, vendor: '' }),
              node({ handle: 'c', title: 'C' }),
            ],
          },
        },
      },
    });
    const rows = await client.fetchCollectionBestSellers('s.myshopify.com', 't', 'nails', 2);
    expect(rows).toEqual([
      { handle: 'gel', title: 'Gel Polish Starter Set', vendor: 'KISS', price: 24.99, currency: 'USD', imageUrl: 'https://cdn.shopify.com/gel.jpg', productUrl: 'https://ivyusa.com/products/gel' },
      { handle: 'b', title: 'B', vendor: null, price: null, currency: null, imageUrl: null, productUrl: 'https://ivyusa.com/products/gel' },
    ]);
    expect(gql.mock.calls[0]).toEqual(['s.myshopify.com', 't', expect.stringContaining('sortKey: BEST_SELLING'), { handle: 'nails', first: 6 }]);
  });

  it('null when the store has no such collection', async () => {
    const { client } = stub({ data: { collectionByIdentifier: null } });
    expect(await client.fetchCollectionBestSellers('s', 't', 'nope', 5)).toBeNull();
  });
});
