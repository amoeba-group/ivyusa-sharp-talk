import { LIVE_LOOKUP_MAX, LIVE_TIMEOUT_MS, ProductLiveService } from './product-live.service';
import { toLiveProduct, type ShopifyLiveProduct } from '../order/shopify-admin.client';

/** Store data for a typed product question (PLN-261126). */
describe('ProductLiveService.lookup', () => {
  const product = (handle: string): ShopifyLiveProduct => ({
    handle,
    title: handle,
    onSale: true,
    inStock: true,
    priceMin: 9.99,
    priceMax: 9.99,
    currency: 'USD',
    imageUrl: null,
    productUrl: `https://ivyusa.com/products/${handle}`,
    variants: [],
  });

  function build(opts: { conn?: boolean; connThrows?: boolean; storeThrows?: boolean; cached?: string | null } = {}) {
    const tenantService = {
      getShopifyConnection: jest.fn(async () => {
        if (opts.connThrows) throw new Error('refresh failed');
        return opts.conn === false ? null : { shopDomain: 'ivyusa.myshopify.com', token: 'shpat_x' };
      }),
    };
    const client = {
      fetchLiveProducts: jest.fn(async (_d: string, _t: string, handles: readonly string[]) => {
        if (opts.storeThrows) throw new Error('THROTTLED');
        return new Map(handles.map((h) => [h, product(h)]));
      }),
    };
    const redis = { get: jest.fn(async () => opts.cached ?? null), set: jest.fn(async () => undefined) };
    const svc = new ProductLiveService(tenantService as never, client as never, redis as never, {} as never);
    return { svc, tenantService, client, redis };
  }

  it('reads the store once, deduplicated and lower-cased, and caches the answer for 2 minutes', async () => {
    const b = build();
    const res = await b.svc.lookup(4, ['Gel-Kit', 'gel-kit', 'lash-glue']);
    expect(b.client.fetchLiveProducts).toHaveBeenCalledWith('ivyusa.myshopify.com', 'shpat_x', ['gel-kit', 'lash-glue']);
    expect(res).toEqual({ ok: true, products: new Map([['gel-kit', product('gel-kit')], ['lash-glue', product('lash-glue')]]) });
    expect(b.redis.set).toHaveBeenCalledWith('live:v1:4:gel-kit,lash-glue', expect.any(String), 120);
  });

  it(`asks about ${LIVE_LOOKUP_MAX} products at most`, async () => {
    const b = build();
    await b.svc.lookup(4, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(b.client.fetchLiveProducts.mock.calls[0][2]).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('a cached answer is served without a store call', async () => {
    const cached = JSON.stringify([['gel-kit', product('gel-kit')]]);
    const b = build({ cached });
    const res = await b.svc.lookup(4, ['gel-kit']);
    expect(b.client.fetchLiveProducts).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, products: new Map([['gel-kit', product('gel-kit')]]) });
  });

  it('a broken cache entry is a miss', async () => {
    const b = build({ cached: '{not json' });
    await b.svc.lookup(4, ['gel-kit']);
    expect(b.client.fetchLiveProducts).toHaveBeenCalled();
  });

  it('null when no store is connected — the answer is then built exactly as before', async () => {
    const b = build({ conn: false });
    await expect(b.svc.lookup(4, ['gel-kit'])).resolves.toBeNull();
    expect(b.client.fetchLiveProducts).not.toHaveBeenCalled();
  });

  it('ok: false when the store cannot be read, or its token cannot be refreshed', async () => {
    await expect(build({ storeThrows: true }).svc.lookup(4, ['gel-kit'])).resolves.toEqual({ ok: false });
    await expect(build({ connThrows: true }).svc.lookup(4, ['gel-kit'])).resolves.toEqual({ ok: false });
  });

  it(`a store that does not answer within ${LIVE_TIMEOUT_MS} ms is a store that could not be read`, async () => {
    jest.useFakeTimers();
    try {
      const b = build();
      b.client.fetchLiveProducts.mockImplementationOnce(() => new Promise(() => undefined));
      const pending = b.svc.lookup(4, ['gel-kit']);
      await jest.advanceTimersByTimeAsync(LIVE_TIMEOUT_MS);
      await expect(pending).resolves.toEqual({ ok: false });
      expect(b.redis.set).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('nothing to ask about: an empty answer, no store call', async () => {
    const b = build();
    await expect(b.svc.lookup(4, [' '])).resolves.toEqual({ ok: true, products: new Map() });
    expect(b.client.fetchLiveProducts).not.toHaveBeenCalled();
  });
});

/** The storefront's products as names, for the colour a question names (PLN-261127). */
describe('ProductLiveService.catalogue', () => {
  function build(rows: Array<{ handle: string; title: string }>, store: 'connected' | 'none' | 'throws' = 'connected') {
    const repo = { find: jest.fn(async () => rows) };
    const tenantService = {
      getShopifyConnection: jest.fn(async () => {
        if (store === 'throws') throw new Error('refresh failed');
        return store === 'none' ? null : { shopDomain: 'ivyusa.myshopify.com', token: 'shpat_x' };
      }),
    };
    const svc = new ProductLiveService(tenantService as never, {} as never, {} as never, repo as never);
    return { svc, repo };
  }

  it('no store connected: no names, so the answer is built exactly as before (a Cafe24 mall has a catalogue too)', async () => {
    const { svc, repo } = build([{ handle: 'a', title: 'KISS imPRESS Color Press On Nails - Cosmic' }], 'none');
    await expect(svc.catalogue(4)).resolves.toEqual([]);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('a store whose token cannot be refreshed right now is still a store', async () => {
    const { svc } = build([{ handle: 'a', title: 'KISS imPRESS Color Press On Nails - Cosmic' }], 'throws');
    await expect(svc.catalogue(4)).resolves.toHaveLength(1);
  });

  it('storefront products on sale, with the family and the words that name each colour', async () => {
    const { svc, repo } = build([
      { handle: 'Impress-Color-Press-On-Nails-Cosmic', title: 'KISS imPRESS Color Press On Nails - Cosmic' },
      { handle: 'gold-finger-holiday-limited-edition-nails', title: 'Gold Finger Holiday Limited Edition Nails' },
      { handle: '', title: 'no handle' },
    ]);
    await expect(svc.catalogue(4)).resolves.toEqual([
      {
        handle: 'impress-color-press-on-nails-cosmic',
        title: 'KISS imPRESS Color Press On Nails - Cosmic',
        family: 'kiss impress color press on nails',
        variant: ['cosmic'],
      },
      {
        handle: 'gold-finger-holiday-limited-edition-nails',
        title: 'Gold Finger Holiday Limited Edition Nails',
        family: 'gold finger holiday limited edition nails',
        variant: null,
      },
    ]);
    const where = (repo.find.mock.calls[0] as unknown as [{ where: Record<string, unknown>; select: string[] }])[0];
    expect(where.where).toEqual(expect.objectContaining({ tenantId: 4, status: 'active' }));
    // companyId IS NULL: a row with a company is a B2B room type, not a storefront product.
    expect(where.where.companyId).toEqual(expect.objectContaining({ _type: 'isNull' }));
    expect(where.select).toEqual(['handle', 'title']);
  });

  it('read once per tenant within 5 minutes', async () => {
    const { svc, repo } = build([{ handle: 'a', title: 'A' }]);
    await svc.catalogue(4);
    await svc.catalogue(4);
    await svc.catalogue(5);
    expect(repo.find).toHaveBeenCalledTimes(2);
  });
});

describe('toLiveProduct', () => {
  const node = {
    handle: 'kiss-gel-fantasy',
    title: 'KISS Gel Fantasy Nails',
    status: 'ACTIVE',
    onlineStoreUrl: 'https://ivyusa.com/products/kiss-gel-fantasy',
    featuredMedia: { preview: { image: { url: 'https://cdn.shopify.com/k.jpg' } } },
    priceRangeV2: {
      minVariantPrice: { amount: '9.99', currencyCode: 'USD' },
      maxVariantPrice: { amount: '12.99', currencyCode: 'USD' },
    },
    variants: {
      nodes: [
        { title: 'Ribbon', availableForSale: true },
        { title: 'Lace', availableForSale: false },
      ],
    },
  };

  it('maps what an answer may say about a product', () => {
    expect(toLiveProduct(node)).toEqual({
      handle: 'kiss-gel-fantasy',
      title: 'KISS Gel Fantasy Nails',
      onSale: true,
      inStock: true,
      priceMin: 9.99,
      priceMax: 12.99,
      currency: 'USD',
      imageUrl: 'https://cdn.shopify.com/k.jpg',
      productUrl: 'https://ivyusa.com/products/kiss-gel-fantasy',
      variants: [
        { title: 'Ribbon', available: true },
        { title: 'Lace', available: false },
      ],
    });
  });

  it('sold out when no variant can be bought', () => {
    const p = toLiveProduct({ ...node, variants: { nodes: [{ title: 'Ribbon', availableForSale: false }] } });
    expect(p?.inStock).toBe(false);
  });

  it('not on sale when it is a draft or not on the online store', () => {
    expect(toLiveProduct({ ...node, status: 'DRAFT' })?.onSale).toBe(false);
    expect(toLiveProduct({ ...node, onlineStoreUrl: null })).toEqual(expect.objectContaining({ onSale: false, productUrl: null }));
  });

  it('the lone "Default Title" variant is no variant at all', () => {
    const p = toLiveProduct({ ...node, variants: { nodes: [{ title: 'Default Title', availableForSale: true }] } });
    expect(p?.variants).toEqual([]);
    expect(p?.inStock).toBe(true);
  });

  it('null without a handle or a title', () => {
    expect(toLiveProduct({ ...node, handle: null })).toBeNull();
    expect(toLiveProduct({ ...node, title: '' })).toBeNull();
  });
});
