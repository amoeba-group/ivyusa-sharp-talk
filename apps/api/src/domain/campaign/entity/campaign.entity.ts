import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';

/** campaigns — marketing campaigns (FR-045). */
@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  @Index('idx_cmp_tenant')
  tenantId: number | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'segment_ref', type: 'varchar', length: 128, nullable: true })
  segmentRef: string | null;

  /**
   * Who the campaign goes to: this tenant's customer ids, or NULL for all of
   * them (IVY PRD v1 N-04 — specific-customer targeting used to be ignored).
   */
  @Column({ name: 'target_customer_ids', type: 'json', nullable: true })
  targetCustomerIds: number[] | null;

  @Column({ type: 'json', nullable: true })
  content: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  @Index('idx_campaign_status')
  status: string; // draft/scheduled/sent

  @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;
}
