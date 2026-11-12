import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { OrderAddressesResponse } from '@sharptalk/types';
import { OrderCache } from './entity/order-cache.entity';
import { OrderMapper } from './order.mapper';
import { ShopifyAdminClient } from './shopify-admin.client';
import { SessionService } from '../session/session.service';
import { TenantService } from '../tenant/tenant.service';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/**
 * How long Order Detail waits on Shopify for the address block. The rest of the
 * screen does not wait at all (separate request), so this only bounds how long
 * the block shows its placeholder before it gives up and hides.
 */
export const ADDRESS_TIMEOUT_MS = 4_000;

/** Why a denial is logged at most once per tenant per process, not per open. */
const DENIAL_LOG_EVERY_MS = 60 * 60 * 1000;

const UNAVAILABLE: OrderAddressesResponse = { available: false, billing: null, shipping: null };

/**
 * Order Detail addresses (ivy-docs T04 D1), read live from the store and never
 * stored: not in the DB, not in a cache, not in a log line. Addresses and phone
 * are Shopify protected customer data, so this works only once the app has
 * Address + Phone access; until then every answer is `available: false` and
 * the widget shows the screen without the blocks.
 *
 * Never throws for the store's sake — only for the caller's: a session that is
 * not the order's owner still gets the same 404 as `GET /orders/:id`.
 */
@Injectable()
export class OrderAddressService {
  private readonly logger = new Logger(OrderAddressService.name);
  private readonly deniedLoggedAt = new Map<number, number>();

  constructor(
    @InjectRepository(OrderCache) private readonly orderRepo: Repository<OrderCache>,
    private readonly sessionService: SessionService,
    private readonly tenantService: TenantService,
    private readonly client: ShopifyAdminClient,
  ) {}

  async addressesForSession(token: string, orderId: number): Promise<OrderAddressesResponse> {
    const customerId = await this.sessionService.requireCustomerId(token);
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || order.customerId !== customerId) {
      throw new BusinessException(ERROR_CODE.ORDER_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    // Cafe24 and the other channels have no address read here.
    if (order.provider !== 'shopify' || order.tenantId == null) return UNAVAILABLE;

    try {
      const conn = await this.tenantService.getShopifyConnection(order.tenantId);
      if (!conn) return UNAVAILABLE;
      const read = await this.withTimeout(
        this.client.fetchOrderAddresses(conn.shopDomain, conn.token, order.shopifyOrderId),
      );
      if (read === 'denied') {
        this.logDenied(order.tenantId);
        return UNAVAILABLE;
      }
      if (!read) return UNAVAILABLE;
      return {
        available: true,
        billing: OrderMapper.toAddress(read.billing),
        shipping: OrderMapper.toAddress(read.shipping),
      };
    } catch (e) {
      // Order id and reason only. The message is the store's error text, which
      // names fields, never their values.
      this.logger.warn(`order ${order.id}: addresses unavailable (${(e as Error)?.message ?? String(e)})`);
      return UNAVAILABLE;
    }
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ADDRESS_TIMEOUT_MS} ms`)), ADDRESS_TIMEOUT_MS);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }

  /** Missing access is a setting, not an incident: say so once an hour per tenant. */
  private logDenied(tenantId: number): void {
    const last = this.deniedLoggedAt.get(tenantId) ?? 0;
    if (Date.now() - last < DENIAL_LOG_EVERY_MS) return;
    this.deniedLoggedAt.set(tenantId, Date.now());
    this.logger.warn(
      `tenant ${tenantId}: Shopify refused order addresses — grant the app Protected Customer Data ` +
        'Address + Phone access to show them in Order Detail (ivy-docs T04)',
    );
  }
}
