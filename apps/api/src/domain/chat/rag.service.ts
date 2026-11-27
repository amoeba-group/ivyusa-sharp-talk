import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AI_FUNCTION } from '@sharptalk/types';
import type { ChatProductCard } from '@sharptalk/types';
import { DOC_GROUP, KbDocument } from '../knowledge/entity/kb-document.entity';
import type { ShopifyLiveProduct } from '../order/shopify-admin.client';
import type { CatalogueEntry, LiveLookup } from '../product/product-live.service';
import { isNamingWord, productFamilyKey, questionWords } from '../product/product-family.util';
import { Tenant } from '../tenant/entity/tenant.entity';
import { normalizeStorefrontUrl, productLinkFor } from '../../global/util/storefront-url.util';
import { AiGatewayService } from '../../infrastructure/external/ai/ai-gateway.service';
import { QdrantService } from '../../infrastructure/external/vector/qdrant.service';
import { AiConfigService } from '../ai-engine/ai-config.service';
import type { AiMessage } from '../../infrastructure/external/ai/ai-adapter.interface';
import { capContext, selectPassages, titleMatchScore } from './passage.util';
import { AnswerFooter, footerFor } from '../ai-engine/answer-footer.util';
import { envNumber } from '../../global/util/env-number.util';
import { signKbVideo } from '../../global/util/crypto.util';
import { kbVideoPath, parseVideoRef } from '../knowledge/video-ref.util';
import { CONVERSATION_RULES, transcript, withCurrentTurn } from './conversation-history.util';
import { CALLER_RULE } from './caller-context.util';
import { PROMPT_LANGUAGE_NAMES } from '../agent/prompt-language';
import { replyLanguageMismatch } from '../../global/util/reply-language.util';

export interface RetrievedChunk {
  id: number;
  title: string;
  category: string | null;
  source: string;
  /** counsel | product — lets the widget label product recommendations. */
  group: string;
  /**
   * Customer-facing link, or null. Only set for product documents whose
   * source_url is on the tenant's own storefront: the value arrives in an
   * operator-uploaded CSV and the widget turns it into a clickable link inside
   * a shopper's conversation.
   */
  url: string | null;
  /**
   * The store's handle of the product a product document describes, from its
   * `/products/{handle}` link (PLN-261126) — what the live store read asks for.
   * Null for anything that is not one product's page.
   */
  handle?: string | null;
  /**
   * "Watch video" link for a document that explains a video
   * (PLN-261006-KB-Video-Links): a signed path on our API, resolved by the
   * client against its API origin. Added by code, never by the model.
   */
  videoUrl?: string | null;
  snippet: string;
  /** Dense similarity (dot, normalized vectors) when the vector leg saw this doc. */
  similarity: number | null;
  /** A simulation candidate injected by the board review (PLN-260829 B2) — not a stored KB document. */
  candidate?: boolean;
}

/** A not-yet-adopted board document, ranked as if it were knowledge (B2 P4-4). */
export interface RagCandidateInput {
  title: string;
  content: string;
  category: string | null;
  group: string;
}

export interface RagAnswer {
  text: string;
  confidence: number;
  citations: RetrievedChunk[];
  /** Every injected candidate with its rank/similarity — cited or not (B2). */
  candidateResults?: RetrievedChunk[];
  /** Cards for the products the answer used, read from the store (PLN-261126). */
  products?: ChatProductCard[];
  /**
   * Products the store returned for this answer; -1 when the store could not be
   * read. Absent when no store data was asked for (PLN-261126, for the trace).
   */
  storeData?: number;
  tokensIn: number;
  tokensOut: number;
}

/** Product cards under one answer (PRD v1 slide 16: "up to 3 product cards"). */
export const STORE_CARDS_MAX = 3;

/** Share of a product title's words the question must contain (see titleMatchScore). */
export const PRODUCT_TITLE_MIN = 0.75;
/** Product documents the title leg adds at most. */
const PRODUCT_TITLE_LEG = 3;
/** How long a tenant's product titles are reused between questions. */
const PRODUCT_TITLES_TTL_MS = 5 * 60_000;

/**
 * Product documents whose title is (nearly) in the question, best first
 * (PLN-261126, found in the production smoke): "Is Gold Finger Holiday Limited
 * Edition Nails in stock?" names one of 1,940 product documents, yet the
 * keyword leg — eight candidates, scored over the whole text — surfaced other
 * Gold Finger products, so the answer could not speak about the one asked.
 * Equal shares go to the longer title, the more specific product.
 */
export function pickProductTitles(
  rows: Array<{ id: number; title: string | null }>,
  query: string,
  max = PRODUCT_TITLE_LEG,
): number[] {
  return rows
    .map((r) => ({ id: Number(r.id), s: titleMatchScore(r.title ?? '', query), len: (r.title ?? '').length }))
    .filter((x) => x.s >= PRODUCT_TITLE_MIN)
    .sort((a, b) => b.s - a.s || b.len - a.len)
    .slice(0, max)
    .map((x) => x.id);
}

/**
 * The handle of a product page link, `/products/{handle}` — catalogue and CSV
 * documents both carry one. Null for anything else: a usage guide is filed in
 * the product group too, but it describes no single product.
 */
export function productHandleFrom(group: string, sourceUrl: string | null | undefined): string | null {
  if (group !== DOC_GROUP.PRODUCT || !sourceUrl) return null;
  let path: string;
  try {
    path = new URL(sourceUrl).pathname;
  } catch {
    return null;
  }
  const m = /\/products\/([^/]+)\/?$/.exec(path);
  if (!m) return null;
  let handle: string;
  try {
    handle = decodeURIComponent(m[1]).toLowerCase();
  } catch {
    return null;
  }
  return /^[a-z0-9][a-z0-9-]*$/.test(handle) ? handle : null;
}

/** "price 9.99 USD" / "price 9.99–14.99 USD", or null without a price. */
function priceText(p: ShopifyLiveProduct): string | null {
  if (p.priceMin == null) return null;
  const cur = p.currency ? ` ${p.currency}` : '';
  const range =
    p.priceMax != null && p.priceMax !== p.priceMin
      ? `${p.priceMin.toFixed(2)}–${p.priceMax.toFixed(2)}`
      : p.priceMin.toFixed(2);
  return `price ${range}${cur}`;
}

/** One line of what the store shows for a product. Titles are flattened to one line. */
function storeLine(p: ShopifyLiveProduct): string {
  const title = p.title.replace(/\s+/g, ' ').trim();
  if (!p.onSale) return `${title}: not on sale online`;
  const parts = ['on sale online', p.inStock ? 'in stock' : 'sold out'];
  const price = priceText(p);
  if (price) parts.push(price);
  if (p.variants.length) {
    parts.push(
      `variants: ${p.variants
        .map((v) => `${v.title.replace(/\s+/g, ' ').trim()} (${v.available ? 'in stock' : 'sold out'})`)
        .join(', ')}`,
    );
  }
  return `${title}: ${parts.join('; ')}`;
}

/**
 * The STORE_DATA block (PLN-261126): one line per numbered context item the
 * store knows, so the model ties stock and price to the item it describes.
 * When the store could not be read the block says so, and the rule then has
 * the model say it cannot confirm stock rather than guess.
 */
export function storeDataBlock(items: Array<{ n: number; handle: string }>, lookup: LiveLookup): string {
  if (!lookup.ok) return 'STORE_DATA_START\n(the store could not be read just now)\nSTORE_DATA_END';
  const lines: string[] = [];
  for (const { n, handle } of items) {
    const p = lookup.products.get(handle);
    if (p) lines.push(`[${n}] ${storeLine(p)}`);
  }
  return `STORE_DATA_START\n${lines.length ? lines.join('\n') : '(the store has no data for these items)'}\nSTORE_DATA_END`;
}

/** One product the store is asked about, for the numbered context item `n`. */
export interface StoreItem {
  n: number;
  handle: string;
  /** A member of the item's family the shopper named (PLN-261127) — read first. */
  named?: boolean;
}

/**
 * A colour word in at most this many catalogue titles names its product by
 * itself (PLN-261127 E6). Measured on IVY's catalogue: cosmic 1, aphrodite 2,
 * bubble 7, pink 32, black 100.
 */
const RARE_TITLE_WORD = 3;

/** In how many catalogue titles each word appears — once per catalogue read (the same array for 5 minutes). */
const titleWordCounts = new WeakMap<readonly CatalogueEntry[], Map<string, number>>();
function titleWordCount(entries: readonly CatalogueEntry[]): Map<string, number> {
  let counts = titleWordCounts.get(entries);
  if (!counts) {
    counts = new Map();
    for (const e of entries) {
      for (const w of new Set(questionWords(e.title))) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    titleWordCounts.set(entries, counts);
  }
  return counts;
}

/**
 * Families whose member the question names (PLN-261127). Their document joins
 * the title leg, however far its representative's title — another colour's —
 * is from the question. Every word naming the member must be in the question,
 * and then either
 * - E5: (nearly) its whole title is — "KISS imPRESS Color Press On Nails - Cosmic …"; or
 * - E6: one of those words is rare in the catalogue and the question has a
 *   word of the family's own name — "Is imPRESS Color Cosmic in stock?". The
 *   keyword leg missed that one on production: "cosmic" sits once in the
 *   family document's variant list, outweighed by documents repeating
 *   "imPRESS" and "color". A common colour ("pink nails") names no family.
 */
export function namedFamilies(entries: readonly CatalogueEntry[], text: string, max = STORE_CARDS_MAX): string[] {
  const words = new Set(questionWords(text));
  const counts = titleWordCount(entries);
  const hits: Array<{ family: string; s: number }> = [];
  for (const e of entries) {
    if (!e.variant?.every((w) => words.has(w))) continue;
    const whole = titleMatchScore(e.title, text);
    if (whole >= PRODUCT_TITLE_MIN) {
      hits.push({ family: e.family, s: 1 + whole }); // whole-title matches rank first
      continue;
    }
    if (!e.variant.some((w) => isNamingWord(w) && (counts.get(w) ?? 0) <= RARE_TITLE_WORD)) continue;
    const head = e.family.split(' ');
    const shared = head.filter((w) => isNamingWord(w) && words.has(w)).length;
    if (shared) hits.push({ family: e.family, s: shared / head.length });
  }
  hits.sort((a, b) => b.s - a.s);
  return [...new Set(hits.map((x) => x.family))].slice(0, max);
}

/**
 * The members of one family the question names by their own words
 * (PLN-261127 E1, E3): `cosmic` in "Is imPRESS Color Cosmic in stock?". A
 * member whose words all sit inside another named member's is not named on its
 * own — "bubble pop" names Bubble Pop, not Bubble Kiss. More than `max` named
 * means the words were not specific enough to name one: none.
 */
export function namedMembers(members: readonly CatalogueEntry[], text: string, max = STORE_CARDS_MAX): CatalogueEntry[] {
  const words = new Set(questionWords(text));
  const hits = members.filter((m) => m.variant?.every((w) => words.has(w)));
  const kept = hits.filter(
    (m) => !hits.some((o) => o.variant!.length > m.variant!.length && m.variant!.every((w) => o.variant!.includes(w))),
  );
  return kept.length <= max ? kept : [];
}

/**
 * What the store is asked about, per numbered context item (PLN-261126,
 * PLN-261127): the product a document describes — or, when the shopper named
 * other members of that document's family, those members instead (E1). The
 * knowledge base folds "… - Cosmic" into a document named after "… - Bubble
 * Kiss"; reading Bubble Kiss for a Cosmic question gave a card for the wrong
 * colour. `texts` are tried in order — the message, then with the shopper's
 * earlier turns (E4) — and the first that names a member wins.
 */
export function storeItemsFor(
  chunks: readonly RetrievedChunk[],
  entries: readonly CatalogueEntry[],
  texts: readonly string[],
): StoreItem[] {
  const byHandle = new Map(entries.map((e) => [e.handle, e]));
  const byFamily = new Map<string, CatalogueEntry[]>();
  for (const e of entries) {
    const list = byFamily.get(e.family);
    if (list) list.push(e);
    else byFamily.set(e.family, [e]);
  }
  const out: StoreItem[] = [];
  chunks.forEach((c, i) => {
    if (!c.handle) return;
    const members = byFamily.get(byHandle.get(c.handle)?.family ?? productFamilyKey(c.title)) ?? [];
    let named: CatalogueEntry[] = [];
    if (members.length > 1) {
      for (const text of texts) {
        named = namedMembers(members, text);
        if (named.length) break;
      }
    }
    if (named.length) named.forEach((m) => out.push({ n: i + 1, handle: m.handle, named: true }));
    else out.push({ n: i + 1, handle: c.handle });
  });
  return out;
}

/**
 * Cards for the products the answer actually used (PLN-261126): in the order
 * the model cited them (D1), only what is sold online (D3) — a sold-out product
 * the shopper asked about still gets its card (D2). No CITED line, no cards: a
 * guess at relevance is how unrelated products appeared before (FIX-260806 §7-1).
 * A cited item's card is the product the store was asked about for it — the
 * colour the shopper named, when they named one (PLN-261127 E2).
 */
export function answerProductCards(
  items: ReadonlyArray<{ n: number; handle: string }>,
  cited: number[] | null,
  lookup: LiveLookup | null,
): ChatProductCard[] {
  if (!lookup?.ok || !cited?.length) return [];
  const out: ChatProductCard[] = [];
  const seen = new Set<string>();
  for (const n of cited) {
    for (const { handle } of items.filter((x) => x.n === n)) {
      if (seen.has(handle)) continue;
      const p = lookup.products.get(handle);
      if (!p?.onSale || !p.productUrl) continue;
      seen.add(handle);
      out.push({
        handle,
        title: p.title,
        imageUrl: p.imageUrl,
        price: p.priceMin,
        currency: p.currency,
        productUrl: p.productUrl,
        inStock: p.inStock,
      });
      if (out.length >= STORE_CARDS_MAX) return out;
    }
  }
  return out;
}

/**
 * How the model treats STORE_DATA (PLN-261126; PRD v1 slide 14 guardrail
 * "never makes up anything not in the source data").
 */
const STORE_RULE =
  'STORE_DATA is what the online store shows right now for the numbered context items it lists. ' +
  'Stock, availability and prices come ONLY from STORE_DATA: never state them for an item STORE_DATA does not list, ' +
  'and never infer them from the context text. If the customer asks about stock, a color, a size or a price that ' +
  'STORE_DATA does not show, say you cannot confirm it here and suggest the Stock inquiry button in the chat menu. ' +
  'An item marked "not on sale online" cannot be bought on the store right now. ' +
  'Never mention STORE_DATA in the visible reply.\n';

/**
 * Added when a STORE_DATA line is for a colour the shopper named (PLN-261127):
 * its title differs from the context item it is numbered after, which is
 * named after another colour of the same product.
 */
const NAMED_VARIANT_RULE =
  'A STORE_DATA line can be for one color or size of its numbered item that is sold as a product of its own: ' +
  'it is the one the customer named, so answer about that one.\n';

/**
 * What to do on a turn with nothing to retrieve (PLN-260813 P2). These steer
 * the model; the customer never sees them.
 */
const NO_KNOWLEDGE_INSTRUCTION: Record<string, string> = {
  smalltalk:
    'The shopper is making small talk — a greeting, thanks or a compliment. ' +
    'Answer warmly and briefly, then ask in one sentence what you can help with. ' +
    'Do not mention the knowledge base, documents, or that you searched.',
  out_of_scope:
    'The shopper asked something this shop cannot answer (weather, exchange ' +
    'rates, news). Say plainly that this is outside what you can help with, ' +
    'then name what you CAN help with (orders, delivery, returns, products). ' +
    'Never guess or invent the information they asked for.',
  unintelligible:
    'The message cannot be read as a question. Say you did not catch that and ' +
    'ask them to rephrase. Do not guess at what they meant.',
};

/**
 * Confidence floor when the answer is grounded in the customer's own order data.
 * Must stay above ChatService's escalation threshold so a factual order answer is
 * delivered rather than handed off for lack of a matching help article.
 */
const ORDER_CONTEXT_CONFIDENCE = 0.6;

/**
 * The model's bookkeeping line naming the context items it used ("CITED: 1,3").
 * Deliberately forgiving — a stray bullet, bold marker or trailing period must
 * still be recognised, because a marker we fail to match is a marker the
 * customer would read in the chat bubble.
 */
const CITED_LINE = /^[\s>*_`-]*cited\s*:?\s*([\d,\s]*)[\s.*_`-]*$/gim;

/**
 * Split the answer text from that marker. Returns the customer-facing text and
 * the 1-based item numbers, or `cited: null` when the model wrote no marker at
 * all — the caller then keeps every citation rather than dropping them.
 */
export function splitCitedMarker(raw: string): { text: string; cited: number[] | null } {
  let found = false;
  const cited = new Set<number>();
  const text = raw
    .replace(CITED_LINE, (_match, list: string) => {
      found = true;
      for (const part of list.split(',')) {
        const n = Number(part.trim());
        if (Number.isInteger(n) && n > 0) cited.add(n);
      }
      return '';
    })
    .trim();
  return { text, cited: found ? [...cited] : null };
}

/**
 * Retrieval-Augmented answering (FN-016/017, POL-011/013,
 * PLAN-KB-VectorHybrid-Qdrant W4). Hybrid retrieval: MySQL FULLTEXT (exact
 * keyword leg) + Qdrant dense vectors (semantic leg, cross-lingual ko/en/es),
 * merged with Reciprocal Rank Fusion. Only active KB documents scoped to the
 * tenant are retrieved, excluding those from a source the operator has
 * un-designated (Knowledge Store wins; Google Drive supplements). The vector leg degrades silently — Qdrant/embedder failures
 * fall back to FULLTEXT-only, which is the pre-hybrid behavior.
 *
 * An answer may additionally be grounded in the signed-in customer's own order
 * facts, which no KB document can contain — see `answer`'s `orderContext`.
 */
/**
 * Added when the tenant's contact footer is on (PLN-261007 R4): the system
 * appends it, so a contact block written by the model would be a duplicate —
 * and the model's copy was where masking and token cut-offs did their damage.
 */
/**
 * The one instruction about reply language (PLN-261019-Widget-Language-Follow-Selection).
 *
 * It used to be two: this prompt said "Reply in language code: EN" while the
 * default persona rule said "Reply in the customer's language" — and when a
 * Korean partner typed Korean into an English or Vietnamese widget, the model
 * followed the rule it could see an example of. Named language, spelled-out
 * exceptions, and the persona rule now defers to this line.
 */
export function replyLanguageRule(language: string): string {
  const code = String(language || 'en').toLowerCase();
  const name = PROMPT_LANGUAGE_NAMES[code] ?? code.toUpperCase();
  return (
    `Always reply in ${name} (${code}), even if the customer wrote in another ` +
    `language or the context documents are in another language. Never switch ` +
    `languages mid-reply.`
  );
}

const FOOTER_RULE =
  '\n- Do not end your reply with contact details (e-mail, phone, hotline, ' +
  'Zalo, working hours): the system appends the official contact block. Give ' +
  'contact details in the body only when the customer asks how to reach support.';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  /** Product titles per tenant × agent scope, for the title leg (PLN-261126). */
  private readonly productTitleCache = new Map<string, { at: number; rows: Array<{ id: number; title: string | null }> }>();
  /** Per-leg candidate depth before fusion; the merged top-`limit` is returned. */
  private static readonly LEG_LIMIT = 8;
  /** RRF constant (standard k=60). */
  private static readonly RRF_K = 60;
  /** POL-013 nudge: knowledge_store outranks google_drive on near-ties. */
  private static readonly SOURCE_BONUS = 0.0005;
  /**
   * Nudge toward the caller's preferred document group (PLN-260804 D3).
   * Deliberately a bonus, not a filter: a product question can still need the
   * return policy, so the other group must stay reachable. Larger than
   * SOURCE_BONUS so group preference outranks provenance, small enough that it
   * cannot invert a clear RRF gap.
   */
  private static readonly GROUP_BONUS = 0.002;
  /**
   * Slots that go to the best documents by unbiased rank whatever the group
   * preference says (PLN-260929 S9). The bonus above was meant to be a nudge,
   * but RRF gaps between neighbouring ranks are ~0.0003, so 0.002 jumps about
   * ten places — in a KB of 2,275 products and ~30 policy sections a question
   * the classifier labelled product_inquiry ("What is your return policy?")
   * came back with six products and no policy at all, and the model said it
   * had no information (measured on staging 2026-09-29).
   */
  private static readonly UNBIASED_RESERVE = 3;
  /** Confidence when real embeddings are expected but missing — under escalation (FIX-260930). */
  private static readonly DEGRADED_CONFIDENCE = 0.2;
  /**
   * Documents handed to the model per answer. Was 4, which is too few for this
   * KB: the policy import splits one topic across several short sections
   * (`2.1.3 Shipping Rates`, `2.2.4 Return Shipment Deadline`, …), so a
   * multi-part question ("how do I return an item and get a refund?") retrieved
   * one fragment, answered partially, and offered a human agent for the rest —
   * measured on staging 2026-08-07. Six covers those fan-outs while staying
   * under LEG_LIMIT, so fusion still has candidates to rank.
   */
  private static readonly TOP_K = 6;
  /**
   * Vector hits below this dot score are discarded. Qdrant always returns the
   * nearest neighbors, so without a floor an off-topic query pads the context
   * with irrelevant docs and suppresses escalation. Near-zero cutoff is safe
   * for both voyage (unrelated ≈ 0.3+) and the stub (zero-overlap = 0).
   */
  private static readonly VECTOR_SCORE_FLOOR = 0.01;

  constructor(
    @InjectRepository(KbDocument) private readonly kbRepo: Repository<KbDocument>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly ai: AiGatewayService,
    private readonly qdrant: QdrantService,
    private readonly aiConfig: AiConfigService,
  ) {}

  /** The tenant's storefront origin, or null when nobody has configured one. */
  private async storefrontFor(tenantId: number): Promise<string | null> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: ['id', 'storefrontUrl'],
    });
    return normalizeStorefrontUrl(tenant?.storefrontUrl);
  }

  /**
   * `aiAgentId` narrows the result to what that agent may cite. Omitting it
   * retrieves everything the tenant has — which is what the console and agent
   * coaching want: a person managing the knowledge base has to see all of it.
   */
  async retrieve(
    tenantId: number,
    query: string,
    limit = RagService.TOP_K,
    aiAgentId?: number | null,
  ): Promise<RetrievedChunk[]> {
    const scopeAgentId =
      aiAgentId == null ? null : await this.aiConfig.effectiveAgentId(tenantId, aiAgentId);
    return (await this.retrieveHybrid(tenantId, query, limit, undefined, scopeAgentId)).chunks;
  }

  /**
   * Top `limit` with the group bonus applied, except that the best
   * UNBIASED_RESERVE documents by plain score always keep a place (S9). Result
   * is ordered by the biased score, so a preferred document still leads.
   */
  static rankWithPreference<T extends { doc: { docGroup?: string | null }; rrf: number }>(
    scored: T[],
    limit: number,
    preferGroup?: string,
  ): T[] {
    const plain = [...scored].sort((a, b) => b.rrf - a.rrf);
    if (!preferGroup) return plain.slice(0, limit);
    const biasedScore = (e: T) =>
      e.rrf + (e.doc.docGroup === preferGroup ? RagService.GROUP_BONUS : 0);
    const kept = new Set(plain.slice(0, Math.min(RagService.UNBIASED_RESERVE, limit)));
    for (const e of [...scored].sort((a, b) => biasedScore(b) - biasedScore(a))) {
      if (kept.size >= limit) break;
      kept.add(e);
    }
    return [...kept]
      .sort((a, b) => biasedScore(b) - biasedScore(a))
      .map((e) => ({ ...e, rrf: biasedScore(e) }));
  }

  /**
   * A document whose title is (nearly) the question goes to the top
   * (FIX-261007-FAQ-Title-Match). RRF scores sit around 0.016–0.033, so 0.05
   * outranks any fusion result; a partial match gets a nudge only.
   */
  static titleBonus(title: string | null | undefined, query: string): number {
    const s = titleMatchScore(title ?? '', query);
    if (s >= 0.8) return 0.05;
    if (s >= 0.6) return 0.004;
    return 0;
  }

  /**
   * The document of a family whose member the question names by its whole
   * title (PLN-261127 E5) ranks as if its own title had been named: the
   * shopper asked for that product, under another colour's name.
   */
  private static readonly NAMED_FAMILY_BONUS = 0.05;

  /** Results kept from the current-message search when it is merged with the contextual one. */
  private static readonly OWN_QUERY_RESERVE = 3;

  /**
   * The current message's best hits first (up to OWN_QUERY_RESERVE), then the
   * contextual search's, then the rest of the current message's — deduplicated
   * by document, capped at `limit` (FIX-261007-Topic-Switch). A topic switch
   * keeps its own documents; a topic-less follow-up still gets the context's,
   * because its own search finds little and the context fills the slots.
   */
  static mergeOwnFirst<T extends { id: number }>(own: T[], contextual: T[], limit: number): T[] {
    const out: T[] = [];
    const seen = new Set<number>();
    const take = (c: T) => {
      if (out.length < limit && !seen.has(Number(c.id))) {
        seen.add(Number(c.id));
        out.push(c);
      }
    };
    own.slice(0, RagService.OWN_QUERY_RESERVE).forEach(take);
    contextual.forEach(take);
    own.slice(RagService.OWN_QUERY_RESERVE).forEach(take);
    return out;
  }

  /**
   * The contact footer to append to a knowledge answer in this language, or
   * null (PLN-261007 R4). Operator-written fixed text — appended after
   * moderation, the same standing as a scenario script.
   */
  async footerText(tenantId: number, language: string): Promise<string | null> {
    return footerFor(await this.aiConfig.getAnswerFooter?.(tenantId), language);
  }

  /** The tenant's footer config (null = none) — the chat strips copies of it. */
  async footerConfig(tenantId: number): Promise<AnswerFooter | null> {
    return (await this.aiConfig.getAnswerFooter?.(tenantId)) ?? null;
  }

  /** Who is answering, after inactive/unknown pins degrade to the default. */
  effectiveAgentId(tenantId: number, aiAgentId?: number | null): Promise<number | null> {
    return this.aiConfig.effectiveAgentId(tenantId, aiAgentId);
  }

  /**
   * How well the knowledge base covers `query`, on the same scale `answer()`
   * reports — retrieval only, no model call (PLN-260929 S6). Lets the chat path
   * second-guess an out_of_scope label: the classifier assumes a shop, so a
   * cleaning company's "에어컨 청소 예약" was refused while its price sheet sat
   * in the knowledge base.
   */
  async groundingConfidence(
    tenantId: number,
    query: string,
    aiAgentId?: number | null,
  ): Promise<number> {
    const { chunks, vectorProvider } = await this.retrieveHybrid(
      tenantId,
      query,
      RagService.TOP_K,
      undefined,
      aiAgentId ?? null,
    );
    return this.confidence(chunks, vectorProvider);
  }

  private async retrieveHybrid(
    tenantId: number,
    query: string,
    limit = 4,
    preferGroup?: string,
    aiAgentId?: number | null,
    /** Handles of the families the question names a member of (PLN-261127 E5). */
    familyHandles: readonly string[] = [],
  ): Promise<{ chunks: RetrievedChunk[]; vectorProvider: string | null }> {
    const [ftDocs, vec, titleLeg] = await Promise.all([
      this.retrieveFulltext(tenantId, query, RagService.LEG_LIMIT, aiAgentId),
      this.retrieveVector(tenantId, query, RagService.LEG_LIMIT),
      // A product question may name the product (PLN-261126): its document
      // joins the candidates by title, whatever the other legs ranked.
      preferGroup === DOC_GROUP.PRODUCT
        ? this.retrieveProductTitles(tenantId, query, aiAgentId, familyHandles)
        : Promise.resolve({ docs: [] as KbDocument[], family: new Set<number>() }),
    ]);
    const titleDocs = titleLeg.docs;
    // Uncalibrated (stub) vector scores may RANK docs but never ADMIT them:
    // hash-collision noise would otherwise pad off-topic queries with random
    // documents and suppress escalation. Real embeddings (voyage) admit freely —
    // that cross-lingual/semantic admission is the point of the vector leg.
    const ftIds = new Set(ftDocs.map((d) => Number(d.id)));
    const vecHits =
      vec.provider === 'voyage' ? vec.hits : vec.hits.filter((h) => ftIds.has(h.id));

    // RRF over the two legs; similarity rides along from the vector hits.
    // Number() on every doc id: MySQL bigint PKs are strings at runtime, and a
    // string-keyed map entry would never fuse with the numeric Qdrant ids.
    const fused = new Map<number, { rrf: number; similarity: number | null }>();
    ftDocs.forEach((d, rank) => {
      const id = Number(d.id);
      const e = fused.get(id) ?? { rrf: 0, similarity: null };
      e.rrf += 1 / (RagService.RRF_K + rank + 1);
      fused.set(id, e);
    });
    vecHits.forEach((h, rank) => {
      const e = fused.get(h.id) ?? { rrf: 0, similarity: null };
      e.rrf += 1 / (RagService.RRF_K + rank + 1);
      e.similarity = h.score;
      fused.set(h.id, e);
    });
    // The title leg fuses like the other two; the title bonus below then puts
    // the product the question names first.
    titleDocs.forEach((d, rank) => {
      const id = Number(d.id);
      const e = fused.get(id) ?? { rrf: 0, similarity: null };
      e.rrf += 1 / (RagService.RRF_K + rank + 1);
      fused.set(id, e);
    });

    // Hydrate vector-only ids from MySQL (tenant scope re-checked — defense in depth).
    const ftById = new Map([...ftDocs, ...titleDocs].map((d) => [Number(d.id), d]));
    const missingIds = [...fused.keys()].filter((id) => !ftById.has(id));
    if (missingIds.length) {
      // The vector leg searches Qdrant, which knows nothing about categories or
      // agents; re-hydrating through baseQuery is what applies the scope to it.
      const rows = await this.baseQuery(tenantId, aiAgentId)
        .andWhere({ id: In(missingIds) })
        .getMany();
      rows.forEach((d) => ftById.set(Number(d.id), d));
    }

    const scored = [...fused.entries()]
      .map(([id, e]) => ({ doc: ftById.get(id), ...e }))
      .filter((e): e is { doc: KbDocument; rrf: number; similarity: number | null } => !!e.doc)
      .map((e) => ({
        ...e,
        rrf:
          e.rrf +
          (e.doc.source === 'knowledge_store' ? RagService.SOURCE_BONUS : 0) +
          Math.max(
            RagService.titleBonus(e.doc.title, query),
            titleLeg.family.has(Number(e.doc.id)) ? RagService.NAMED_FAMILY_BONUS : 0,
          ),
      }));
    const ranked = RagService.rankWithPreference(scored, limit, preferGroup);

    const storefront = await this.storefrontFor(tenantId);
    const chunks = ranked.map(({ doc, similarity }) => ({
      id: Number(doc.id),
      title: doc.title,
      category: doc.category,
      source: doc.source,
      group: doc.docGroup,
      url: productLinkFor(doc.docGroup, doc.sourceUrl, storefront),
      handle: productHandleFrom(doc.docGroup, doc.sourceUrl),
      videoUrl: parseVideoRef(doc.videoRef)
        ? kbVideoPath(Number(doc.id), tenantId, signKbVideo(tenantId, Number(doc.id)))
        : null,
      // Whole document up to the budget, else the paragraphs matching the query (R3).
      snippet: selectPassages(doc.content ?? '', query),
      similarity,
    }));
    return { chunks, vectorProvider: vec.provider };
  }

  /**
   * Title leg for a product question (PLN-261126): the product documents whose
   * title is (nearly) in the question, through the same scope as every leg.
   * The documents of the families the question names a member of come first
   * (PLN-261127 E5) — found by the handles their catalogue sync filed them
   * under, so a family named after another colour is still found.
   */
  private async retrieveProductTitles(
    tenantId: number,
    query: string,
    aiAgentId?: number | null,
    familyHandles: readonly string[] = [],
  ): Promise<{ docs: KbDocument[]; family: Set<number> }> {
    const ids = pickProductTitles(await this.productTitles(tenantId, aiAgentId), query);
    const [titled, ofFamily] = await Promise.all([
      ids.length
        ? this.baseQuery(tenantId, aiAgentId).andWhere({ id: In(ids) }).getMany()
        : Promise.resolve([] as KbDocument[]),
      familyHandles.length
        ? this.baseQuery(tenantId, aiAgentId)
            .andWhere('kb.doc_group = :familyGroup', { familyGroup: DOC_GROUP.PRODUCT })
            .andWhere({ externalKey: In([...familyHandles]) })
            .getMany()
        : Promise.resolve([] as KbDocument[]),
    ]);
    const family = new Set(ofFamily.map((d) => Number(d.id)));
    const byId = new Map(titled.map((d) => [Number(d.id), d]));
    const byTitle = ids
      .map((id) => byId.get(id))
      .filter((d): d is KbDocument => !!d && !family.has(Number(d.id)));
    return { docs: [...ofFamily, ...byTitle], family };
  }

  /** The catalogue names, or none when they cannot be read — the answer then goes on as before. */
  private async catalogueNames(
    tenantId: number,
    catalogue: () => Promise<CatalogueEntry[]>,
  ): Promise<CatalogueEntry[]> {
    try {
      return await catalogue();
    } catch (e) {
      this.logger.warn(`tenant ${tenantId}: catalogue names unavailable, no named colours (${(e as Error).message})`);
      return [];
    }
  }

  /**
   * Every handle of the families the shopper names a member of by its whole
   * title (PLN-261127 E5) — the title leg finds their document by any of them.
   * The first text that names one wins (the message, then with earlier turns).
   */
  static namedFamilyHandles(entries: readonly CatalogueEntry[], texts: readonly string[]): string[] {
    for (const text of texts) {
      const families = new Set(namedFamilies(entries, text));
      if (families.size) return entries.filter((e) => families.has(e.family)).map((e) => e.handle);
    }
    return [];
  }

  /** Id and title of the tenant's active product documents — a few thousand short rows, kept 5 minutes. */
  private async productTitles(
    tenantId: number,
    aiAgentId?: number | null,
  ): Promise<Array<{ id: number; title: string | null }>> {
    const key = `${tenantId}:${aiAgentId ?? '-'}`;
    const hit = this.productTitleCache.get(key);
    if (hit && Date.now() - hit.at < PRODUCT_TITLES_TTL_MS) return hit.rows;
    const docs = await this.baseQuery(tenantId, aiAgentId)
      .andWhere('kb.doc_group = :titleGroup', { titleGroup: DOC_GROUP.PRODUCT })
      .select(['kb.id', 'kb.title'])
      .getMany();
    const rows = docs.map((d) => ({ id: Number(d.id), title: d.title ?? null }));
    this.productTitleCache.set(key, { at: Date.now(), rows });
    return rows;
  }

  /** Keyword leg — FULLTEXT MATCH (PERF-2), LIKE scan when the index is absent. */
  private async retrieveFulltext(
    tenantId: number,
    query: string,
    limit: number,
    aiAgentId?: number | null,
  ): Promise<KbDocument[]> {
    const terms = query
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
      .slice(0, 8);

    if (!terms.length) {
      return this.baseQuery(tenantId, aiAgentId)
        .orderBy("CASE WHEN kb.source = 'knowledge_store' THEN 0 ELSE 1 END", 'ASC')
        .addOrderBy('kb.updatedAt', 'DESC')
        .take(limit)
        .getMany();
    }
    try {
      return await this.baseQuery(tenantId, aiAgentId)
        .addSelect('MATCH(kb.title, kb.content) AGAINST (:ftq IN NATURAL LANGUAGE MODE)', 'relevance')
        .andWhere('MATCH(kb.title, kb.content) AGAINST (:ftq IN NATURAL LANGUAGE MODE)')
        .setParameter('ftq', terms.join(' '))
        .orderBy("CASE WHEN kb.source = 'knowledge_store' THEN 0 ELSE 1 END", 'ASC')
        .addOrderBy('relevance', 'DESC')
        .take(limit)
        .getMany();
    } catch {
      // FULLTEXT index not present yet (pre-migration DB) — legacy LIKE scan.
      return this.retrieveLike(tenantId, terms, limit, aiAgentId);
    }
  }

  /** Semantic leg — embed the query, dense-search Qdrant. Failures return no hits. */
  private async retrieveVector(
    tenantId: number,
    query: string,
    limit: number,
  ): Promise<{ hits: { id: number; score: number }[]; provider: string | null }> {
    if (!this.qdrant.enabled) return { hits: [], provider: null };
    try {
      const emb = await this.ai.embed([query], 'query');
      const hits = await this.qdrant.search(tenantId, emb.vectors[0], limit);
      return {
        hits: hits.filter((h) => h.score >= RagService.VECTOR_SCORE_FLOOR),
        provider: emb.provider,
      };
    } catch (e) {
      this.logger.warn(`vector leg failed, FULLTEXT only: ${(e as Error).message}`);
      return { hits: [], provider: null };
    }
  }

  /**
   * The one place that decides what an answer may be grounded in.
   *
   * Both legs pass through here — the keyword leg queries it directly and the
   * vector leg re-hydrates its hits from it — so a rule added here cannot be
   * bypassed by whichever leg happened to find the document.
   */
  private baseQuery(tenantId: number, aiAgentId?: number | null) {
    const qb = (
      this.kbRepo
        .createQueryBuilder('kb')
        .where('kb.active = 1')
        .andWhere('(kb.tenantId = :tenantId OR kb.tenantId IS NULL)', { tenantId })
        // Un-designating a source is how an operator says "stop answering from
        // this". It never did: the flag lives on the source and retrieval only
        // ever looked at the document, so documents already ingested kept being
        // cited. Written as NOT IN the undesignated set rather than IN the
        // designated one, so documents with no source — hand-written, catalogue,
        // gap-promoted — are unaffected, and the subquery is empty in the normal
        // case where nothing has been turned off.
        .andWhere(
          `(kb.sourceId IS NULL OR kb.sourceId NOT IN
             (SELECT s.id FROM knowledge_sources s WHERE s.designated = 0))`,
        )
    );
    // Per-agent knowledge scope (REQ-260826 R2). Phrased as "not in the
    // categories this agent is excluded from" rather than "in the ones it is
    // allowed", so a tenant that has never scoped anything matches an empty set
    // and its answers are byte-identical to before. Documents with no category,
    // and categories nobody has narrowed, are never touched.
    //
    // `origin <> 'catalog'` is enforced here as well as on save: origin is a
    // property of what documents a category holds, so a hand-made category that
    // later takes catalogue documents flips to catalog while still carrying the
    // old narrowing (PR #342 met the same flip from the other side).
    if (aiAgentId != null) {
      qb.andWhere(
        `(kb.category IS NULL OR NOT EXISTS
           (SELECT 1 FROM kb_categories c
             WHERE c.tenant_id = :scopeTenantId
               AND c.doc_group = kb.doc_group
               AND c.name = kb.category
               AND c.origin <> 'catalog'
               AND JSON_LENGTH(c.agent_ids) > 0
               AND NOT JSON_CONTAINS(c.agent_ids, CAST(:scopeAgentId AS JSON))))`,
        { scopeTenantId: tenantId, scopeAgentId: aiAgentId },
      );
    }
    return qb;
  }

  /** Legacy keyword scan — only used when the FULLTEXT index is unavailable. */
  private async retrieveLike(
    tenantId: number,
    terms: string[],
    limit: number,
    aiAgentId?: number | null,
  ): Promise<KbDocument[]> {
    const qb = this.baseQuery(tenantId, aiAgentId).andWhere(
      new Brackets((b) => {
        terms.forEach((term, i) => {
          b.orWhere(`LOWER(kb.title) LIKE :t${i}`, { [`t${i}`]: `%${term}%` });
          b.orWhere(`LOWER(kb.content) LIKE :c${i}`, { [`c${i}`]: `%${term}%` });
        });
      }),
    );
    return qb
      .orderBy("CASE WHEN kb.source = 'knowledge_store' THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('kb.updatedAt', 'DESC')
      .take(limit)
      .getMany();
  }

  /**
   * Answer a shopper question from the tenant's knowledge base, optionally
   * grounded in `orderContext` — the signed-in customer's own order facts, which
   * the knowledge base cannot contain. Callers must only pass order data for an
   * authenticated session (see ChatService's auth gate).
   */
  async answer(
    tenantId: number,
    query: string,
    language: string,
    orderContext?: string,
    preferGroup?: string,
    retrievalQuery?: string,
    aiAgentId?: number | null,
    extraCandidates?: RagCandidateInput[],
    history?: AiMessage[],
    /** The account's previous conversation as a short transcript (PLN-261022 D14). */
    previousConversation?: string,
    /** Who is asking, from the host app's identify (PLN-261022 P8) — see caller-context.util. */
    caller?: string,
    /**
     * Reads the store for the product documents retrieved (PLN-261126): a
     * typed product question is answered from live stock and price. Null from
     * it = no store connected, and the prompt stays exactly as before.
     */
    storeLookup?: (handles: string[]) => Promise<LiveLookup | null>,
    /**
     * The storefront's products as names (PLN-261127), with `storeLookup`: a
     * colour sold as a product of its own is read — and carded — when the
     * shopper names it, though the knowledge base files it under another
     * colour of the same family. Absent or failing: as before.
     */
    catalogue?: () => Promise<CatalogueEntry[]>,
  ): Promise<RagAnswer> {
    // The caller decides the group preference; RAG only applies it. Keeping the
    // judgement out of here means the chat path can use its intent label and
    // the console can pass an explicit choice, without RAG knowing about either.
    //
    // `retrievalQuery` lets the caller search with more words than the model is
    // asked to answer — chat passes the previous turns so a follow-up that only
    // makes sense in context ("and for my young son?") still retrieves the topic
    // it refers to. `history` is the conversation itself (PLN-260929 S2): the
    // model reads the earlier turns so it stops asking for what the customer
    // already gave. Console callers pass none and get the single-question
    // prompt unchanged.
    // `aiAgentId` is applied as given, never resolved here. Null means "no
    // scope" — the console's operator view, which has to see everything it
    // manages. A widget turn is a different thing: an unpinned session answers
    // AS the default agent, so `chat.service` resolves it before calling and
    // hands the id down. Resolving in here made both callers mean the same
    // thing, and the operator view silently lost every scoped category
    // (found in the staging smoke, T9).
    const scopeAgentId = aiAgentId ?? null;
    // Which colour the shopper named (PLN-261127) is read from their own words
    // only — the message, then with their earlier turns (E4). The shop's last
    // reply, which retrievalQuery includes, may list a dozen colours.
    const entries = storeLookup && catalogue ? await this.catalogueNames(tenantId, catalogue) : [];
    const earlier = (history ?? []).filter((m) => m.role === 'user').slice(-2).map((m) => m.content);
    const shopperTexts = earlier.length ? [query, [...earlier, query].join('\n')] : [query];
    const familyHandles = entries.length ? RagService.namedFamilyHandles(entries, shopperTexts) : [];
    // eslint-disable-next-line prefer-const
    let { chunks, vectorProvider } = await this.retrieveHybrid(
      tenantId,
      retrievalQuery?.trim() || query,
      RagService.TOP_K,
      preferGroup,
      // The agent was already being passed for its persona; it decides what may
      // be retrieved as well (REQ-260826 R2).
      scopeAgentId,
      familyHandles,
    );
    // The current message searched on its own as well (FIX-261007-Topic-Switch).
    // Prepending the earlier turns rescues a follow-up with no topic words of
    // its own, but it also drags a NEW question back to the old topic: go2joy
    // "How do I process a guest check-in?" right after a staff-account answer
    // retrieved only staff documents (context query) while the check-in guide
    // was the top hit for the question alone — and the model said it had no
    // information, at 0.77. Both searches now contribute.
    if (retrievalQuery?.trim() && retrievalQuery.trim() !== query.trim()) {
      const own = await this.retrieveHybrid(tenantId, query, RagService.TOP_K, preferGroup, scopeAgentId, familyHandles);
      chunks = RagService.mergeOwnFirst(own.chunks, chunks, RagService.TOP_K);
      vectorProvider = vectorProvider ?? own.vectorProvider;
    }
    // Simulation candidates (B2): scored in the same embedding space and merged
    // by similarity, but NEVER written to Qdrant — a document an operator is
    // still judging must not be reachable from a real customer turn. Absent the
    // parameter this block is dead code and the production path is unchanged.
    if (extraCandidates?.length) {
      chunks = await this.mergeCandidates(retrievalQuery?.trim() || query, chunks, extraCandidates);
    }
    // Numbered so the model can name the items it actually used (see CITED_LINE).
    // Total prompt budget across documents (R3) — the numbering below must
    // match what the model sees, so the cap is applied to `chunks` itself.
    chunks = capContext(chunks);
    const context = chunks
      .map((c, i) => `[${i + 1}] [${c.category ?? 'general'}] ${c.title}: ${c.snippet}`)
      .join('\n');
    // Store data for the product documents in the context (PLN-261126): the
    // knowledge base keeps price and stock out on purpose, so a typed "is it in
    // stock?" is answered from what the store shows now. Numbered like the
    // context, so the model ties each line to the item it describes. A colour
    // the shopper named is read instead of the one its document is named
    // after, and first, so the read's 5-product cap never drops it (PLN-261127).
    const storeItems = storeLookup ? storeItemsFor(chunks, entries, shopperTexts) : [];
    const storeHandles = [
      ...new Set([...storeItems.filter((x) => x.named), ...storeItems.filter((x) => !x.named)].map((x) => x.handle)),
    ];
    const store = storeHandles.length ? await storeLookup!(storeHandles) : null;
    const storeBlock = store ? `\n${storeDataBlock(storeItems, store)}` : '';
    const hasOrderContext = !!orderContext?.trim();
    // Retrieval quality drives confidence, but order facts are authoritative on
    // their own: an order question answered from the customer's real orders must
    // not be escalated just because no help article matched.
    const confidence = Math.max(
      this.confidence(chunks, vectorProvider),
      hasOrderContext ? ORDER_CONTEXT_CONFIDENCE : 0,
    );

    // Persona + response rules of the session's AI agent (FR-047 / PLN-260820);
    // null falls back to the tenant's default agent.
    const { persona, rules } = await this.aiConfig.getPersonaRules(tenantId, aiAgentId);
    const rulesBlock = rules.length ? `\nResponse rules:\n${rules.map((r) => `- ${r}`).join('\n')}` : '';
    const orderBlock = hasOrderContext
      ? `\nCUSTOMER_ORDERS_START\n${orderContext!.trim()}\nCUSTOMER_ORDERS_END`
      : '';
    const storeSource = storeBlock ? ', STORE_DATA' : '';
    const sourceRule = hasOrderContext
      ? `Answer ONLY from the context${storeSource} and the customer's own order data below. ` +
        'The order data is authoritative for their order status, items and totals; ' +
        'never invent order numbers, dates or tracking details that are not listed.'
      : storeBlock
        ? 'Answer ONLY from the context and STORE_DATA.'
        : 'Answer ONLY from the context.';
    const storeRule = storeBlock
      ? STORE_RULE + (store?.ok && storeItems.some((x) => x.named) ? NAMED_VARIANT_RULE : '')
      : '';
    const hasHistory = !!history?.length;
    // Continuity, not evidence: the earlier chat explains "last time" and an
    // ongoing issue; the answer's facts still come from CONTEXT (PLN-261022 D14).
    const previousBlock = previousConversation?.trim()
      ? `\nPREVIOUS_CONVERSATION_START\n${previousConversation.trim()}\nPREVIOUS_CONVERSATION_END`
      : '';
    const previousRule = previousBlock
      ? 'PREVIOUS_CONVERSATION is this customer\'s earlier chat with us. Use it to understand references to it ' +
        '(an issue they raised before, "as I said last time") and to avoid asking again for what they already told us. ' +
        'Base facts and instructions on CONTEXT.\n'
      : '';
    // Who is asking (PLN-261022 P8): to address them and read "my hotel" — not evidence.
    const callerBlock = caller?.trim() ? `\n${caller.trim()}` : '';
    const callerRule = callerBlock ? CALLER_RULE : '';

    // The tenant's contact footer is appended by the system (R4); the model is
    // told not to write its own, which also frees the output budget.
    const footerOn = !!footerFor(await this.aiConfig.getAnswerFooter?.(tenantId), language);
    const request: Parameters<AiGatewayService['complete']>[0] = {
      tenantId,
      function: AI_FUNCTION.RAG,
      feature: 'chat_answer',
      // Long Vietnamese answers hit 1,024 and stopped mid-sentence (REQ-261007 I-5).
      maxTokens: envNumber('RAG_MAX_TOKENS', 2048),
      system:
        `${persona}${rulesBlock}${hasHistory ? CONVERSATION_RULES : ''}${footerOn ? FOOTER_RULE : ''}\n` +
        previousRule +
        callerRule +
        storeRule +
        `${sourceRule} If the information is insufficient, apologize briefly and ` +
        `offer to connect a human agent. ${replyLanguageRule(language)}\n` +
        `The context items are numbered. After your reply, on its own final line, ` +
        `write "CITED:" followed by the numbers of the items your answer actually ` +
        `used, comma separated (write "CITED:" with nothing after it if you used ` +
        `none). That line is internal bookkeeping: never mention it, never number ` +
        `or refer to the context items in the visible reply.\n` +
        `CONTEXT_START\n${context || '(no relevant documents found)'}\nCONTEXT_END` +
        orderBlock +
        storeBlock +
        previousBlock +
        callerBlock,
      messages: withCurrentTurn(history, query),
    };
    let res = await this.ai.complete(request);

    // An empty reply is retried once (FIX-261023-AI-Empty-Answer). go2joy
    // conversation 888 got a successful call whose visible text was empty; it
    // went on to moderation, whose classifier rejected the empty message with a
    // 400, and the customer was told the help content had no answer while the
    // same question answered fine on every re-run.
    if (!res.degraded && !splitCitedMarker(res.text).text) {
      this.logger.warn(`answer empty (tenant ${tenantId}, out ${res.tokensOut ?? 0} tokens) — retrying once`);
      res = await this.ai.complete(request);
    }

    // The engine failed and the stub's canned text came back (PLN-261007 D4).
    // Not an answer: zero confidence sends the turn to a person through the
    // ordinary low-confidence path instead of delivering "Here's what I found
    // for you: [category] title" as if it were one.
    if (res.degraded) {
      this.logger.warn(`answer withheld: engine degraded to stub (tenant ${tenantId})`);
      return { text: '', confidence: 0, citations: [], tokensIn: res.tokensIn, tokensOut: res.tokensOut };
    }

    // Show only what the answer stands on. The retrieved set is the top matches,
    // so recommending one cleanser used to surface a concealer and a night cream
    // next to it as "referenced" products (FIX-260806 §7-1). Matching the answer
    // text against titles cannot do this — replies are localized while the
    // catalogue titles are English — so the model reports which items it used.
    const { text: visible, cited } = splitCitedMarker(res.text);
    // Still nothing to say: not an answer, so the turn takes the ordinary
    // low-confidence handoff instead of reaching moderation empty.
    if (!visible) {
      this.logger.warn(`answer withheld: empty after retry (tenant ${tenantId})`);
      return { text: '', confidence: 0, citations: [], tokensIn: res.tokensIn, tokensOut: res.tokensOut };
    }
    // The marker is already split off, so a translation cannot disturb the
    // citations; the visible text alone is judged and, if need be, redone.
    const text = await this.enforceReplyLanguage(tenantId, visible, language);
    const products = answerProductCards(storeItems, cited, store);
    return {
      text,
      confidence,
      // No marker (older/odd model output) → keep every citation, i.e. exactly
      // the previous behavior, rather than silently dropping all the links.
      citations: cited ? chunks.filter((_, i) => cited.includes(i + 1)) : chunks,
      ...(products.length ? { products } : {}),
      ...(store ? { storeData: store.ok ? store.products.size : -1 } : {}),
      // The simulation needs the candidate's similarity even when the model
      // did NOT cite it — "ranked 0.31, unused" is the finding.
      ...(extraCandidates?.length ? { candidateResults: chunks.filter((c) => c.candidate) } : {}),
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
    };
  }

  /** Cosine-rank the candidates against the query and merge (B2 P4-4). */
  private async mergeCandidates(
    query: string,
    chunks: RetrievedChunk[],
    candidates: RagCandidateInput[],
  ): Promise<RetrievedChunk[]> {
    const [qEmb, cEmb] = await Promise.all([
      this.ai.embed([query], 'query'),
      this.ai.embed(
        candidates.map((c) => `${c.title}\n${c.content}`.slice(0, 30_000)),
        'document',
      ),
    ]);
    const q = qEmb.vectors[0];
    const cosine = (v: number[]): number => {
      let dot = 0;
      let nq = 0;
      let nv = 0;
      for (let i = 0; i < Math.min(q.length, v.length); i++) {
        dot += q[i] * v[i];
        nq += q[i] * q[i];
        nv += v[i] * v[i];
      }
      const denom = Math.sqrt(nq) * Math.sqrt(nv);
      return denom > 0 ? dot / denom : 0;
    };
    const candidateChunks: RetrievedChunk[] = candidates.map((c, i) => ({
      // Negative synthetic ids — they can never collide with (or load) a real
      // kb_documents row downstream.
      id: -(i + 1),
      title: c.title,
      category: c.category,
      source: 'board',
      group: c.group,
      url: null,
      snippet: c.content.slice(0, 400),
      similarity: cosine(cEmb.vectors[i]),
      candidate: true,
    }));
    // Candidates are always in the context — the question being answered is
    // "what happens once this IS knowledge" — but they take their honest rank.
    return [...chunks, ...candidateChunks].sort(
      (a, b) => (b.similarity ?? -1) - (a.similarity ?? -1),
    );
  }

  /**
   * Similarity-based confidence (replaces the hit-count formula). The best
   * dense similarity IS the grounding signal: below RAG_MIN_SIMILARITY the
   * retrieval is judged off-topic and confidence drops to 0.2, which is under
   * the chat escalation threshold — "don't know → hand off" (policy §0.4).
   * Applied only for calibrated real embeddings (voyage): stub pseudo-vector
   * scores live on a different scale, and when the vector leg didn't run at
   * all (Qdrant disabled/down) there is no similarity — both cases fall back
   * to the legacy count-based estimate, i.e. the pre-hybrid behavior.
   */
  private confidence(chunks: RetrievedChunk[], vectorProvider: string | null): number {
    // Real embeddings are configured but this turn did not get them — the
    // gateway fell back to the stub, or the vector leg threw (FIX-260930 D2).
    // The count formula below then scored full-text noise at 0.95: ivyusa's
    // "What is your return policy?" was answered "I don't have that
    // information" with six unrelated products and nobody paged. Without the
    // signal we trust, "don't know → hand off" (policy §0.4) is the safe
    // reading, so the turn goes to a person instead.
    // Qdrant switched off is configuration, not failure — that keeps the
    // count-based estimate below, exactly as before.
    if (process.env.VOYAGE_API_KEY && this.qdrant.enabled && vectorProvider !== 'voyage') {
      this.logger.warn(`vector leg degraded (provider=${vectorProvider ?? 'none'}) — confidence withheld`);
      return RagService.DEGRADED_CONFIDENCE;
    }
    const best = chunks.reduce<number | null>(
      (m, c) => (c.similarity !== null && (m === null || c.similarity > m) ? c.similarity : m),
      null,
    );
    if (vectorProvider === 'voyage' && best !== null) {
      const minSim = envNumber('RAG_MIN_SIMILARITY', '0.45');
      return best >= minSim ? Math.min(0.95, Math.max(0.5, best)) : 0.2;
    }
    return chunks.length ? Math.min(0.95, 0.5 + chunks.length * 0.12) : 0.2;
  }

  /**
   * Reply to a turn that has nothing to look up (PLN-260813 P2).
   *
   * A greeting resembles no document, so retrieval returns nothing and the old
   * path read that as "no answer found" and paged a human. This answers from
   * the persona alone — no embedding, no vector search, no citations — which is
   * both correct and cheaper than the RAG call it replaces.
   */
  async answerWithoutKnowledge(
    tenantId: number,
    kind: 'smalltalk' | 'out_of_scope' | 'unintelligible',
    query: string,
    language: string,
    aiAgentId?: number | null,
    history?: AiMessage[],
    /** Who is asking (PLN-261022 P8) — a greeting can use their name. */
    caller?: string,
  ): Promise<string> {
    const { persona, rules } = await this.aiConfig.getPersonaRules(tenantId, aiAgentId);
    const instruction = NO_KNOWLEDGE_INSTRUCTION[kind];
    const callerPart = caller?.trim() ? `\n${CALLER_RULE}${caller.trim()}` : '';
    // A misclassified reply ("1. 김익용" to "what is your name?") lands here too;
    // with the conversation in view the model answers it instead of saying it
    // did not understand (PLN-260929 S3).
    const memory = history?.length ? CONVERSATION_RULES : '';
    const request: Parameters<AiGatewayService['complete']>[0] = {
      tenantId,
      function: AI_FUNCTION.RAG,
      feature: 'chat_rewrite',
      system:
        `${persona}\n${rules.map((r) => `- ${r}`).join('\n')}${memory}\n` +
        `${instruction}\n${replyLanguageRule(language)} Two sentences at most.` +
        callerPart,
      messages: withCurrentTurn(history, query),
    };
    let res = await this.ai.complete(request);
    // Same single retry as answer() (FIX-261023-AI-Empty-Answer).
    if (!res.degraded && !res.text.trim()) {
      this.logger.warn(`no-knowledge reply empty (tenant ${tenantId}) — retrying once`);
      res = await this.ai.complete(request);
    }
    // Empty = no reply could be written; the caller hands off (PLN-261007 D4).
    if (res.degraded) return '';
    return this.enforceReplyLanguage(tenantId, res.text.trim(), language);
  }

  /**
   * Safety net behind `replyLanguageRule` (PLN-261019 D4). The model is
   * probabilistic; when the visible reply is plainly in the wrong script it is
   * translated once, and the translation is delivered only if it passes the
   * same check. Either way the mismatch is logged, so how often the prompt
   * alone fails stays measurable. Costs one extra call on mismatched turns
   * only — 5 of ~700 go2joy answers in the 45 days before this existed.
   */
  private async enforceReplyLanguage(tenantId: number, text: string, language: string): Promise<string> {
    if (!text || !replyLanguageMismatch(text, language)) return text;
    const code = String(language || 'en').toLowerCase();
    const name = PROMPT_LANGUAGE_NAMES[code] ?? code.toUpperCase();
    this.logger.warn(`reply language mismatch: tenant=${tenantId} expected=${code} — translating once`);
    try {
      const res = await this.ai.complete({
        tenantId,
        function: AI_FUNCTION.RAG,
        feature: 'chat_answer_language_fix',
        maxTokens: envNumber('RAG_MAX_TOKENS', 2048),
        system:
          `Translate the assistant reply below into ${name} (${code}). Keep the meaning, ` +
          `the markdown formatting, lists and links exactly as they are; translate every ` +
          `sentence, including any written in other languages. Output only the translated reply.`,
        messages: [{ role: 'user', content: text }],
      });
      const fixed = res.text.trim();
      if (res.degraded || !fixed || replyLanguageMismatch(fixed, language)) {
        this.logger.warn(`reply language fix failed: tenant=${tenantId} expected=${code} degraded=${!!res.degraded}`);
        return text;
      }
      this.logger.log(`reply language fixed: tenant=${tenantId} → ${code}`);
      return fixed;
    } catch (e) {
      this.logger.warn(`reply language fix threw: tenant=${tenantId} ${(e as Error).message}`);
      return text;
    }
  }

  async classifyIntent(
    tenantId: number,
    query: string,
    recent?: AiMessage[],
  ): Promise<{ intent: string; needsOrderData: boolean; confidence: number; fallback?: boolean }> {
    // The exchange the message answers, as reference text in the system prompt
    // rather than as turns: the classifier labels the final message only
    // (PLN-260929 S4). Without it "벽걸이" or "1. 김익용" after a question read
    // as noise and fell into the no-knowledge branch.
    const recentBlock = recent?.length
      ? '\nRecent conversation (context only — classify ONLY the final shopper ' +
        `message):\n${transcript(recent)}\n` +
        "If the shopper's message answers a question the assistant just asked, " +
        'classify it by the topic of the conversation — never unintelligible, ' +
        'smalltalk or out_of_scope.'
      : '';
    const res = await this.ai.complete({
      tenantId,
      function: AI_FUNCTION.CHAT,
      feature: 'chat_rewrite',
      system:
        // A closed set, not free text (PLN-260813 P1). Handing off when the
        // shopper asks for a person needs an intent value that arrives
        // spelled the same way every time; a free-form label produced
        // 'agent_request', 'human_handoff' and 'talk_to_agent' for the same
        // sentence.
        'JSON_MODE:intent. Classify the shopper message. `intent` must be one ' +
          'of: order_status, delivery, cancel_refund, product_inquiry, ' +
          'agent_request, smalltalk, out_of_scope, unintelligible, other. ' +
          'agent_request only when the shopper is asking to reach a human, not ' +
          'when they merely mention agents. Asking HOW to contact support (which ' +
          'phone number, e-mail or channel, or "how do I reach technical support?") ' +
          'is a question to answer — other, not agent_request. smalltalk = greetings, thanks, ' +
          'compliments, chat with nothing to answer. out_of_scope = a real ' +
          'question this shop cannot answer (weather, exchange rates, news). ' +
          'unintelligible = the message cannot be read as language. ' +
          'IMPORTANT: a greeting followed by a real question takes the ' +
          "question's intent — \"Hi, where is my order?\" is order_status, not " +
          'smalltalk. Return ' +
          '{"intent":string,"needsOrderData":boolean,"confidence":number}.' +
          recentBlock,
      messages: [{ role: 'user', content: query }],
    });
    try {
      // The stub's keyword guess is not a classification (PLN-261007 D4).
      if (res.degraded) throw new Error('degraded');
      return JSON.parse(res.text);
    } catch {
      // The fallback label is 'product_inquiry', so an unparseable response
      // would otherwise read as a confident product question and bias
      // retrieval toward the product group. Mark it so callers can tell the
      // difference between "classified as product" and "classification failed".
      return { intent: 'product_inquiry', needsOrderData: false, confidence: 0.5, fallback: true };
    }
  }
}
