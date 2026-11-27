import { RagService, RetrievedChunk, namedFamilies, namedMembers, storeItemsFor } from './rag.service';
import type { ShopifyLiveProduct } from '../order/shopify-admin.client';
import type { CatalogueEntry, LiveLookup } from '../product/product-live.service';
import { productFamilyKey, variantWords } from '../product/product-family.util';

/**
 * A colour sold as a product of its own (PLN-261127). The knowledge base folds
 * the twelve "KISS imPRESS Color Press On Nails - …" products into one
 * document named after Bubble Kiss; a Cosmic question read Bubble Kiss's stock
 * and showed Bubble Kiss's card (production smoke, 2026-11-26).
 */

const entry = (handle: string, title: string): CatalogueEntry => ({
  handle,
  title,
  family: productFamilyKey(title),
  variant: variantWords(title),
});
const IMPRESS = 'KISS imPRESS Color Press On Nails';
const shade = (name: string) =>
  entry(`impress-color-press-on-nails-${name.toLowerCase().replace(/\s+/g, '-')}`, `${IMPRESS} - ${name}`);
const COSMIC = shade('Cosmic');
const BUBBLE_KISS = shade('Bubble Kiss');
const BUBBLE_POP = shade('Bubble Pop');
const PEARLFECTION = shade('Pearlfection');
const FAMILY = [
  entry('impress-color-press-on-nails-beet-snacks', `${IMPRESS} -  Beet Snacks`),
  BUBBLE_KISS,
  BUBBLE_POP,
  shade('Cool Breeze'),
  COSMIC,
  shade('Dusk Till Dawn'),
  shade('Eggstar Special'),
  shade('French Lavender'),
  shade('Green Juice'),
  shade('Kick Back'),
  PEARLFECTION,
  entry('impress-solid-color-short-squoval', 'KISS imPRESS Color Press-On Nails – Solid Color Shades, Short Squoval'),
];
const MATTE = ['Brie', 'Lovely', 'Perfect Timing', 'Rising Sun'].map((n) =>
  entry(`impress-color-press-on-nails-matte-${n.toLowerCase().replace(/\s+/g, '-')}`, `${IMPRESS} Matte - ${n}`),
);
const SINGLE = entry('gold-finger-holiday-limited-edition-nails', 'Gold Finger Holiday Limited Edition Nails');
const CATALOGUE = [...FAMILY, ...MATTE, SINGLE];
const handles = (list: CatalogueEntry[]) => list.map((e) => e.handle);

describe('namedMembers (E1, E3)', () => {
  it('the colour named by its own words, however the rest of the name is written', () => {
    expect(handles(namedMembers(FAMILY, 'Is imPRESS Color Cosmic in stock?'))).toEqual([COSMIC.handle]);
    expect(handles(namedMembers(FAMILY, `${IMPRESS} - Cosmic 재고 있나요? 가격은 얼마예요?`))).toEqual([COSMIC.handle]);
  });

  it('a colour whose words sit inside another named colour is not named on its own', () => {
    expect(handles(namedMembers(FAMILY, 'Is Bubble Pop in stock?'))).toEqual([BUBBLE_POP.handle]);
    expect(handles(namedMembers(FAMILY, 'Is Bubble Kiss in stock?'))).toEqual([BUBBLE_KISS.handle]);
  });

  it('two colours named: both', () => {
    expect(handles(namedMembers(FAMILY, 'Do you have Cosmic or Pearlfection?'))).toEqual([COSMIC.handle, PEARLFECTION.handle]);
  });

  it('no colour named — the family name alone — is no member', () => {
    expect(namedMembers(FAMILY, `Is ${IMPRESS} in stock?`)).toEqual([]);
  });

  it('more than three named: not specific enough, none', () => {
    expect(namedMembers(FAMILY, 'Cosmic, Kick Back, Green Juice or Cool Breeze?')).toEqual([]);
  });
});

describe('namedFamilies (E5)', () => {
  it('a member named by its whole title names its family', () => {
    expect(namedFamilies(CATALOGUE, `${IMPRESS} - Cosmic 재고 있나요?`)).toEqual(['kiss impress color press on nails']);
  });

  it('not from the colour alone, nor from the family name alone', () => {
    expect(namedFamilies(CATALOGUE, 'Is imPRESS Color Cosmic in stock?')).toEqual([]);
    expect(namedFamilies(CATALOGUE, `Is ${IMPRESS} in stock?`)).toEqual([]);
  });

  it('a product sold in one colour has no member to name', () => {
    expect(namedFamilies(CATALOGUE, 'Is Gold Finger Holiday Limited Edition Nails in stock?')).toEqual([]);
  });

  it('every handle of the named family, for the title leg', () => {
    expect(RagService.namedFamilyHandles(CATALOGUE, ['How much?', `${IMPRESS} - Cosmic\nHow much?`])).toEqual(handles(FAMILY));
  });
});

describe('storeItemsFor (E1, E4)', () => {
  const chunk = (id: number, title: string, handle: string | null): RetrievedChunk => ({
    id,
    title,
    category: null,
    source: 'product_catalog',
    group: handle ? 'product' : 'counsel',
    url: null,
    handle,
    snippet: '',
    similarity: null,
  });
  // The family's document is named after Bubble Kiss, as on production (#847).
  const chunks = [
    chunk(847, BUBBLE_KISS.title, BUBBLE_KISS.handle),
    chunk(12, 'Return policy', null),
    chunk(21, SINGLE.title, SINGLE.handle),
  ];

  it('the named colour is read for the family document, instead of the colour it is named after', () => {
    expect(storeItemsFor(chunks, CATALOGUE, ['Is imPRESS Color Cosmic in stock?'])).toEqual([
      { n: 1, handle: COSMIC.handle, named: true },
      { n: 3, handle: SINGLE.handle },
    ]);
  });

  it('no colour named: each document’s own product, as before', () => {
    expect(storeItemsFor(chunks, CATALOGUE, [`Is ${IMPRESS} in stock?`])).toEqual([
      { n: 1, handle: BUBBLE_KISS.handle },
      { n: 3, handle: SINGLE.handle },
    ]);
    expect(storeItemsFor(chunks, [], ['Is imPRESS Color Cosmic in stock?'])).toEqual([
      { n: 1, handle: BUBBLE_KISS.handle },
      { n: 3, handle: SINGLE.handle },
    ]);
  });

  it('a follow-up that names nothing keeps the colour the shopper named before (E4)', () => {
    const texts = ['How much is it?', 'Is imPRESS Color Cosmic in stock?\nHow much is it?'];
    expect(storeItemsFor(chunks, CATALOGUE, texts)[0]).toEqual({ n: 1, handle: COSMIC.handle, named: true });
  });

  it('a document whose own product left the catalogue still finds its family by title', () => {
    const gone = [chunk(847, BUBBLE_KISS.title, 'impress-color-press-on-nails-bubble-kiss-old')];
    expect(storeItemsFor(gone, CATALOGUE, ['Cosmic?'])).toEqual([{ n: 1, handle: COSMIC.handle, named: true }]);
  });
});

describe('RagService.answer — a named colour (PLN-261127)', () => {
  const live = (handle: string, title: string, over: Partial<ShopifyLiveProduct> = {}): ShopifyLiveProduct => ({
    handle,
    title,
    onSale: true,
    inStock: true,
    priceMin: 8.99,
    priceMax: 8.99,
    currency: 'USD',
    imageUrl: `https://cdn.shopify.com/${handle}.jpg`,
    productUrl: `https://ivyusa.com/products/${handle}`,
    variants: [],
    ...over,
  });
  const ok = (...ps: ShopifyLiveProduct[]): LiveLookup => ({ ok: true, products: new Map(ps.map((p) => [p.handle, p])) });

  const doc = (id: number, title: string, handle: string, content: string) => ({
    id,
    title,
    category: 'KISS',
    source: 'product_catalog',
    docGroup: 'product',
    externalKey: handle,
    sourceUrl: `https://ivyusa.myshopify.com/products/${handle}`,
    content,
    videoRef: null,
  });
  const FAMILY_DOC = doc(847, BUBBLE_KISS.title, BUBBLE_KISS.handle, `${BUBBLE_KISS.title}\nSalon-look press-on nails.\nVariants: ${COSMIC.title}, …`);
  const OTHER_DOC = doc(31, 'KISS imPRESS Press-On Manicure - Tan Lines', 'impress-press-on-manicure-tan-lines', 'Press-on manicure.');
  // A family whose representative's title is far from the question: only E5 brings it in.
  const TRENDY = ['Pink Lemonade Swirl', 'Blue'].map((n) =>
    entry(`gold-finger-trendy-nails-${n.toLowerCase().replace(/\s+/g, '-')}`, `Gold Finger Trendy Nails - ${n}`),
  );
  const TRENDY_DOC = doc(900, TRENDY[0].title, TRENDY[0].handle, `${TRENDY[0].title}\nTrendy nails.\nVariants: ${TRENDY[1].title}`);

  /** Keyword leg → OTHER_DOC only; the title list; ids; external keys — each query recorded by what it asked. */
  function build() {
    const all = [FAMILY_DOC, OTHER_DOC, TRENDY_DOC];
    const familyReads: string[][] = [];
    const kbRepo = {
      createQueryBuilder: () => {
        const state: { titles: boolean; ids: number[] | null; keys: string[] | null } = { titles: false, ids: null, keys: null };
        const qb: Record<string, unknown> = new Proxy(
          {},
          {
            get(_t, prop: string) {
              if (prop === 'andWhere') {
                return (cond: unknown) => {
                  if (typeof cond === 'string' && cond.includes('kb.doc_group = :titleGroup')) state.titles = true;
                  const c = cond as { id?: { value?: number[] }; externalKey?: { value?: string[] } } | null;
                  if (c?.id?.value) state.ids = c.id.value.map(Number);
                  if (c?.externalKey?.value) state.keys = c.externalKey.value;
                  return qb;
                };
              }
              if (prop === 'getMany') {
                return async () => {
                  if (state.titles) return all.map((d) => ({ id: d.id, title: d.title }));
                  if (state.keys) {
                    familyReads.push(state.keys);
                    return all.filter((d) => state.keys!.includes(d.externalKey));
                  }
                  if (state.ids) return all.filter((d) => state.ids!.includes(d.id));
                  return [OTHER_DOC];
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
    // Cites whichever item the prompt numbered as the family's document.
    const ai = {
      complete: jest.fn(async (req: { system: string }) => {
        const m = /\[(\d+)\] \[KISS\] (KISS imPRESS Color Press On Nails - Bubble Kiss|Gold Finger Trendy Nails - Pink Lemonade Swirl):/.exec(req.system);
        return { text: `It is in stock.\nCITED: ${m ? m[1] : ''}`, tokensIn: 1, tokensOut: 2 };
      }),
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
    return { svc, ai, familyReads };
  }

  const ask = (
    svc: RagService,
    q: string,
    lookup: (h: string[]) => Promise<LiveLookup | null>,
    catalogue?: () => Promise<CatalogueEntry[]>,
  ) => svc.answer(4, q, 'EN', undefined, 'product', undefined, null, undefined, undefined, undefined, undefined, lookup, catalogue);

  const COSMIC_Q = `${IMPRESS} - Cosmic 재고 있나요? 가격은 얼마예요?`;

  it('reads Cosmic, first, gives it the family document’s number, and cards Cosmic', async () => {
    const { svc, ai } = build();
    const lookup = jest.fn(async () => ok(live(COSMIC.handle, COSMIC.title), live(OTHER_DOC.externalKey, OTHER_DOC.title)));
    const res = await ask(svc, COSMIC_Q, lookup, async () => [...CATALOGUE, entry(OTHER_DOC.externalKey, OTHER_DOC.title)]);

    expect(lookup.mock.calls[0][0][0]).toBe(COSMIC.handle);
    expect(lookup.mock.calls[0][0]).not.toContain(BUBBLE_KISS.handle);
    const system = ai.complete.mock.calls[0][0].system as string;
    const n = /\[(\d+)\] \[KISS\] KISS imPRESS Color Press On Nails - Bubble Kiss:/.exec(system)?.[1];
    expect(n).toBeDefined();
    expect(system).toContain(`[${n}] KISS imPRESS Color Press On Nails - Cosmic: on sale online; in stock; price 8.99 USD`);
    expect(system).toContain('it is the one the customer named');
    expect(res.products).toEqual([
      expect.objectContaining({ handle: COSMIC.handle, title: COSMIC.title, inStock: true, price: 8.99 }),
    ]);
  });

  it('a sold-out Cosmic keeps its card (D2)', async () => {
    const { svc } = build();
    const res = await ask(svc, COSMIC_Q, jest.fn(async () => ok(live(COSMIC.handle, COSMIC.title, { inStock: false }))), async () => CATALOGUE);
    expect(res.products).toEqual([expect.objectContaining({ handle: COSMIC.handle, inStock: false })]);
  });

  it('the family document comes in by its catalogue handles when its own title is far from the question (E5)', async () => {
    const { svc, ai, familyReads } = build();
    const lookup = jest.fn(async () => ok(live(TRENDY[1].handle, TRENDY[1].title)));
    const res = await ask(svc, 'Is Gold Finger Trendy Nails - Blue in stock?', lookup, async () => [...CATALOGUE, ...TRENDY]);

    expect(familyReads).toEqual([TRENDY.map((e) => e.handle)]);
    const system = ai.complete.mock.calls[0][0].system as string;
    expect(system).toContain('[1] [KISS] Gold Finger Trendy Nails - Pink Lemonade Swirl:');
    expect(lookup.mock.calls[0][0][0]).toBe(TRENDY[1].handle);
    expect(res.products?.[0]?.handle).toBe(TRENDY[1].handle);
  });

  it('no colour named: the document’s own product, and no extra rule', async () => {
    const { svc, ai, familyReads } = build();
    const lookup = jest.fn(async () => ok(live(BUBBLE_KISS.handle, BUBBLE_KISS.title)));
    const res = await ask(svc, `Is ${IMPRESS} in stock?`, lookup, async () => CATALOGUE);
    expect(familyReads).toEqual([]);
    expect(lookup.mock.calls[0][0]).toContain(BUBBLE_KISS.handle);
    expect(ai.complete.mock.calls[0][0].system).not.toContain('it is the one the customer named');
    expect(res.products?.[0]?.handle).toBe(BUBBLE_KISS.handle);
  });

  it('a catalogue that cannot be read: answered as before', async () => {
    const { svc } = build();
    const lookup = jest.fn(async () => ok(live(BUBBLE_KISS.handle, BUBBLE_KISS.title)));
    const res = await ask(svc, COSMIC_Q, lookup, async () => {
      throw new Error('db down');
    });
    expect(lookup.mock.calls[0][0]).toContain(BUBBLE_KISS.handle);
    expect(res.products?.[0]?.handle).toBe(BUBBLE_KISS.handle);
  });

  it('same prompt with and without the catalogue when nothing is named', async () => {
    const a = build();
    const b = build();
    const lookup = async () => ok(live(BUBBLE_KISS.handle, BUBBLE_KISS.title));
    await ask(a.svc, `Is ${IMPRESS} in stock?`, lookup, async () => CATALOGUE);
    await ask(b.svc, `Is ${IMPRESS} in stock?`, lookup);
    expect(a.ai.complete.mock.calls[0][0].system).toBe(b.ai.complete.mock.calls[0][0].system);
  });
});
