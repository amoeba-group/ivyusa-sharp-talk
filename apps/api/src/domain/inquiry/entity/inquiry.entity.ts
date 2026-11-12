import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';
import { decryptPii, encryptPii } from '../../../global/util/crypto.util';

/** Contact at rest: AES-256-GCM, the same helper as customers.email / name / memo. */
const piiTransformer = {
  to: (value: string | null): Buffer | null => encryptPii(value),
  from: (value: Buffer | null): string | null => decryptPii(value),
};

/**
 * inquiries — customer support inquiries (FR-044).
 *
 * The contact form (ivy-docs T11, sql/261112-inquiry-contact-form.sql) adds what
 * the shopper typed: name, the address to answer, the message, the widget
 * language. A copy taken at send time — the customer profile is not changed.
 * All three texts are personal data, encrypted like the customer's memo and
 * cleared on erasure.
 */
@Entity('inquiries')
export class Inquiry {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  @Index('idx_inq_tenant')
  tenantId: number | null;

  @Column({ name: 'conversation_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  conversationId: number | null;

  @Column({ name: 'order_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  @Index('idx_inq_order')
  orderId: number | null;

  @Column({ name: 'customer_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  @Index('idx_inq_customer')
  customerId: number | null;

  @Column({ name: 'contact_name', type: 'varbinary', length: 512, nullable: true, transformer: piiTransformer })
  contactName: string | null;

  @Column({ name: 'contact_email', type: 'varbinary', length: 512, nullable: true, transformer: piiTransformer })
  contactEmail: string | null;

  /** ≤2,000 characters; 8,192 bytes fits them in 4-byte UTF-8 plus the IV and tag. */
  @Column({ type: 'varbinary', length: 8192, nullable: true, transformer: piiTransformer })
  message: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: string; // open/answered

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
