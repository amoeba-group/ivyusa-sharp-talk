import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { bigintTransformer } from '../../../global/util/transformers';

/**
 * conversation_reads — how far one staff member has read one conversation
 * (PLN-261119 Live Chat unread). A customer message with an id above
 * `lastReadMessageId` is unread for that user; no row means nothing was read.
 * Per user, not per team: a colleague opening the thread does not clear it for
 * the others.
 */
@Entity('conversation_reads')
@Unique('uq_conv_read', ['conversationId', 'userId'])
@Index('idx_conv_read_user', ['tenantId', 'userId'])
export class ConversationRead {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'tenant_id', type: 'bigint', transformer: bigintTransformer })
  tenantId: number;

  @Column({ name: 'conversation_id', type: 'bigint', transformer: bigintTransformer })
  conversationId: number;

  @Column({ name: 'user_id', type: 'bigint', transformer: bigintTransformer })
  userId: number;

  @Column({ name: 'last_read_message_id', type: 'bigint', default: 0, transformer: bigintTransformer })
  lastReadMessageId: number;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
