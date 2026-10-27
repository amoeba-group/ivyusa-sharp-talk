import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';
import { CHAT_CLOSE_DEFAULT_COPY, CONVERSATION_STATUS, SENDER_TYPE, localized, readChatClosePolicy } from '@sharptalk/types';
import type { ChatClosePolicy, LocalizedText } from '@sharptalk/types';
import { Conversation } from './entity/conversation.entity';
import { Message } from './entity/message.entity';
import { Session } from '../session/entity/session.entity';
import { Assignment } from '../agent/entity/assignment.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { AuditService } from '../audit/audit.service';
import { ModerationService } from '../moderation/moderation.service';
import { endConversation, sayLine } from './chat-close.util';
import { envNumber } from '../../global/util/env-number.util';
import { isCliContext } from '../../global/util/cli-context.util';

/** How often the sweep runs. 0 disables it. */
const SWEEP_INTERVAL_SEC = envNumber('IDLE_SWEEP_INTERVAL_SEC', '30');
/** Silence from both sides before the customer is asked whether anything is left. */
const PROMPT_AFTER_MIN = envNumber('IDLE_PROMPT_AFTER_MIN', '30');
/** Grace period after that question before the thread closes. */
const CLOSE_AFTER_SEC = envNumber('IDLE_CLOSE_AFTER_SEC', '60');
/** The only channel this sweeper owns; everything else belongs to an agent. */
const CONVERSATION_CHANNEL_WIDGET = 'widget';
/**
 * Past this, a thread is closed without asking anything. Reopening a
 * conversation that went quiet six weeks ago to say "anything else?" reads as a
 * system glitch, not service — the oldest abandoned thread on staging last
 * spoke on 2026-06-30.
 */
const STALE_AFTER_DAYS = envNumber('IDLE_STALE_AFTER_DAYS', '7');
/** Rows handled per sweep, so a backlog cannot stall the tick. */
const BATCH = 50;

const PROMPT_COPY: LocalizedText = {
  EN: 'Is there anything else I can help you with? If not, I’ll close this chat shortly.',
  ES: '¿Hay algo más en lo que pueda ayudarte? Si no, cerraré este chat en breve.',
  KO: '혹시 더 도와드릴 일이 있으실까요? 없으시면 잠시 후 상담을 마칠게요.',
  VI: 'Bạn còn cần tôi hỗ trợ gì nữa không? Nếu không, tôi sẽ kết thúc cuộc trò chuyện này sau ít phút.',
  JA: 'ほかにお手伝いできることはございますか。ないようでしたら、まもなくこのチャットを終了いたします。',
  ZH: '还有什么可以帮您的吗？如果没有，我稍后会结束这次对话。',
};

const CLOSING_COPY: LocalizedText = {
  EN: 'Thanks for chatting with us. How satisfied were you with this conversation?',
  ES: 'Gracias por escribirnos. ¿Qué tan satisfecho quedaste con esta conversación?',
  KO: '이용해 주셔서 감사합니다. 상담에 만족하셨나요?',
  VI: 'Cảm ơn bạn đã trò chuyện với chúng tôi. Bạn hài lòng với cuộc trò chuyện này ở mức nào?',
  JA: 'ご利用いただきありがとうございました。今回のご対応にどの程度ご満足いただけましたか。',
  ZH: '感谢您与我们联系。您对本次对话的满意度如何？',
};

/**
 * Closes conversations nobody is tending (PLN-260810 P1).
 *
 * Handback (S1) gave an agent a way to step out deliberately. This covers the
 * case where nobody does anything at all: measured on staging, seven threads
 * sat in `agent` with ten customer messages that neither a person nor the bot
 * ever answered, the oldest for over forty days.
 *
 * State lives in `conversations.idle_prompt_at`, not in a timer. Two timers —
 * one for the 30 minutes, one for the 60 seconds — would die with the process
 * and leave threads half-closed; a column survives a restart and doubles as the
 * ask-once latch.
 */
@Injectable()
export class IdleConversationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdleConversationService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    private readonly audit: AuditService,
    // Tenant close policies (PLN-261026). Appended and optional so the
    // positional doubles in the existing specs keep building — without them
    // every tenant follows the platform rule, exactly as before.
    @InjectRepository(Tenant) private readonly tenantRepo?: Repository<Tenant>,
    private readonly moderation?: ModerationService,
  ) {}

  onModuleInit(): void {
    // A one-off CLI must not run a second copy of this scheduler (PLN-261008 D2).
    if (isCliContext()) return;
    if (!Number.isFinite(SWEEP_INTERVAL_SEC) || SWEEP_INTERVAL_SEC <= 0) {
      this.logger.warn('Idle conversation sweep DISABLED (IDLE_SWEEP_INTERVAL_SEC=0)');
      return;
    }
    this.logger.log(
      `Idle sweep every ${SWEEP_INTERVAL_SEC}s — ask after ${PROMPT_AFTER_MIN}min, ` +
        `close after ${CLOSE_AFTER_SEC}s, silent close past ${STALE_AFTER_DAYS}d`,
    );
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_SEC * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * One pass: close what is due, then ask what has gone quiet.
   *
   * Silent closes are counted separately. Folding them into `closed` would hide
   * how many customers were spoken to, and leaving them out of the log entirely
   * — as the first version did — reported "asked 20, closed 0" on a sweep that
   * had just ended thirteen conversations (observed on the staging backfill).
   */
  async sweep(): Promise<{ prompted: number; closed: number; silentlyClosed: number }> {
    const idle = { prompted: 0, closed: 0, silentlyClosed: 0 };
    if (this.running) return idle;
    this.running = true;
    try {
      const policies = await this.policies();
      const policyTenants = [...policies.keys()];
      idle.closed = await this.closeDue(policyTenants);
      const asked = await this.promptIdle(policyTenants);
      idle.prompted = asked.prompted;
      idle.silentlyClosed = asked.silentlyClosed;
      for (const [tenantId, policy] of policies) {
        const r = await this.sweepPolicy(tenantId, policy);
        idle.prompted += r.prompted;
        idle.closed += r.closed;
        idle.silentlyClosed += r.silentlyClosed;
      }
      if (idle.prompted || idle.closed || idle.silentlyClosed) {
        this.logger.log(
          `idle sweep: asked ${idle.prompted}, closed ${idle.closed}, ` +
            `closed without asking ${idle.silentlyClosed}`,
        );
      }
      return idle;
    } catch (e) {
      this.logger.warn(`idle sweep failed: ${(e as Error).message}`);
      return idle;
    } finally {
      this.running = false;
    }
  }

  /** Threads that were asked and did not answer inside the grace period. */
  private async closeDue(policyTenants: number[] = []): Promise<number> {
    const due = await this.convRepo.find({
      where: this.legacyScope(policyTenants, {
        idlePromptAt: LessThan(new Date(Date.now() - CLOSE_AFTER_SEC * 1000)),
        // Also excluded here, not just in the ask pass: a thread can be asked
        // and only then slip off hours, and closing it would cancel the email
        // reply the customer was promised in between.
        replyChannel: IsNull(),
      }),
      take: BATCH,
    });

    let closed = 0;
    for (const conversation of due) {
      // The customer may have replied between the question and this tick; the
      // reply clears the latch, but a race is still possible, so re-check.
      const answered = await this.msgRepo.count({
        where: {
          conversationId: conversation.id,
          senderType: SENDER_TYPE.USER,
          createdAt: this.after(conversation.idlePromptAt!),
        },
      });
      if (answered > 0) {
        await this.convRepo.update({ id: conversation.id }, { idlePromptAt: null });
        continue;
      }
      await this.close(conversation, true);
      closed += 1;
    }
    return closed;
  }

  /** Threads nobody has touched for long enough to ask about. */
  private async promptIdle(policyTenants: number[] = []): Promise<{ prompted: number; silentlyClosed: number }> {
    const quietSince = new Date(Date.now() - PROMPT_AFTER_MIN * 60_000);
    const candidates = await this.convRepo.find({
      where: this.legacyScope(policyTenants, {
        idlePromptAt: IsNull(),
        // An off-hours thread is waiting on a promised email reply; closing it
        // would cancel an answer the customer was told to expect.
        replyChannel: IsNull(),
      }),
      take: BATCH * 4,
    });

    let prompted = 0;
    let silentlyClosed = 0;
    for (const conversation of candidates) {
      const last = await this.msgRepo.findOne({
        where: { conversationId: conversation.id },
        order: { id: 'DESC' },
      });
      const lastAt = last?.createdAt ?? conversation.createdAt;
      if (lastAt > quietSince) continue;

      const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 86_400_000);
      if (lastAt < staleBefore) {
        // Reported on its own line: nothing was said to anyone, and an operator
        // reading the log needs to see that these ended too.
        await this.close(conversation, false);
        silentlyClosed += 1;
        continue;
      }

      const language = await this.languageOf(conversation);
      await this.say(conversation, PROMPT_COPY, language);
      await this.convRepo.update({ id: conversation.id }, { idlePromptAt: new Date() });
      await this.record(conversation, 'chat.idle_prompted');
      prompted += 1;
      if (prompted >= BATCH) break;
    }
    return { prompted, silentlyClosed };
  }

  /**
   * End the thread. `withClosing` is false for threads too old to talk to —
   * they are closed silently, since a satisfaction question about a
   * conversation from six weeks ago is noise.
   */
  private async close(
    conversation: Conversation,
    withClosing: boolean,
    policy?: ChatClosePolicy,
    reason = 'idle',
  ): Promise<void> {
    if (withClosing) {
      const language = await this.languageOf(conversation);
      if (policy) {
        await sayLine(
          { msgRepo: this.msgRepo, moderation: this.moderation },
          conversation,
          policy.closingNotice,
          CHAT_CLOSE_DEFAULT_COPY.closingNotice,
          language,
        );
      } else {
        await this.say(conversation, CLOSING_COPY, language);
      }
    }
    await endConversation({ convRepo: this.convRepo, assignmentRepo: this.assignmentRepo }, Number(conversation.id));
    await this.record(conversation, 'chat.idle_closed', { reason });
  }

  private async say(
    conversation: Conversation,
    copy: LocalizedText,
    language: string,
  ): Promise<void> {
    await this.msgRepo.save(
      this.msgRepo.create({
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        senderType: SENDER_TYPE.SYSTEM,
        body: localized(copy, language),
        lang: language,
        retrievalTrace: null,
      }),
    );
  }

  private async languageOf(conversation: Conversation): Promise<string> {
    const session = await this.sessionRepo.findOne({ where: { id: conversation.sessionId } });
    return session?.language ?? 'EN';
  }

  private async record(conversation: Conversation, action: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.audit
      .write({
        ...(metadata ? { metadata } : {}),
        tenantId: conversation.tenantId,
        // Nobody clicked anything — attributing this to a person would put a
        // machine's decision under someone's name in the audit trail.
        actorType: 'system',
        actorId: 0,
        action,
        target: `conversation:${conversation.id}`,
      })
      .catch((e: Error) => this.logger.warn(`${action} audit failed: ${e.message}`));
  }

  private openStatuses() {
    return In([CONVERSATION_STATUS.AGENT, CONVERSATION_STATUS.WAITING]);
  }

  /**
   * The platform rule's reach. A tenant with its own policy keeps only its
   * WAITING threads here (a shopper queued for a person is not asked to rate
   * anything); its AI and agent threads belong to `sweepPolicy`.
   */
  private legacyScope<T extends Record<string, unknown>>(policyTenants: number[], where: T) {
    if (!policyTenants.length) return this.sweepable({ ...where, status: this.openStatuses() });
    return [
      ...this.sweepable({ ...where, status: this.openStatuses(), tenantId: IsNull() }),
      ...this.sweepable({ ...where, status: this.openStatuses(), tenantId: Not(In(policyTenants)) }),
      ...this.sweepable({ ...where, status: CONVERSATION_STATUS.WAITING, tenantId: In(policyTenants) }),
    ];
  }

  /** Tenants with a close policy (PLN-261026). A read failure means "none" — the platform rule. */
  private async policies(): Promise<Map<number, ChatClosePolicy>> {
    const map = new Map<number, ChatClosePolicy>();
    if (!this.tenantRepo) return map;
    try {
      const rows = await this.tenantRepo.find({
        where: { chatClosePolicy: Not(IsNull()) },
        select: { id: true, chatClosePolicy: true },
      });
      for (const row of rows) {
        const policy = readChatClosePolicy(row.chatClosePolicy);
        if (policy) map.set(Number(row.id), policy);
      }
    } catch (e) {
      this.logger.warn(`close policies unreadable: ${(e as Error).message}`);
    }
    return map;
  }

  /**
   * One tenant's policy pass (PLN-261026 A1/A2): AI or agent answered and the
   * shopper went quiet → rating request; still quiet → closing line, end.
   * Threads that went quiet before the policy was switched on are closed
   * silently — switching it on must not message every abandoned thread.
   */
  async sweepPolicy(
    tenantId: number,
    policy: ChatClosePolicy,
    now = new Date(),
  ): Promise<{ prompted: number; closed: number; silentlyClosed: number }> {
    const out = { prompted: 0, closed: 0, silentlyClosed: 0 };
    const policyStatuses = In([CONVERSATION_STATUS.AI_ACTIVE, CONVERSATION_STATUS.AGENT]);

    // 1. Rated nothing within the wait → closing line, end.
    const due = await this.convRepo.find({
      where: this.sweepable({
        tenantId,
        status: policyStatuses,
        idlePromptAt: LessThan(new Date(now.getTime() - policy.closeAfterMin * 60_000)),
        replyChannel: IsNull(),
      }),
      take: BATCH,
    });
    for (const conversation of due) {
      const answered = await this.msgRepo.count({
        where: { conversationId: conversation.id, senderType: SENDER_TYPE.USER, createdAt: this.after(conversation.idlePromptAt!) },
      });
      if (answered > 0) {
        await this.convRepo.update({ id: conversation.id }, { idlePromptAt: null });
        continue;
      }
      await this.close(conversation, true, policy, 'csat_timeout');
      out.closed += 1;
    }

    // 2. Answered, then silence → rating request.
    const quietBefore = new Date(now.getTime() - policy.csatAfterMin * 60_000);
    // Abandoned before the switch-on = would already have been closed by the
    // policy's own clock at that moment. A thread that went quiet a minute
    // before is still live and gets the normal request (staging go2joy, 10/27:
    // a partner's chat answered 71 s before switch-on was ended without a word).
    const abandonedBefore = policy.since
      ? new Date(Date.parse(policy.since) - (policy.csatAfterMin + policy.closeAfterMin) * 60_000)
      : null;
    const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000);
    for (const q of await this.quietCandidates(tenantId, quietBefore)) {
      const conversation = q.conversation;
      const beforePolicy = !!abandonedBefore && q.lastAt < abandonedBefore;
      if (q.lastAt < staleBefore || beforePolicy) {
        await this.close(conversation, false, policy, beforePolicy ? 'before_policy' : 'stale');
        out.silentlyClosed += 1;
        continue;
      }
      // The shopper spoke last: they are owed an answer, not a rating request.
      if (q.lastSender === SENDER_TYPE.USER) continue;
      const language = await this.languageOf(conversation);
      await sayLine(
        { msgRepo: this.msgRepo, moderation: this.moderation },
        conversation,
        policy.csatPrompt,
        CHAT_CLOSE_DEFAULT_COPY.csatPrompt,
        language,
        { csatPrompt: true },
      );
      await this.convRepo.update({ id: conversation.id }, { idlePromptAt: new Date() });
      await this.record(conversation, 'chat.csat_prompted');
      out.prompted += 1;
      if (out.prompted >= BATCH) break;
    }
    return out;
  }

  /**
   * Open AI/agent widget threads of a tenant whose newest message is older than
   * `before`, with that message's sender — one query, so a tenant with hundreds
   * of open threads costs one round trip per sweep, not one per thread.
   */
  async quietCandidates(
    tenantId: number,
    before: Date,
  ): Promise<Array<{ conversation: Conversation; lastAt: Date; lastSender: string }>> {
    const rows = await this.convRepo
      .createQueryBuilder('c')
      .innerJoin(Message, 'm', 'm.id = (SELECT MAX(m2.id) FROM messages m2 WHERE m2.conversation_id = c.id)')
      .select(['c.id AS id', 'c.tenant_id AS tenantId', 'c.session_id AS sessionId', 'c.status AS status'])
      .addSelect('m.created_at', 'lastAt')
      .addSelect('m.sender_type', 'lastSender')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.status IN (:...statuses)', { statuses: [CONVERSATION_STATUS.AI_ACTIVE, CONVERSATION_STATUS.AGENT] })
      .andWhere('c.idle_prompt_at IS NULL')
      .andWhere('c.reply_channel IS NULL')
      .andWhere("(c.channel IS NULL OR c.channel = :widget)", { widget: CONVERSATION_CHANNEL_WIDGET })
      .andWhere('m.created_at < :before', { before })
      .orderBy('c.id', 'ASC')
      .limit(BATCH * 4)
      .getRawMany<{ id: string; tenantId: string; sessionId: string; status: string; lastAt: Date | string; lastSender: string }>();
    return rows.map((r) => ({
      conversation: {
        id: Number(r.id),
        tenantId: Number(r.tenantId),
        sessionId: Number(r.sessionId),
        status: r.status,
      } as Conversation,
      lastAt: new Date(r.lastAt),
      lastSender: r.lastSender,
    }));
  }

  /**
   * Only widget threads are swept (PLN-260812 S5).
   *
   * "Idle" is a widget idea: the visitor closed the tab. A KakaoTalk room or a
   * mail thread does not go idle — the person is simply not typing — and
   * closing it sent "Anything else? / Rate this chat" into someone's personal
   * chat room 52 times on staging. Messenger threads are ended by an agent.
   *
   * Expressed as two alternatives so legacy NULL rows keep being swept.
   */
  private sweepable<T extends Record<string, unknown>>(where: T): T[] {
    return [
      { ...where, channel: IsNull() },
      { ...where, channel: CONVERSATION_CHANNEL_WIDGET },
    ];
  }

  private after(date: Date) {
    return MoreThan(date);
  }
}
