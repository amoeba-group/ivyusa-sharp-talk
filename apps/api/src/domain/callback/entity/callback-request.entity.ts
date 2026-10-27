import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';
import { decryptPii, encryptPii } from '../../../global/util/crypto.util';

/** Contact at rest: AES-256-GCM, the same helper as customers.email/phone. */
const piiTransformer = {
  to: (value: string | null): Buffer | null => encryptPii(value),
  from: (value: Buffer | null): string | null => decryptPii(value),
};

/**
 * callback_requests — a shopper's "contact me" after the queue-timeout or
 * off-hours notice (PLN-261026 B4/D5). Mirrors sql/261026-chat-close-callback.sql.
 *
 * The contact is a copy taken at request time: entered in the widget, or read
 * from the verified member profile. The profile itself is never changed.
 */
@Entity('callback_requests')
@Index('idx_cb_tenant_status', ['tenantId', 'status', 'createdAt'])
@Index('idx_cb_customer', ['tenantId', 'customerId'])
export class CallbackRequest {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: bigintTransformer })
  tenantId: number;

  @Column({ name: 'conversation_id', type: 'bigint', transformer: bigintTransformer })
  @Index('idx_cb_conversation')
  conversationId: number;

  @Column({ name: 'session_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  sessionId: number | null;

  @Column({ name: 'customer_id', type: 'bigint', nullable: true, transformer: bigintTransformer })
  customerId: number | null;

  /** email | phone */
  @Column({ type: 'varchar', length: 8 })
  channel: string;

  /** member | entered */
  @Column({ name: 'contact_source', type: 'varchar', length: 8 })
  contactSource: string;

  @Column({ name: 'contact_enc', type: 'varbinary', length: 512, transformer: piiTransformer })
  contact: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  language: string | null;

  /** requested | done | canceled */
  @Column({ type: 'varchar', length: 16, default: 'requested' })
  status: string;

  @Column({ name: 'handled_by', type: 'bigint', nullable: true, transformer: bigintTransformer })
  handledBy: number | null;

  @Column({ name: 'handled_at', type: 'datetime', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
