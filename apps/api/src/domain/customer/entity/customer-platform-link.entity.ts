import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';
import { decryptPii, encryptPii } from '../../../global/util/crypto.util';

/** Same PII-at-rest rule as customers.name (PRV-M6). */
const piiTransformer = {
  to: (value: string | null): Buffer | null => encryptPii(value),
  from: (value: Buffer | null): string | null => decryptPii(value),
};

/**
 * Which platform accounts a person is known by (PLN-261027 D12): one row per
 * (tenant, platform, platform customer id) — Shopify, Cafe24, WooCommerce,
 * Haravan, Odoo, or a host's signed identify. Minimal on purpose: the id, the
 * name the platform calls them, and when we first/last saw it. Contact
 * details stay on the customer row only.
 */
@Entity('customer_platform_links')
@Index('uq_cpl_tenant_provider_external', ['tenantId', 'provider', 'externalId'], { unique: true })
@Index('idx_cpl_tenant_customer', ['tenantId', 'customerId'])
export class CustomerPlatformLink {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: bigintTransformer })
  tenantId: number;

  @Column({ name: 'customer_id', type: 'bigint', transformer: bigintTransformer })
  customerId: number;

  /** shopify | cafe24 | woocommerce | haravan | odoo | identify */
  @Column({ type: 'varchar', length: 24 })
  provider: string;

  @Column({ name: 'external_id', type: 'varchar', length: 120 })
  externalId: string;

  @Column({ name: 'display_name', type: 'varbinary', length: 512, nullable: true, transformer: piiTransformer })
  displayName: string | null;

  @Column({ name: 'first_seen_at', type: 'datetime' })
  firstSeenAt: Date;

  @Column({ name: 'last_seen_at', type: 'datetime' })
  lastSeenAt: Date;
}
