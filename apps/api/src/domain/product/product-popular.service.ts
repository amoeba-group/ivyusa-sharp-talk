import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PopularProductsResponse } from '@sharptalk/types';
import { collectionHandleFrom, collectionUrl } from '@sharptalk/types';
import { TenantAiConfig } from '../ai-engine/entity/tenant-ai-config.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { TenantService } from '../tenant/tenant.service';
import { SessionService } from '../session/session.service';
import { ShopifyAdminClient } from '../order/shopify-admin.client';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/** Cards per answer (PLN-261112-T10 D3). */
export const POPULAR_SIZE = 5;
/** How long Product Help waits on Shopify before offering the store link instead. */
export const POPULAR_TIMEOUT_MS = 4_000;
/** Best sellers move slowly: 15 minutes per collection keeps Shopify calls to a few an hour. */
const CACHE_TTL_SEC = 15 * 60;
/** A failed read is remembered briefly, so a store outage is not asked again on every tap. */
const FAILURE_TTL_SEC = 60;

export const popularCacheKey = (tenantId: number, handle: string) => `popular:v1:${tenantId}:${handle}`;

/**
 * "Popular products" for a Product Help category (ivy-docs T10 D3, G-16).
 *
 * The catalogue cache has no sales figures and its `category` is Shopify's
 * product type, not the store's collections, so neither "popular" nor the
 * eleven design categories can come from it. The store's own best-selling
 * order per collection can — read live through the Admin API, cached briefly.
 *
 * Only collections the tenant listed on its Product Help button are served:
 * this is a public endpoint, and it must not turn the store token into a
 * lookup service for any handle a caller makes up.
 */
@Injectable()
export class ProductPopularService {
  private readonly logger = new Logger(ProductPopularService.name);

  constructor(
    @InjectRepository(TenantAiConfig) private readonly configRepo: Repository<TenantAiConfig>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly sessionService: SessionService,
    private readonly tenantService: TenantService,
    private readonly client: ShopifyAdminClient,
    private readonly redis: RedisService,
  ) {}

  async popularForSession(token: string, category: string | undefined): Promise<PopularProductsResponse> {
    const session = await this.sessionService.findByToken(token);
    const tenantId = session.tenantId;
    const handle = collectionHandleFrom(category);
    if (tenantId == null || !handle || !(await this.configuredHandles(tenantId)).has(handle)) {
      throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const origin = (tenant?.storefrontUrl ?? (tenant?.shopDomain ? `https://${tenant.shopDomain}` : '')).trim();
    const link = origin ? collectionUrl(origin, handle) : null;

    const key = popularCacheKey(tenantId, handle);
    const hit = await this.redis.get(key);
    if (hit) {
      try {
        return { ...(JSON.parse(hit) as Omit<PopularProductsResponse, 'collectionUrl'>), collectionUrl: link };
      } catch {
        // A bad cache entry is just a miss.
      }
    }

    const read = await this.readStore(tenantId, tenant?.shopDomain ?? null, handle);
    await this.redis.set(key, JSON.stringify(read), read.available ? CACHE_TTL_SEC : FAILURE_TTL_SEC);
    return { ...read, collectionUrl: link };
  }

  /** Handles listed on the tenant's enabled Product Help buttons. */
  private async configuredHandles(tenantId: number): Promise<Set<string>> {
    const row = await this.configRepo.findOne({ where: { tenantId } });
    return new Set(
      (row?.scenarioButtons ?? [])
        .filter((b) => b.enabled && b.action === 'product_help')
        .flatMap((b) => (b.categories ?? []).map((c) => c.id)),
    );
  }

  private async readStore(
    tenantId: number,
    shopDomain: string | null,
    handle: string,
  ): Promise<Omit<PopularProductsResponse, 'collectionUrl'>> {
    try {
      const conn = shopDomain ? await this.tenantService.getShopifyConnection(tenantId) : null;
      if (!conn) {
        this.logger.warn(`tenant ${tenantId}: no Shopify connection — popular products unavailable`);
        return { available: false, products: [] };
      }
      const rows = await this.withTimeout(
        this.client.fetchCollectionBestSellers(conn.shopDomain, conn.token, handle, POPULAR_SIZE),
      );
      if (rows === null) {
        // A configured handle the store does not have: a typo in the console.
        this.logger.warn(`tenant ${tenantId}: collection "${handle}" not found on the store`);
        return { available: false, products: [] };
      }
      return { available: true, products: rows };
    } catch (e) {
      this.logger.warn(`tenant ${tenantId}: popular "${handle}" unavailable (${(e as Error)?.message ?? String(e)})`);
      return { available: false, products: [] };
    }
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${POPULAR_TIMEOUT_MS} ms`)), POPULAR_TIMEOUT_MS);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }
}
