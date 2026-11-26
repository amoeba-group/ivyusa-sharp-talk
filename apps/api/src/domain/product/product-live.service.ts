import { Injectable, Logger } from '@nestjs/common';
import { TenantService } from '../tenant/tenant.service';
import { ShopifyAdminClient, ShopifyLiveProduct } from '../order/shopify-admin.client';
import { RedisService } from '../../infrastructure/cache/redis.service';

/** Products read for one answer: the retrieved product documents, best first. */
export const LIVE_LOOKUP_MAX = 5;

/** Same window as the stock inquiry: repeated questions are one store call. */
const LIVE_CACHE_SEC = 120;

/**
 * How long a chat answer waits for the store. The client's own limit is 10 s —
 * fine for a sync, too long for a shopper watching "Writing a reply…"; past
 * this the answer goes on as if the store could not be read.
 */
export const LIVE_TIMEOUT_MS = 4_000;

/** What the store said about the handles asked, or that it could not be read. */
export type LiveLookup = { ok: true; products: Map<string, ShopifyLiveProduct> } | { ok: false };

/**
 * Store data for a typed product question (IVY PRD v1 slide 14 "Product ·
 * stock → product catalog · stock data"; PLN-261126). The knowledge base holds
 * descriptions only — price and stock are kept out of it on purpose, because a
 * value frozen into the index goes stale without anyone noticing — so the
 * answer reads them from the store at the moment it is written.
 */
@Injectable()
export class ProductLiveService {
  private readonly logger = new Logger(ProductLiveService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly client: ShopifyAdminClient,
    private readonly redis: RedisService,
  ) {}

  /**
   * Null when the tenant has no Shopify store connected: the caller then
   * answers exactly as before. `ok: false` when the store could not be read —
   * the answer must then not state stock or price at all.
   */
  async lookup(tenantId: number, handles: readonly string[]): Promise<LiveLookup | null> {
    const wanted = [...new Set(handles.map((h) => h.trim().toLowerCase()).filter(Boolean))].slice(
      0,
      LIVE_LOOKUP_MAX,
    );
    let conn: { shopDomain: string; token: string } | null;
    try {
      conn = await this.tenantService.getShopifyConnection(tenantId);
    } catch (e) {
      // A token that cannot be refreshed is a store we cannot read, not a
      // reason to lose the shopper's answer.
      this.logger.warn(`tenant ${tenantId}: no store connection for a live product read (${(e as Error).message})`);
      return { ok: false };
    }
    if (!conn) return null;
    if (!wanted.length) return { ok: true, products: new Map() };

    const key = `live:v1:${tenantId}:${[...wanted].sort().join(',')}`;
    const hit = await this.redis.get(key);
    if (hit) {
      try {
        return { ok: true, products: new Map(JSON.parse(hit) as Array<[string, ShopifyLiveProduct]>) };
      } catch {
        // A bad cache entry is just a miss.
      }
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const products = await Promise.race([
        this.client.fetchLiveProducts(conn.shopDomain, conn.token, wanted),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`no answer within ${LIVE_TIMEOUT_MS} ms`)), LIVE_TIMEOUT_MS);
        }),
      ]);
      await this.redis.set(key, JSON.stringify([...products]), LIVE_CACHE_SEC);
      return { ok: true, products };
    } catch (e) {
      this.logger.warn(`tenant ${tenantId}: live product read failed (${(e as Error).message})`);
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
}
