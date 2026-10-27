import type { Repository } from 'typeorm';
import { CONVERSATION_STATUS, MODERATION_DECISION, SENDER_TYPE, chatCopy } from '@sharptalk/types';
import type { LocalizedText } from '@sharptalk/types';
import type { Conversation } from './entity/conversation.entity';
import type { Message } from './entity/message.entity';
import type { Assignment } from '../agent/entity/assignment.entity';
import type { ModerationService } from '../moderation/moderation.service';

/**
 * Shared by the idle sweep, the queue-timeout sweep and the rating path
 * (PLN-261026). Plain functions over repositories rather than a provider, so the
 * chat and agent modules can both use them without importing each other.
 */

/**
 * Persist a system line in the shopper's language.
 *
 * Built-in copy is fixed platform text and goes out as written, like every
 * other system line. A tenant-written line is operator free text, so it passes
 * the moderation gate first (FR-069); blocked, or the gate unavailable, the
 * built-in line is sent instead — the shopper still learns what happened.
 */
export async function sayLine(
  deps: { msgRepo: Repository<Message>; moderation?: ModerationService | null },
  conversation: Pick<Conversation, 'id' | 'tenantId'>,
  custom: LocalizedText | undefined | null,
  fallback: LocalizedText,
  language: string,
  trace: Record<string, unknown> | null = null,
): Promise<Message> {
  const builtIn = chatCopy(null, fallback, language);
  let body = chatCopy(custom, fallback, language);
  if (body !== builtIn) {
    if (!deps.moderation) {
      body = builtIn;
    } else {
      try {
        const checked = await deps.moderation.moderate({
          tenantId: conversation.tenantId ?? 0,
          scope: 'ai',
          authorType: 'ai',
          conversationId: conversation.id,
          text: body,
        });
        body = checked.decision === MODERATION_DECISION.BLOCKED ? builtIn : checked.text;
      } catch {
        body = builtIn;
      }
    }
  }
  return deps.msgRepo.save(
    deps.msgRepo.create({
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      senderType: SENDER_TYPE.SYSTEM,
      body,
      lang: language,
      retrievalTrace: trace,
    }),
  );
}

/** ENDED + the active assignment released — the same transition every end path makes. */
export async function endConversation(
  deps: { convRepo: Repository<Conversation>; assignmentRepo: Repository<Assignment> },
  conversationId: number,
): Promise<void> {
  await deps.convRepo.update(
    { id: conversationId },
    { status: CONVERSATION_STATUS.ENDED, endedAt: new Date(), idlePromptAt: null },
  );
  await deps.assignmentRepo.update(
    { conversationId, status: 'active' },
    { status: 'released', releasedAt: new Date() },
  );
}
