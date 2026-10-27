import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerPlatformLink } from './entity/customer-platform-link.entity';

export const PLATFORM = {
  SHOPIFY: 'shopify',
  CAFE24: 'cafe24',
  WOOCOMMERCE: 'woocommerce',
  HARAVAN: 'haravan',
  ODOO: 'odoo',
  IDENTIFY: 'identify',
} as const;
export type Platform = (typeof PLATFORM)[keyof typeof PLATFORM];

function isDuplicateKey(err: unknown): boolean {
  const e = err as { code?: string; errno?: number };
  return e?.code === 'ER_DUP_ENTRY' || e?.errno === 1062;
}

/**
 * Records which platform account a customer row came from (PLN-261027 D12).
 * Called by every sync / sign-in path after it resolved the customer, and
 * best-effort by design: a failure is logged and swallowed, never allowed to
 * stop an order sync or a widget sign-in.
 */
@Injectable()
export class CustomerPlatformLinkService {
  private readonly logger = new Logger(CustomerPlatformLinkService.name);

  constructor(@InjectRepository(CustomerPlatformLink) private readonly repo: Repository<CustomerPlatformLink>) {}

  async link(
    tenantId: number,
    customerId: number,
    provider: Platform,
    externalId: string | number | null | undefined,
    displayName?: string | null,
  ): Promise<void> {
    if (externalId == null || externalId === '') return;
    const key = String(externalId).slice(0, 120);
    const name = displayName?.trim() || null;
    try {
      const now = new Date();
      const existing = await this.repo.findOne({ where: { tenantId, provider, externalId: key } });
      if (existing) {
        // A merge can move the platform account to another row; follow it.
        existing.customerId = customerId;
        existing.lastSeenAt = now;
        if (name) existing.displayName = name;
        await this.repo.save(existing);
        return;
      }
      try {
        await this.repo.insert(
          this.repo.create({ tenantId, customerId, provider, externalId: key, displayName: name, firstSeenAt: now, lastSeenAt: now }),
        );
      } catch (err) {
        // Two syncs racing on the same account: the other one inserted it.
        if (!isDuplicateKey(err)) throw err;
        await this.repo.update({ tenantId, provider, externalId: key }, { customerId, lastSeenAt: now });
      }
    } catch (err) {
      this.logger.warn(`platform link failed tenant=${tenantId} provider=${provider}: ${(err as Error).message}`);
    }
  }

  list(tenantId: number, customerId: number): Promise<CustomerPlatformLink[]> {
    return this.repo.find({ where: { tenantId, customerId }, order: { firstSeenAt: 'ASC', id: 'ASC' } });
  }

  /** DSAR erasure: the platform names are the person's data. */
  async eraseCustomer(tenantId: number, customerId: number): Promise<void> {
    await this.repo.delete({ tenantId, customerId });
  }
}
