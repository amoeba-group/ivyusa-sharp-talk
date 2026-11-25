import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';

/** fulfillments — shipment/fulfillment status per order (FR-021). */
@Entity('fulfillments')
// The review request sweep: one tenant's delivered orders by delivery time (IVY PRD v1 N-05).
@Index('idx_ful_review_due', ['tenantId', 'status', 'deliveredAt'])
export class Fulfillment {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  @Index('idx_ful_tenant')
  tenantId: number | null;

  @Column({ name: 'order_id', type: 'bigint', nullable: false, transformer: bigintTransformer })
  @Index('idx_fulfill_order')
  orderId: number;

  @Column({ type: 'varchar', length: 24 })
  status: string; // preparing/shipped/in_transit/delivered

  @Column({ name: 'tracking_number', type: 'varchar', length: 64, nullable: true })
  trackingNumber: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  carrier: string | null;

  /**
   * The carrier's tracking page as the platform gave it (Shopify `tracking_url`,
   * PLN-260923 P2). Null → the API builds one from carrier + number when it can.
   */
  @Column({ name: 'tracking_url', type: 'varchar', length: 1024, nullable: true })
  trackingUrl: string | null;

  /**
   * When the parcels were delivered (IVY PRD v1 N-05): Shopify's `deliveredAt`
   * of the last parcel, else its update time; the moment a webhook said so when
   * it carries no time. Set once, when the status first reads delivered.
   */
  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date | null;

  /** The review request for this order was handled — sent or skipped (N-05). Once per order. */
  @Column({ name: 'review_requested_at', type: 'datetime', nullable: true })
  reviewRequestedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
