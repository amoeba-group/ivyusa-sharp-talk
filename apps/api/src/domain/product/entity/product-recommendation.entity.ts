import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';

/**
 * product_recommendations — how one Product Help category answers "popular /
 * recommended / new" (IVY PRD v1 A-01…A-04, PLN-261125-IVY-Recommended-Products).
 *
 * `mode` 'admin' = the products the admin picked, in their order, while the
 * display period runs; 'auto' = ranked from sales, reviews and stock. No row
 * means AI Auto, the PRD's default.
 */
@Entity('product_recommendations')
@Unique('uq_prod_rec', ['tenantId', 'categoryHandle', 'recType'])
export class ProductRecommendation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: bigintTransformer })
  tenantId: number;

  /** The collection handle on the tenant's Product Help button. */
  @Column({ name: 'category_handle', type: 'varchar', length: 255 })
  categoryHandle: string;

  /** popular | recommended | new */
  @Column({ name: 'rec_type', type: 'varchar', length: 16 })
  recType: string;

  /** auto | admin */
  @Column({ type: 'varchar', length: 16, default: 'auto' })
  mode: string;

  /** Admin Selected: product handles in display order, at most 10. */
  @Column({ name: 'product_handles', type: 'json', nullable: true })
  productHandles: string[] | null;

  @Column({ name: 'starts_at', type: 'datetime', nullable: true })
  startsAt: Date | null;

  /** After this the category answers in AI Auto again (PRD slide 18). */
  @Column({ name: 'ends_at', type: 'datetime', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'updated_by', type: 'bigint', nullable: true, transformer: bigintTransformer })
  updatedBy: number | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
