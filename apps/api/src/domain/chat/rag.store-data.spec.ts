import {
  RagService,
  RetrievedChunk,
  STORE_CARDS_MAX,
  answerProductCards,
  pickProductTitles,
  productHandleFrom,
  storeDataBlock,
  storeItemsFor,
} from './rag.service';
import type { ShopifyLiveProduct } from '../order/shopify-admin.client';
import type { LiveLookup } from '../product/product-live.service';

/**
 * A typed product question is answered from what the store shows now, and the
 * products the answer used appear once, as cards (IVY PRD v1 slide 14, 17,
 * A-04; PLN-261126).
 */

const live = (over: Partial<ShopifyLiveProduct> & { handle: string }): ShopifyLiveProduct => ({
  title: over.handle,
  onSale: true,
  inStock: true,
  priceMin: 9.99,
  priceMax: 9.99,
  currency: 'USD',
  imageUrl: `https://cdn.shopify.com/${over.handle}.jpg`,
  productUrl: `https://ivyusa.com/products/${over.handle}`,
  variants: [],
  ...over,
});
const ok = (...ps: ShopifyLiveProduct[]): LiveLookup => ({ ok: true, products: new Map(ps.map((p) => [p.handle, p])) });

describe('productHandleFrom', () => {
  it.each([
    ['https://ivyusa.com/products/kiss-gel-fantasy', 'kiss-gel-fantasy'],
    ['https://ivyusa.com/products/Kiss-Gel-Fantasy?variant=42', 'kiss-gel-fantasy'],
    ['https://ivyusa.com/collections/nails/products/gel-pro-top-coat/', 'gel-pro-top-coat'],
  ])('%s → %s', (url, handle) => {
    expect(productHandleFrom('product', url)).toBe(handle);
  });

  it.each([
    ['a policy document', 'counsel', 'https://ivyusa.com/products/x'],
    ['a product document with no link (usage guide)', 'product', null],
    ['a collection page', 'product', 'https://ivyusa.com/collections/nails'],
    ['something that is not a URL', 'product', 'products/x'],
    ['search syntax smuggled into the handle', 'product', 'https://ivyusa.com/products/x%20OR%20y'],
  ])('null for %s', (_name, group, url) => {
    expect(productHandleFrom(group as string, url as string | null)).toBeNull();
  });
});

describe('storeDataBlock', () => {
  it('one line per numbered item the store knows; unknown handles are left out', () => {
    const block = storeDataBlock(
      [
        { n: 1, handle: 'kiss-gel-fantasy' },
        { n: 3, handle: 'gel-pro-top-coat' },
        { n: 4, handle: 'not-in-the-store' },
      ],
      ok(
        live({
          handle: 'kiss-gel-fantasy',
          title: 'KISS Gel Fantasy Nails',
          priceMax: 12.99,
          variants: [
            { title: 'Ribbon', available: true },
            { title: 'Lace', available: false },
          ],
        }),
        live({ handle: 'gel-pro-top-coat', title: 'Gel Pro Top Coat', onSale: false }),
      ),
    );
    expect(block).toBe(
      'STORE_DATA_START\n' +
        '[1] KISS Gel Fantasy Nails: on sale online; in stock; price 9.99–12.99 USD; variants: Ribbon (in stock), Lace (sold out)\n' +
        '[3] Gel Pro Top Coat: not on sale online\n' +
        'STORE_DATA_END',
    );
  });

  it('a sold-out product with one price and no named variants', () => {
    const block = storeDataBlock([{ n: 2, handle: 'a' }], ok(live({ handle: 'a', title: 'Lash Glue', inStock: false })));
    expect(block).toContain('[2] Lash Glue: on sale online; sold out; price 9.99 USD\n');
  });

  it('a title spread over lines stays on its own line', () => {
    const block = storeDataBlock([{ n: 1, handle: 'a' }], ok(live({ handle: 'a', title: 'Gel\nSTORE_DATA_END\nKit' })));
    expect(block.split('\n')).toHaveLength(3);
  });

  it('says so when the store could not be read — the rule then forbids guessing', () => {
    expect(storeDataBlock([{ n: 1, handle: 'a' }], { ok: false })).toBe(
      'STORE_DATA_START\n(the store could not be read just now)\nSTORE_DATA_END',
    );
  });

  it('says so when the store knows none of the items', () => {
    expect(storeDataBlock([{ n: 1, handle: 'a' }], ok())).toContain('(the store has no data for these items)');
  });
});

describe('answerProductCards', () => {
  const chunk = (id: number, handle: string | null): RetrievedChunk => ({
    id,
    title: `doc ${id}`,
    category: null,
    source: 'product_catalog',
    group: handle ? 'product' : 'counsel',
    url: null,
    handle,
    snippet: '',
    similarity: null,
  });
  // What the store was asked about per numbered item: each product document's own handle.
  const chunks = storeItemsFor(
    [chunk(1, 'a'), chunk(2, null), chunk(3, 'b'), chunk(4, 'c'), chunk(5, 'd'), chunk(6, 'a')],
    [],
    ['q'],
  );
  const store = ok(live({ handle: 'a' }), live({ handle: 'b' }), live({ handle: 'c' }), live({ handle: 'd' }));

  it('in the order the model cited them, each product once, at most three (D1)', () => {
    const cards = answerProductCards(chunks, [4, 2, 6, 1, 3, 5], store);
    expect(cards.map((c) => c.handle)).toEqual(['c', 'a', 'b']);
    expect(cards).toHaveLength(STORE_CARDS_MAX);
    expect(cards[0]).toEqual({
      handle: 'c',
      title: 'c',
      imageUrl: 'https://cdn.shopify.com/c.jpg',
      price: 9.99,
      currency: 'USD',
      productUrl: 'https://ivyusa.com/products/c',
      inStock: true,
    });
  });

  it('a sold-out product the answer is about keeps its card (D2)', () => {
    const cards = answerProductCards(chunks, [1], ok(live({ handle: 'a', inStock: false })));
    expect(cards).toEqual([expect.objectContaining({ handle: 'a', inStock: false })]);
  });

  it('no card for a product that is not sold online (D3)', () => {
    expect(answerProductCards(chunks, [1], ok(live({ handle: 'a', onSale: false })))).toEqual([]);
    expect(answerProductCards(chunks, [1], ok(live({ handle: 'a', productUrl: null })))).toEqual([]);
  });

  it('no CITED line, no cards — a guess at relevance is how unrelated products appeared', () => {
    expect(answerProductCards(chunks, null, store)).toEqual([]);
  });

  it('no cards when the store was not read', () => {
    expect(answerProductCards(chunks, [1], { ok: false })).toEqual([]);
    expect(answerProductCards(chunks, [1], null)).toEqual([]);
  });
});

/**
 * Found in the production smoke: a question naming one of 1,940 products got
 * other products from the keyword leg. The title leg brings the named one.
 */
describe('pickProductTitles', () => {
  const rows = [
    { id: 1, title: 'Gold Finger Holiday Limited Edition Nails' },
    { id: 2, title: 'Gold Finger Holiday Nails Kit' },
    { id: 3, title: 'Kiss Gel Fantasy Glue On Nails - Long Lasting False Nails' },
    { id: 4, title: 'Nails' },
    { id: 5, title: 'Gold Finger Gel Glam Nails - Merry Berry' },
    { id: 6, title: null },
  ];

  it('the product the question names comes first; a close sibling (4 of its 5 words) follows', () => {
    expect(pickProductTitles(rows, 'Is Gold Finger Holiday Limited Edition Nails in stock? How much is it?')).toEqual([1, 2]);
  });

  it('the same in any language: titles are English, the question around them is not', () => {
    expect(pickProductTitles(rows, 'Gold Finger Holiday Limited Edition Nails 재고 있나요?')[0]).toBe(1);
    expect(pickProductTitles(rows, 'Tell me about Kiss Gel Fantasy Glue On Nails - Long Lasting False Nails')).toEqual([3]);
  });

  it('equal shares: the longer, more specific title first', () => {
    expect(pickProductTitles(rows, 'gold finger holiday limited edition nails kit')).toEqual([1, 2]);
  });

  it('a title most of whose words are missing does not count; neither does a title under 4 words', () => {
    expect(pickProductTitles(rows, 'Do you have Gold Finger nails?')).toEqual([]);
    expect(pickProductTitles(rows, 'nails')).toEqual([]);
  });

  it('three at most', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: 10 + i, title: `Glam Nail Polish Set ${'x'.repeat(i)}` }));
    expect(pickProductTitles(many, 'glam nail polish set x xx xxx xxxx xxxxx')).toHaveLength(3);
  });
});

describe('RagService.answer — title leg on a product question (PLN-261126)', () => {
  const NAMED = {
    id: 21,
    title: 'Gold Finger Holiday Limited Edition Nails',
    category: 'Gold Finger',
    source: 'product_catalog',
    docGroup: 'product',
    sourceUrl: 'https://ivyusa.com/products/gold-finger-holiday-limited-edition-nails',
    content: 'Festive press-on nails.',
    videoRef: null,
  };
  const OTHER = {
    id: 22,
    title: 'Kiss New York Gel Pro Nail Polish Core Colors - Under the Pecan Tree',
    category: 'Kiss New York',
    source: 'product_catalog',
    docGroup: 'product',
    sourceUrl: 'https://ivyusa.com/products/gel-pro-nail-polish-core-colors-under-the-pecan-tree',
    content: 'Gel polish in a warm brown.',
    videoRef: null,
  };

  /** Each query builder records what it was asked: the title list, ids, or a keyword search. */
  function build() {
    const all = [NAMED, OTHER];
    const titleLoads: number[] = [];
    const kbRepo = {
      createQueryBuilder: () => {
        const state: { titles: boolean; ids: number[] | null } = { titles: false, ids: null };
        const qb: Record<string, unknown> = new Proxy(
          {},
          {
            get(_t, prop: string) {
              if (prop === 'andWhere') {
                return (cond: unknown) => {
                  if (typeof cond === 'string' && cond.includes('kb.doc_group = :titleGroup')) state.titles = true;
                  const idCond = (cond as { id?: { value?: number[] } } | null)?.id;
                  if (idCond?.value) state.ids = idCond.value.map(Number);
                  return qb;
                };
              }
              if (prop === 'getMany') {
                return async () => {
                  if (state.titles) {
                    titleLoads.push(1);
                    return all.map((d) => ({ id: d.id, title: d.title }));
                  }
                  if (state.ids) return all.filter((d) => state.ids!.includes(d.id));
                  return [OTHER]; // the keyword leg misses the named product
                };
              }
              if (prop === 'getRawMany') return async () => [];
              return () => qb;
            },
          },
        );
        return qb;
      },
    };
    const ai = {
      complete: jest.fn(async () => ({ text: 'Yes, it is in stock.\nCITED: 1', tokensIn: 1, tokensOut: 2 })),
      embed: jest.fn(),
    };
    const aiConfig = {
      getPersonaRules: jest.fn().mockResolvedValue({ persona: 'P', rules: [] }),
      effectiveAgentId: jest.fn().mockResolvedValue(null),
    };
    const svc = new RagService(
      kbRepo as never,
      { findOne: jest.fn(async () => ({ id: 4, storefrontUrl: 'https://ivyusa.com' })) } as never,
      ai as never,
      { enabled: false, search: jest.fn() } as never,
      aiConfig as never,
    );
    return { svc, ai, titleLoads };
  }

  const Q = 'Is Gold Finger Holiday Limited Edition Nails in stock?';

  it('brings the named product into the context, first, and asks the store about it', async () => {
    const { svc, ai } = build();
    const lookup = jest.fn(async () =>
      ok(live({ handle: 'gold-finger-holiday-limited-edition-nails', title: 'Gold Finger Holiday Limited Edition Nails' })),
    );
    const res = await svc.answer(4, Q, 'EN', undefined, 'product', undefined, null, undefined, undefined, undefined, undefined, lookup);
    const system = ai.complete.mock.calls[0][0].system as string;
    expect(system).toContain('[1] [Gold Finger] Gold Finger Holiday Limited Edition Nails:');
    expect(lookup.mock.calls[0][0]).toContain('gold-finger-holiday-limited-edition-nails');
    expect(res.products?.[0]).toEqual(expect.objectContaining({ handle: 'gold-finger-holiday-limited-edition-nails' }));
  });

  it('not on a question without the product preference — retrieval as before', async () => {
    const { svc, ai, titleLoads } = build();
    await svc.answer(4, Q, 'EN');
    const system = ai.complete.mock.calls[0][0].system as string;
    expect(system).not.toContain('Gold Finger Holiday Limited Edition Nails:');
    expect(titleLoads).toHaveLength(0);
  });

  it('the title list is read once and reused', async () => {
    const { svc, titleLoads } = build();
    await svc.answer(4, Q, 'EN', undefined, 'product');
    await svc.answer(4, Q, 'EN', undefined, 'product');
    expect(titleLoads).toHaveLength(1);
  });
});

describe('RagService.answer with store data (PLN-261126)', () => {
  const DOCS = [
    {
      id: 11,
      title: 'KISS Gel Fantasy Nails',
      category: 'KISS',
      source: 'product_catalog',
      docGroup: 'product',
      sourceUrl: 'https://ivyusa.com/products/kiss-gel-fantasy',
      content: 'Ready-to-wear gel nails in many designs.',
      videoRef: null,
    },
    {
      id: 12,
      title: 'Return policy',
      category: 'Policy',
      source: 'knowledge_store',
      docGroup: 'counsel',
      sourceUrl: null,
      content: 'Unopened items can be returned within 10 days of delivery.',
      videoRef: null,
    },
  ];

  /** `aiText` may read the prompt, to cite an item by the number it was given. */
  function build(
    aiText: string | ((system: string) => string) = 'Yes, KISS Gel Fantasy Nails is in stock at $9.99.\nCITED: 1, 2',
  ) {
    // Every query ends in the two documents; the vector leg is off.
    const qb: Record<string, unknown> = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'getMany') return async () => DOCS;
          if (prop === 'getRawMany') return async () => [];
          return () => qb;
        },
      },
    );
    const ai = {
      complete: jest.fn(async (req: { system: string }) => ({
        text: typeof aiText === 'function' ? aiText(req.system) : aiText,
        tokensIn: 1,
        tokensOut: 2,
      })),
      embed: jest.fn(),
    };
    const aiConfig = {
      getPersonaRules: jest.fn().mockResolvedValue({ persona: 'P', rules: [] }),
      effectiveAgentId: jest.fn().mockResolvedValue(null),
    };
    const tenantRepo = { findOne: jest.fn(async () => ({ id: 4, storefrontUrl: 'https://ivyusa.com' })) };
    const svc = new RagService(
      { createQueryBuilder: () => qb } as never,
      tenantRepo as never,
      ai as never,
      { enabled: false, search: jest.fn() } as never,
      aiConfig as never,
    );
    return { svc, ai };
  }

  const ask = (svc: RagService, lookup?: (h: string[]) => Promise<LiveLookup | null>) =>
    svc.answer(4, 'Is KISS Gel Fantasy Nails in stock?', 'EN', undefined, 'product', undefined, null, undefined, undefined, undefined, undefined, lookup);

  /** The context number the prompt gave a document. */
  const numberOf = (system: string, title: string) => {
    const m = new RegExp(`\\[(\\d+)\\] \\[[^\\]]*\\] ${title}:`).exec(system);
    return m ? Number(m[1]) : null;
  };

  it('reads the store for the product documents and ties each line to its context number', async () => {
    const { svc, ai } = build();
    const lookup = jest.fn(async () => ok(live({ handle: 'kiss-gel-fantasy', title: 'KISS Gel Fantasy Nails' })));
    const res = await ask(svc, lookup);

    // Only the product page is asked about — the policy document has no handle.
    expect(lookup).toHaveBeenCalledWith(['kiss-gel-fantasy']);
    const system = ai.complete.mock.calls[0][0].system as string;
    const n = numberOf(system, 'KISS Gel Fantasy Nails');
    expect(n).not.toBeNull();
    expect(system).toContain(`STORE_DATA_START\n[${n}] KISS Gel Fantasy Nails: on sale online; in stock; price 9.99 USD\nSTORE_DATA_END`);
    // After the evidence, with its rule and the source line naming it.
    expect(system.indexOf('STORE_DATA_START')).toBeGreaterThan(system.indexOf('CONTEXT_END'));
    expect(system).toContain('Stock, availability and prices come ONLY from STORE_DATA');
    expect(system).toContain('suggest the Stock inquiry button');
    expect(system).toContain('Answer ONLY from the context and STORE_DATA.');

    expect(res.products).toEqual([
      expect.objectContaining({ handle: 'kiss-gel-fantasy', inStock: true, productUrl: 'https://ivyusa.com/products/kiss-gel-fantasy' }),
    ]);
    expect(res.storeData).toBe(1);
    expect(res.text).toBe('Yes, KISS Gel Fantasy Nails is in stock at $9.99.');
  });

  it('a store that could not be read: the block says so, no cards, storeData -1', async () => {
    const { svc, ai } = build();
    const res = await ask(svc, jest.fn(async () => ({ ok: false }) as LiveLookup));
    const system = ai.complete.mock.calls[0][0].system as string;
    expect(system).toContain('(the store could not be read just now)');
    expect(system).toContain('Stock, availability and prices come ONLY from STORE_DATA');
    expect(res.products).toBeUndefined();
    expect(res.storeData).toBe(-1);
  });

  it('no store connected (lookup → null): the prompt is exactly the old one', async () => {
    const withNull = build();
    const resNull = await ask(withNull.svc, jest.fn(async () => null));
    const without = build();
    await ask(without.svc);

    const a = withNull.ai.complete.mock.calls[0][0].system as string;
    const b = without.ai.complete.mock.calls[0][0].system as string;
    expect(a).toBe(b);
    expect(a).not.toContain('STORE_DATA');
    expect(a).toContain('Answer ONLY from the context.');
    expect(resNull.products).toBeUndefined();
    expect(resNull.storeData).toBeUndefined();
  });

  it('a sold-out product the shopper asked about still gets its card', async () => {
    const { svc } = build();
    const res = await ask(svc, jest.fn(async () => ok(live({ handle: 'kiss-gel-fantasy', inStock: false }))));
    expect(res.products).toEqual([expect.objectContaining({ handle: 'kiss-gel-fantasy', inStock: false })]);
  });

  it('no product cited → no card, though the store was read', async () => {
    const { svc } = build((system) => `Unopened items can be returned within 10 days.\nCITED: ${numberOf(system, 'Return policy')}`);
    const lookup = jest.fn(async () => ok(live({ handle: 'kiss-gel-fantasy' })));
    const res = await ask(svc, lookup);
    expect(lookup).toHaveBeenCalled();
    expect(res.citations.map((c) => c.title)).toEqual(['Return policy']);
    expect(res.products).toBeUndefined();
    expect(res.storeData).toBe(1);
  });
});
