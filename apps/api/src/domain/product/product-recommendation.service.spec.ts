import {
  ProductRecommendationService,
  REC_AUDIT_ACTION,
  effectiveMode,
  pickAdmin,
  rankAuto,
} from './product-recommendation.service';
import { handlesQuery, type ShopifyBestSeller } from '../order/shopify-admin.client';
import { BusinessException } from '../../global/exception/business.exception';

/**
 * Product recommendations in two modes (IVY PRD v1 A-01…A-04,
 * PLN-261125-IVY-Recommended-Products §2).
 */
const card = (handle: string, extra: Partial<ShopifyBestSeller> = {}): ShopifyBestSeller => ({
  handle,
  title: handle.toUpperCase(),
  vendor: null,
  price: 10,
  currency: 'USD',
  imageUrl: null,
  productUrl: `https://ivyusa.com/products/${handle}`,
  productId: `id-${handle}`,
  available: true,
  ...extra,
});

describe('effectiveMode', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  const admin = { mode: 'admin', productHandles: ['a'], startsAt: null, endsAt: null };

  it('Admin Selected only with products and inside its period', () => {
    expect(effectiveMode(null, now)).toBe('auto');
    expect(effectiveMode({ ...admin, mode: 'auto' }, now)).toBe('auto');
    expect(effectiveMode({ ...admin, productHandles: [] }, now)).toBe('auto');
    expect(effectiveMode(admin, now)).toBe('admin');
    expect(effectiveMode({ ...admin, startsAt: new Date('2026-11-26T00:00:00Z') }, now)).toBe('auto');
    // Ended: back to AI Auto (PRD slide 18).
    expect(effectiveMode({ ...admin, endsAt: new Date('2026-11-24T23:59:59Z') }, now)).toBe('auto');
    expect(effectiveMode({ ...admin, startsAt: new Date('2026-11-20T00:00:00Z'), endsAt: new Date('2026-12-31T23:59:59Z') }, now)).toBe('admin');
  });
});

describe('pickAdmin', () => {
  it("keeps the admin's order, drops out of stock, unknown and repeated handles", () => {
    const byHandle = new Map([
      ['a', card('a')],
      ['b', card('b', { available: false })],
      ['c', card('c')],
    ]);
    expect(pickAdmin(['c', 'b', 'gone', 'a', 'c'], byHandle).map((p) => p.handle)).toEqual(['c', 'a']);
  });
});

describe('rankAuto', () => {
  const pool = [card('a'), card('b'), card('c'), card('d', { available: false }), card('a')];

  it('no sales and no reviews: the store best-selling order, out of stock and repeats dropped', () => {
    const r = rankAuto(pool, new Map(), new Map());
    expect(r.usedData).toBe(false);
    expect(r.products.map((p) => p.handle)).toEqual(['a', 'b', 'c']);
  });

  it('sales lead (0.7), reviews refine (0.3), ties keep the store order', () => {
    const sales = new Map([
      ['id-a', 2],
      ['id-b', 10],
      ['id-c', 2],
    ]);
    const ratings = new Map([['id-c', 5]]);
    const r = rankAuto(pool, sales, ratings);
    expect(r.usedData).toBe(true);
    // b: 0.7; c: 0.14 + 0.3 = 0.44; a: 0.14.
    expect(r.products.map((p) => p.handle)).toEqual(['b', 'c', 'a']);
  });

  it('an out-of-stock best seller is never recommended, however well it sold', () => {
    const r = rankAuto([card('x', { available: false }), card('y')], new Map([['id-x', 100]]), new Map());
    expect(r.products.map((p) => p.handle)).toEqual(['y']);
  });
});

describe('handlesQuery', () => {
  it('builds an exact handle search and drops anything that is not a handle', () => {
    expect(handlesQuery(['gel-kit', 'Nail-Glue', 'x" OR status:draft', ''])).toBe('handle:gel-kit OR handle:nail-glue');
  });
});

describe('ProductRecommendationService', () => {
  const NAILS = { id: 'nails', label: { EN: 'Nails' } };
  function build(opts: { config?: any; byHandle?: Map<string, ShopifyBestSeller>; best?: ShopifyBestSeller[] | null; sales?: any[] } = {}) {
    const saved: any[] = [];
    const audits: any[] = [];
    const deleted: string[] = [];
    const recRepo = {
      findOne: jest.fn(async () => opts.config ?? null),
      find: jest.fn(async () => []),
      create: (r: any) => ({ ...r }),
      save: jest.fn(async (r: any) => (saved.push(r), { ...r, updatedAt: new Date('2026-11-25T12:00:00Z') })),
      query: jest.fn(async (sql: string) => (/SUM\(oi\.qty\)/.test(sql) ? opts.sales ?? [] : [])),
    };
    const configRepo = {
      findOne: jest.fn(async () => ({
        scenarioButtons: [{ id: 'product_inquiry', action: 'product_help', enabled: true, categories: [NAILS, { id: 'hair' }] }],
      })),
    };
    const client = {
      fetchProductsByHandles: jest.fn(async () => opts.byHandle ?? new Map()),
      fetchCollectionBestSellers: jest.fn(async () => (opts.best === undefined ? [card('a'), card('b'), card('c'), card('d')] : opts.best)),
      searchProducts: jest.fn(async () => []),
    };
    const svc = new ProductRecommendationService(
      recRepo as never,
      configRepo as never,
      { getShopifyConnection: jest.fn(async () => ({ shopDomain: 's.myshopify.com', token: 't' })) } as never,
      client as never,
      { write: jest.fn(async (a: any) => void audits.push(a)), list: jest.fn(async () => ({ items: [], total: 0 })) } as never,
      { del: jest.fn(async (k: string) => void deleted.push(k)) } as never,
    );
    return { svc, saved, audits, deleted, client, recRepo };
  }

  it('Admin Selected in its period: the picks, at most three', async () => {
    const byHandle = new Map(['p1', 'p2', 'p3', 'p4'].map((h) => [h, card(h)] as const));
    const h = build({ config: { mode: 'admin', productHandles: ['p4', 'p1', 'p2', 'p3'], startsAt: null, endsAt: null }, byHandle });
    const r = await h.svc.recommend(4, 'nails', 'popular');
    expect(r).toMatchObject({ available: true, mode: 'admin' });
    expect(r.products.map((p) => p.handle)).toEqual(['p4', 'p1', 'p2']);
    expect(h.client.fetchCollectionBestSellers).not.toHaveBeenCalled();
  });

  it('every pick out of stock: AI Auto fills in, and says so', async () => {
    const byHandle = new Map([['p1', card('p1', { available: false })]]);
    const h = build({ config: { mode: 'admin', productHandles: ['p1'], startsAt: null, endsAt: null }, byHandle });
    const r = await h.svc.recommend(4, 'nails', 'popular');
    expect(r.mode).toBe('admin_fallback');
    expect(r.products.map((p) => p.handle)).toEqual(['a', 'b', 'c']);
  });

  it('AI Auto with sales: ranked; without data: the store order', async () => {
    const withSales = build({ sales: [{ pid: 'id-c', qty: '9' }] });
    const ranked = await withSales.svc.recommend(4, 'nails', 'popular');
    expect(ranked.mode).toBe('auto');
    expect(ranked.products[0].handle).toBe('c');
    const noData = build();
    const plain = await noData.svc.recommend(4, 'nails', 'popular');
    expect(plain.mode).toBe('auto_bestseller');
    expect(plain.products.map((p) => p.handle)).toEqual(['a', 'b', 'c']);
  });

  it('a collection the store does not have: unavailable (the widget links the category page)', async () => {
    const h = build({ best: null });
    await expect(h.svc.recommend(4, 'nails', 'popular')).resolves.toEqual({ available: false, mode: null, products: [] });
  });

  it('save: validated, audited with before / after, the popular cache dropped', async () => {
    const h = build({ config: { categoryHandle: 'nails', recType: 'popular', mode: 'auto', productHandles: [], startsAt: null, endsAt: null } });
    const out = await h.svc.save(4, 12, {
      categoryHandle: 'nails',
      recType: 'popular',
      mode: 'admin',
      productHandles: ['Gel-Kit', 'gel-kit', 'top-coat'],
      startsAt: '2026-11-20',
      endsAt: '2026-12-31',
    });
    expect(out).toMatchObject({ mode: 'admin', productHandles: ['gel-kit', 'top-coat'], startsAt: '2026-11-20T00:00:00.000Z', endsAt: '2026-12-31T23:59:59.000Z' });
    expect(h.saved[0].updatedBy).toBe(12);
    expect(h.audits[0]).toMatchObject({ action: REC_AUDIT_ACTION, actorId: 12, target: 'nails/popular' });
    expect(h.audits[0].metadata.before).toMatchObject({ mode: 'auto' });
    expect(h.audits[0].metadata.after).toMatchObject({ mode: 'admin' });
    expect(h.deleted).toEqual(['popular:v1:4:nails']);
  });

  it('save refuses: unknown category or type, more than 10, bad handle, a period that ends first', async () => {
    const h = build();
    const base = { categoryHandle: 'nails', recType: 'popular', mode: 'admin', productHandles: ['a'] };
    for (const bad of [
      { ...base, categoryHandle: 'not-a-button-category' },
      { ...base, recType: 'cheapest' },
      { ...base, mode: 'random' },
      { ...base, productHandles: Array.from({ length: 11 }, (_, i) => `p${i}`) },
      { ...base, productHandles: ['handle with spaces'] },
      { ...base, startsAt: '2026-12-31', endsAt: '2026-11-20' },
      { ...base, startsAt: 'yesterday' },
    ]) {
      await expect(h.svc.save(4, 12, bad)).rejects.toThrow(BusinessException);
    }
    expect(h.saved).toEqual([]);
  });

  it('sales count only the last 30 days, without cancelled or refunded orders', async () => {
    const h = build({ sales: [{ pid: 'id-a', qty: '3' }] });
    const m = await h.svc.salesByProduct(4, ['id-a', 'id-b']);
    expect(m.get('id-a')).toBe(3);
    const [sql, params] = h.recRepo.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/INTERVAL 30 DAY/);
    expect(sql).toMatch(/NOT IN \('cancelled', 'refunded'\)/);
    expect(params).toEqual([4, ['id-a', 'id-b']]);
  });
});

describe('ProductRecommendationService.stockSearch (IVY PRD v1 C-01)', () => {
  function build(opts: { cached?: string | null; conn?: boolean; throws?: boolean } = {}) {
    const store: Record<string, string> = {};
    const client = {
      searchProducts: jest.fn(async () => {
        if (opts.throws) throw new Error('Admin API returned 502');
        return [card('gel', { available: true }), card('press', { available: false })];
      }),
    };
    const redis = {
      get: jest.fn(async () => opts.cached ?? null),
      set: jest.fn(async (k: string, v: string) => void (store[k] = v)),
      del: jest.fn(),
    };
    const svc = new ProductRecommendationService(
      {} as never,
      {} as never,
      { getShopifyConnection: jest.fn(async () => (opts.conn === false ? null : { shopDomain: 's', token: 't' })) } as never,
      client as never,
      {} as never,
      redis as never,
    );
    return { svc, client, redis, store };
  }

  it('asks the store once, keeps the answer two minutes per query', async () => {
    const h = build();
    const r = await h.svc.stockSearch(4, '  Gel ');
    expect(r.available).toBe(true);
    expect(r.products.map((p) => [p.handle, p.available])).toEqual([['gel', true], ['press', false]]);
    expect(h.client.searchProducts).toHaveBeenCalledWith('s', 't', 'Gel', 5);
    expect(Object.keys(h.store)).toEqual(['stock:v1:4:gel']);
    expect(h.redis.set.mock.calls[0][2]).toBe(120);
  });

  it('a cached answer is served without the store', async () => {
    const h = build({ cached: JSON.stringify({ available: true, products: [] }) });
    await expect(h.svc.stockSearch(4, 'gel')).resolves.toEqual({ available: true, products: [] });
    expect(h.client.searchProducts).not.toHaveBeenCalled();
  });

  it('too short a query asks nobody; no connection or a store error is "unavailable"', async () => {
    const h = build();
    await expect(h.svc.stockSearch(4, 'g')).resolves.toEqual({ available: true, products: [] });
    expect(h.client.searchProducts).not.toHaveBeenCalled();
    await expect(build({ conn: false }).svc.stockSearch(4, 'gel')).resolves.toEqual({ available: false, products: [] });
    await expect(build({ throws: true }).svc.stockSearch(4, 'gel')).resolves.toEqual({ available: false, products: [] });
  });
});
