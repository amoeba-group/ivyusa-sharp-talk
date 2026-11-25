import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductRecommendation } from './entity/product-recommendation.entity';
import { TenantAiConfig } from '../ai-engine/entity/tenant-ai-config.entity';
import { TenantService } from '../tenant/tenant.service';
import { AuditService } from '../audit/audit.service';
import { ShopifyAdminClient, type ShopifyBestSeller } from '../order/shopify-admin.client';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/**
 * Product recommendations in two modes (IVY PRD v1 A-01…A-04,
 * PLN-261125-IVY-Recommended-Products).
 *
 * Per Product Help category × type (popular / recommended / new):
 * - **Admin Selected** — the admin's products, in their order, while the
 *   display period runs. All of them out of stock → filled from AI Auto (the
 *   PRD's proposal).
 * - **AI Auto** (the default) — the collection's products ranked by last-30-day
 *   sales and review score; with no data at all, the store's own best-selling
 *   order.
 * Either way: never out of stock, never hidden, at most three cards, each
 * product once.
 */

export const REC_TYPES = ['popular', 'recommended', 'new'] as const;
export type RecType = (typeof REC_TYPES)[number];
export const REC_MODES = ['auto', 'admin'] as const;
export type RecConfigMode = (typeof REC_MODES)[number];
/** Which rule produced an answer — returned and logged (PRD v1 A-04 "mode log"). */
export type RecMode = 'admin' | 'admin_fallback' | 'auto' | 'auto_bestseller';

/** PRD slide 18 proposal: up to 10 picked products. */
export const REC_ADMIN_MAX = 10;
/** PRD slide 16: "AI description + up to 3 product cards". */
export const REC_CARD_MAX = 3;
/** PRD slide 18 proposal: last 30 days of sales. */
export const REC_SALES_DAYS = 30;
/** Weights pending IVY (PRD slide 24 item 1); sales lead, reviews refine. */
export const REC_WEIGHTS = { sales: 0.7, reviews: 0.3 } as const;
/** How deep into the collection AI Auto looks. */
const AUTO_CANDIDATES = 50;
/** Audit action for every saved change (PRD slide 18 "change history"). */
export const REC_AUDIT_ACTION = 'product_recommendation.updated';

export interface RecommendationConfigView {
  categoryHandle: string;
  recType: string;
  mode: string;
  productHandles: string[];
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string | null;
}

export interface RecommendationResult {
  available: boolean;
  mode: RecMode | null;
  products: ShopifyBestSeller[];
}

export interface SaveRecommendationInput {
  categoryHandle: string;
  recType: string;
  mode: string;
  productHandles?: string[] | null;
  startsAt?: string | null;
  endsAt?: string | null;
}

/** The mode a config puts into effect at `now`: Admin Selected only inside its period and with products. */
export function effectiveMode(
  config: Pick<ProductRecommendation, 'mode' | 'productHandles' | 'startsAt' | 'endsAt'> | null,
  now: Date = new Date(),
): RecConfigMode {
  if (!config || config.mode !== 'admin' || !(config.productHandles ?? []).length) return 'auto';
  if (config.startsAt && new Date(config.startsAt).getTime() > now.getTime()) return 'auto';
  if (config.endsAt && new Date(config.endsAt).getTime() < now.getTime()) return 'auto';
  return 'admin';
}

/** The admin's picks in their order, on sale, each once. */
export function pickAdmin(handles: readonly string[], byHandle: ReadonlyMap<string, ShopifyBestSeller>): ShopifyBestSeller[] {
  const seen = new Set<string>();
  const out: ShopifyBestSeller[] = [];
  for (const h of handles) {
    const p = byHandle.get(h);
    if (!p || seen.has(p.handle) || p.available === false) continue;
    seen.add(p.handle);
    out.push(p);
  }
  return out;
}

/**
 * AI Auto ranking (PRD slide 15/18): sales and review score, each scaled to
 * 0–1 across the candidates, weighted 0.7 / 0.3. Ties keep the store's
 * best-selling order. `usedData` false = nobody had sales or reviews, so the
 * order is simply the store's (PRD: "use the category bestseller collection").
 */
export function rankAuto(
  candidates: readonly ShopifyBestSeller[],
  sales: ReadonlyMap<string, number>,
  ratings: ReadonlyMap<string, number>,
): { products: ShopifyBestSeller[]; usedData: boolean } {
  const seen = new Set<string>();
  const pool = candidates.filter((p) => {
    if (p.available === false || seen.has(p.handle)) return false;
    seen.add(p.handle);
    return true;
  });
  const salesOf = (p: ShopifyBestSeller) => (p.productId ? sales.get(String(p.productId)) ?? 0 : 0);
  const ratingOf = (p: ShopifyBestSeller) => (p.productId ? ratings.get(String(p.productId)) ?? 0 : 0);
  const maxSales = Math.max(0, ...pool.map(salesOf));
  const anyRating = pool.some((p) => ratingOf(p) > 0);
  if (maxSales === 0 && !anyRating) return { products: pool, usedData: false };
  const score = (p: ShopifyBestSeller) =>
    REC_WEIGHTS.sales * (maxSales > 0 ? salesOf(p) / maxSales : 0) + REC_WEIGHTS.reviews * (ratingOf(p) / 5);
  const ranked = pool
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
  return { products: ranked, usedData: true };
}

/** A YYYY-MM-DD or ISO input as a Date, or null; anything else is invalid. */
function parseDay(value: string | null | undefined, endOfDay: boolean): Date | null | 'invalid' {
  if (value == null || value === '') return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z` : value;
  const d = new Date(day);
  return Number.isNaN(d.getTime()) ? 'invalid' : d;
}

export const popularCacheKeyOf = (tenantId: number, handle: string) => `popular:v1:${tenantId}:${handle}`;

@Injectable()
export class ProductRecommendationService {
  private readonly logger = new Logger(ProductRecommendationService.name);

  constructor(
    @InjectRepository(ProductRecommendation) private readonly recRepo: Repository<ProductRecommendation>,
    @InjectRepository(TenantAiConfig) private readonly configRepo: Repository<TenantAiConfig>,
    private readonly tenantService: TenantService,
    private readonly client: ShopifyAdminClient,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  /** The tenant's Product Help categories (the 11 IVY collections), in button order. */
  async categories(tenantId: number): Promise<Array<{ id: string; label: unknown }>> {
    const row = await this.configRepo.findOne({ where: { tenantId } });
    const seen = new Set<string>();
    const out: Array<{ id: string; label: unknown }> = [];
    for (const b of row?.scenarioButtons ?? []) {
      if (!b.enabled || b.action !== 'product_help') continue;
      for (const c of b.categories ?? []) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        out.push({ id: c.id, label: (c as { label?: unknown }).label ?? c.id });
      }
    }
    return out;
  }

  /**
   * Up to `limit` products for one category and type, with the mode that chose
   * them. `available: false` = the store could not be read (no connection, the
   * collection is gone) — the widget then links the category page.
   */
  async recommend(tenantId: number, handle: string, type: RecType = 'popular', limit = REC_CARD_MAX): Promise<RecommendationResult> {
    const conn = await this.tenantService.getShopifyConnection(tenantId);
    if (!conn) {
      this.logger.warn(`tenant ${tenantId}: no Shopify connection — recommendations unavailable`);
      return { available: false, mode: null, products: [] };
    }
    const config = await this.recRepo.findOne({ where: { tenantId, categoryHandle: handle, recType: type } });
    let fallback = false;
    if (effectiveMode(config) === 'admin') {
      const handles = (config!.productHandles ?? []).slice(0, REC_ADMIN_MAX);
      const byHandle = await this.client.fetchProductsByHandles(conn.shopDomain, conn.token, handles);
      const picked = pickAdmin(handles, byHandle);
      if (picked.length) {
        this.logger.log(`recommend tenant ${tenantId} ${handle}/${type}: admin (${picked.length})`);
        return { available: true, mode: 'admin', products: picked.slice(0, limit) };
      }
      // Every pick is out of stock or gone: AI Auto fills in (PRD slide 16 proposal).
      fallback = true;
    }
    const candidates = await this.client.fetchCollectionBestSellers(conn.shopDomain, conn.token, handle, AUTO_CANDIDATES);
    if (candidates === null) {
      this.logger.warn(`tenant ${tenantId}: collection "${handle}" not found on the store`);
      return { available: false, mode: null, products: [] };
    }
    const ids = candidates.map((c) => c.productId).filter((id): id is string => !!id);
    const [sales, ratings] = await Promise.all([this.salesByProduct(tenantId, ids), this.ratingsByProduct(tenantId, ids)]);
    const ranked = rankAuto(candidates, sales, ratings);
    const mode: RecMode = fallback ? 'admin_fallback' : ranked.usedData ? 'auto' : 'auto_bestseller';
    this.logger.log(`recommend tenant ${tenantId} ${handle}/${type}: ${mode} (${Math.min(limit, ranked.products.length)})`);
    return { available: true, mode, products: ranked.products.slice(0, limit) };
  }

  /** Units sold per Shopify product id in the last 30 days; cancelled and refunded orders do not count. */
  async salesByProduct(tenantId: number, productIds: readonly string[]): Promise<Map<string, number>> {
    if (!productIds.length) return new Map();
    try {
      const rows: Array<{ pid: string; qty: string | number }> = await this.recRepo.query(
        `SELECT oi.product_id AS pid, SUM(oi.qty) AS qty
           FROM order_items oi
           JOIN orders_cache o ON o.id = oi.order_id
          WHERE o.tenant_id = ?
            AND oi.product_id IN (?)
            AND COALESCE(o.ordered_at, o.created_at) >= DATE_SUB(NOW(), INTERVAL ${REC_SALES_DAYS} DAY)
            AND (o.status_internal IS NULL OR o.status_internal NOT IN ('cancelled', 'refunded'))
          GROUP BY oi.product_id`,
        [tenantId, [...productIds]],
      );
      return new Map(rows.map((r) => [String(r.pid), Number(r.qty) || 0]));
    } catch (e) {
      this.logger.warn(`tenant ${tenantId}: sales for recommendations unreadable (${(e as Error).message})`);
      return new Map();
    }
  }

  /** Average review score per Shopify product id, from reviews shoppers wrote in the widget. */
  async ratingsByProduct(tenantId: number, productIds: readonly string[]): Promise<Map<string, number>> {
    if (!productIds.length) return new Map();
    try {
      const rows: Array<{ pid: string; avg: string | number }> = await this.recRepo.query(
        `SELECT oi.product_id AS pid, AVG(r.rating) AS avg
           FROM reviews r
           JOIN order_items oi ON oi.id = r.order_item_id
          WHERE r.tenant_id = ?
            AND r.status = 'submitted'
            AND oi.product_id IN (?)
          GROUP BY oi.product_id`,
        [tenantId, [...productIds]],
      );
      return new Map(rows.map((r) => [String(r.pid), Number(r.avg) || 0]));
    } catch (e) {
      this.logger.warn(`tenant ${tenantId}: review scores for recommendations unreadable (${(e as Error).message})`);
      return new Map();
    }
  }

  // ---- console ------------------------------------------------------------

  /** Categories, every saved config, the picked products' cards, and recent changes. */
  async adminView(tenantId: number) {
    const [categories, rows, history] = await Promise.all([
      this.categories(tenantId),
      this.recRepo.find({ where: { tenantId }, order: { id: 'ASC' } }),
      this.audit.list({ tenantId, action: REC_AUDIT_ACTION, page: 1, size: 20 }),
    ]);
    const handles = [...new Set(rows.flatMap((r) => r.productHandles ?? []))];
    let products: Record<string, ShopifyBestSeller> = {};
    if (handles.length) {
      const conn = await this.tenantService.getShopifyConnection(tenantId);
      if (conn) {
        try {
          const byHandle = await this.client.fetchProductsByHandles(conn.shopDomain, conn.token, handles.slice(0, 50));
          products = Object.fromEntries(byHandle);
        } catch (e) {
          this.logger.warn(`tenant ${tenantId}: picked products unreadable (${(e as Error).message})`);
        }
      }
    }
    return {
      categories,
      types: [...REC_TYPES],
      maxProducts: REC_ADMIN_MAX,
      configs: rows.map((r) => this.toView(r)),
      products,
      history: history.items.map((h) => ({
        at: h.createdAt,
        actor: h.actorName ?? null,
        target: h.target,
        metadata: h.metadata,
      })),
    };
  }

  /** Save one category × type. Validated, audited with before / after, cache dropped. */
  async save(tenantId: number, userId: number, input: SaveRecommendationInput): Promise<RecommendationConfigView> {
    const handle = String(input.categoryHandle ?? '').trim();
    const type = String(input.recType ?? '').trim();
    const mode = String(input.mode ?? '').trim();
    const handles = [...new Set((input.productHandles ?? []).map((h) => String(h).trim().toLowerCase()).filter(Boolean))];
    const startsAt = parseDay(input.startsAt, false);
    const endsAt = parseDay(input.endsAt, true);
    const categories = new Set((await this.categories(tenantId)).map((c) => c.id));
    const invalid =
      !categories.has(handle) ||
      !(REC_TYPES as readonly string[]).includes(type) ||
      !(REC_MODES as readonly string[]).includes(mode) ||
      handles.length > REC_ADMIN_MAX ||
      handles.some((h) => !/^[a-z0-9][a-z0-9-]*$/.test(h) || h.length > 255) ||
      startsAt === 'invalid' ||
      endsAt === 'invalid' ||
      (startsAt instanceof Date && endsAt instanceof Date && startsAt.getTime() > endsAt.getTime());
    if (invalid) {
      this.logger.warn(`recommendation config refused (tenant ${tenantId}, ${handle}/${type}/${mode}, ${handles.length} products)`);
      throw new BusinessException(ERROR_CODE.RECOMMENDATION_INVALID, HttpStatus.BAD_REQUEST);
    }
    const existing = await this.recRepo.findOne({ where: { tenantId, categoryHandle: handle, recType: type } });
    const before = existing ? this.toView(existing) : null;
    const row =
      existing ?? this.recRepo.create({ tenantId, categoryHandle: handle, recType: type });
    row.mode = mode;
    row.productHandles = handles;
    row.startsAt = startsAt as Date | null;
    row.endsAt = endsAt as Date | null;
    row.updatedBy = userId;
    const saved = await this.recRepo.save(row);
    const after = this.toView(saved);
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: REC_AUDIT_ACTION,
      target: `${handle}/${type}`,
      metadata: { before, after },
    });
    // The widget sees the change at once, not after the 15-minute cache.
    if (type === 'popular') await this.redis.del(popularCacheKeyOf(tenantId, handle));
    return after;
  }

  /** Store products matching what the admin typed. */
  async search(tenantId: number, q: string): Promise<ShopifyBestSeller[]> {
    const conn = await this.tenantService.getShopifyConnection(tenantId);
    if (!conn || !q.trim()) return [];
    return this.client.searchProducts(conn.shopDomain, conn.token, q);
  }

  /** What a shopper would see right now for this category × type. */
  async preview(tenantId: number, handle: string, type: string): Promise<RecommendationResult> {
    const categories = new Set((await this.categories(tenantId)).map((c) => c.id));
    if (!categories.has(handle) || !(REC_TYPES as readonly string[]).includes(type)) {
      throw new BusinessException(ERROR_CODE.RECOMMENDATION_INVALID, HttpStatus.BAD_REQUEST);
    }
    return this.recommend(tenantId, handle, type as RecType);
  }

  private toView(r: ProductRecommendation): RecommendationConfigView {
    const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
    return {
      categoryHandle: r.categoryHandle,
      recType: r.recType,
      mode: r.mode,
      productHandles: r.productHandles ?? [],
      startsAt: iso(r.startsAt),
      endsAt: iso(r.endsAt),
      updatedAt: iso(r.updatedAt),
    };
  }
}
