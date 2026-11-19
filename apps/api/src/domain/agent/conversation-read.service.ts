import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConversationRead } from './entity/conversation-read.entity';

/** The sender type of a shopper's message — the only kind that counts as unread. */
const CUSTOMER_SENDER = 'user';

/**
 * SQL condition: conversation `alias` holds a customer message this reader has
 * not seen. `:readerId` must be bound by the caller. Used by the session list's
 * Unread filter; `unreadCounts` applies the same rule.
 *
 * Without a marker row, only messages sent after the reader's account was
 * created count: a staff member added next year should not open Live Chat to
 * every conversation the shop ever had marked unread. A marker row — from
 * opening the conversation or from "mark as unread" — always wins.
 */
export function unreadExistsSql(alias: string): string {
  return `EXISTS (SELECT 1 FROM messages mu
     LEFT JOIN conversation_reads cr ON cr.conversation_id = mu.conversation_id AND cr.user_id = :readerId
     WHERE mu.conversation_id = ${alias}.id AND mu.sender_type = '${CUSTOMER_SENDER}'
       AND mu.id > COALESCE(cr.last_read_message_id, 0)
       AND (cr.id IS NOT NULL OR mu.created_at > (SELECT u.created_at FROM users u WHERE u.id = :readerId)))`;
}

/**
 * Read / unread per staff member (PLN-261119 Live Chat unread).
 *
 * Unread = customer messages after the reader's marker. AI and staff messages
 * never count: the question the list answers is "which customer is waiting for
 * me to look", and a bot answer is not that.
 *
 * Every write goes through `conversations` filtered by tenant, so a
 * conversation id from another tenant matches nothing.
 */
@Injectable()
export class ConversationReadService {
  constructor(@InjectRepository(ConversationRead) private readonly repo: Repository<ConversationRead>) {}

  /** Unread customer messages per conversation, for one page of the list. Missing key = 0. */
  async unreadCounts(userId: number, conversationIds: number[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const ids = [...new Set(conversationIds.map(Number).filter((n) => Number.isFinite(n)))];
    if (!ids.length) return out;
    const rows: Array<{ cid: string; n: string }> = await this.repo.query(
      `SELECT m.conversation_id AS cid, COUNT(*) AS n
         FROM messages m
         LEFT JOIN conversation_reads r ON r.conversation_id = m.conversation_id AND r.user_id = ?
        WHERE m.conversation_id IN (${ids.map(() => '?').join(',')})
          AND m.sender_type = '${CUSTOMER_SENDER}'
          AND m.id > COALESCE(r.last_read_message_id, 0)
          AND (r.id IS NOT NULL OR m.created_at > (SELECT u.created_at FROM users u WHERE u.id = ?))
        GROUP BY m.conversation_id`,
      [userId, ...ids, userId],
    );
    for (const r of rows) out.set(String(r.cid), Number(r.n));
    return out;
  }

  /**
   * Move the reader's marker to the newest message of each conversation.
   * `conversationIds` omitted = every conversation of the tenant ("mark all as read").
   */
  async markRead(tenantId: number, userId: number, conversationIds?: number[]): Promise<void> {
    const ids = conversationIds ? [...new Set(conversationIds.map(Number).filter((n) => Number.isFinite(n)))] : null;
    if (ids && !ids.length) return;
    await this.repo.query(
      `INSERT INTO conversation_reads (tenant_id, conversation_id, user_id, last_read_message_id)
       SELECT c.tenant_id, c.id, ?, COALESCE((SELECT MAX(m.id) FROM messages m WHERE m.conversation_id = c.id), 0)
         FROM conversations c
        WHERE c.tenant_id = ?${ids ? ` AND c.id IN (${ids.map(() => '?').join(',')})` : ''}
       ON DUPLICATE KEY UPDATE last_read_message_id = VALUES(last_read_message_id)`,
      [userId, tenantId, ...(ids ?? [])],
    );
  }

  /**
   * Put the marker just before the customer's last message, so the row shows as
   * unread again. Returns false when the customer never wrote — there is
   * nothing to be unread.
   */
  async markUnread(tenantId: number, userId: number, conversationId: number): Promise<boolean> {
    const rows: Array<{ last: string | null }> = await this.repo.query(
      `SELECT MAX(m.id) AS last
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE c.tenant_id = ? AND c.id = ? AND m.sender_type = '${CUSTOMER_SENDER}'`,
      [tenantId, conversationId],
    );
    const last = rows[0]?.last != null ? Number(rows[0].last) : null;
    if (last == null) return false;
    await this.repo.query(
      `INSERT INTO conversation_reads (tenant_id, conversation_id, user_id, last_read_message_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE last_read_message_id = VALUES(last_read_message_id)`,
      [tenantId, conversationId, userId, last - 1],
    );
    return true;
  }
}
