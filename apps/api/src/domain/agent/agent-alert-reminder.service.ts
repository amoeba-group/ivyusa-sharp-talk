import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import {
  CALLBACK_CHIP_ID,
  CHAT_CLOSE_DEFAULT_COPY,
  CONVERSATION_STATUS,
  chatCopy,
} from '@sharptalk/types';
import { AgentAlert } from './entity/agent-alert.entity';
import { ALERT_STATUS_EXPIRED, AgentAlertService } from './agent-alert.service';
import { HandoffConfig, TenantAiConfig } from '../ai-engine/entity/tenant-ai-config.entity';
import { Conversation } from '../chat/entity/conversation.entity';
import { Message } from '../chat/entity/message.entity';
import { Session } from '../session/entity/session.entity';
import { ModerationService } from '../moderation/moderation.service';
import { AuditService } from '../audit/audit.service';
import { sayLine } from '../chat/chat-close.util';
import { isCliContext } from '../../global/util/cli-context.util';

/**
 * Sweep cadence. A minute is the finest delay the console offers; 15 s keeps
 * "after 1 minute" within 1:00–1:15 instead of the 1–2 minutes a 60 s tick gave.
 */
const SWEEP_MS = 15_000;
/** Upper bound on one pass, so a backlog after downtime cannot stall the loop. */
const BATCH = 200;

/**
 * "Nobody has picked this up" reminder (PLN-261015 D4).
 *
 * A paged agent can be away from the console. After the tenant's
 * `handoff_config.reAlert.afterMinutes`, an alarm that is still unacknowledged
 * on a conversation that is still waiting is mailed again to the same agents,
 * and the escalation lead (`escalateToUserIds`) is paged as well. Each
 * conversation is reminded once: `reminded_at` is stamped on all its rows.
 *
 * Tenants without `reAlert` are never touched, so this is inert until a tenant
 * turns it on.
 */
@Injectable()
export class AgentAlertReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentAlertReminderService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(AgentAlert) private readonly alertRepo: Repository<AgentAlert>,
    @InjectRepository(TenantAiConfig) private readonly configRepo: Repository<TenantAiConfig>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    private readonly alerts: AgentAlertService,
    // Queue timeout (PLN-261026 B2/B3). Appended and optional so the existing
    // positional doubles keep building; without them the timeout is skipped.
    @InjectRepository(Message) private readonly msgRepo?: Repository<Message>,
    @InjectRepository(Session) private readonly sessionRepo?: Repository<Session>,
    private readonly moderation?: ModerationService,
    private readonly audit?: AuditService,
  ) {}

  onModuleInit(): void {
    // A one-off CLI must not run a second copy of this scheduler (PLN-261008 D2).
    if (isCliContext()) return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass. Returns how many conversations were reminded (for tests/logs). */
  async sweep(now: Date = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const configs = await this.configRepo.find({
        where: { handoffConfig: Not(IsNull()) },
        select: { id: true, tenantId: true, handoffConfig: true },
      });
      let reminded = 0;
      let timedOut = 0;
      for (const cfg of configs) {
        if (cfg.tenantId == null) continue;
        const re = cfg.handoffConfig?.reAlert;
        const minutes = Number(re?.afterMinutes);
        if (Number.isFinite(minutes) && minutes > 0) {
          reminded += await this.sweepTenant(Number(cfg.tenantId), minutes, re?.escalateToUserIds ?? [], now);
        }
        // After the reminder, so a reminder due on the same tick still goes out.
        timedOut += await this.sweepQueueTimeout(Number(cfg.tenantId), cfg.handoffConfig!, now);
      }
      if (reminded) this.logger.log(`alarm reminders sent for ${reminded} conversation(s)`);
      if (timedOut) this.logger.log(`queue timeout: ${timedOut} conversation(s) handed back to the AI`);
      return reminded;
    } catch (e) {
      this.logger.warn(`alarm reminder sweep failed: ${(e as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async sweepTenant(tenantId: number, minutes: number, leads: number[], now: Date): Promise<number> {
    const due = await this.alertRepo.find({
      where: {
        tenantId,
        status: 'new',
        remindedAt: IsNull(),
        createdAt: LessThanOrEqual(new Date(now.getTime() - minutes * 60_000)),
      },
      order: { id: 'ASC' },
      take: BATCH,
    });
    if (!due.length) return 0;

    const byConversation = new Map<number, AgentAlert[]>();
    for (const row of due) {
      const key = Number(row.conversationId);
      byConversation.set(key, [...(byConversation.get(key) ?? []), row]);
    }
    const waiting = new Set(
      (
        await this.convRepo.find({
          where: { tenantId, id: In([...byConversation.keys()]), status: CONVERSATION_STATUS.WAITING },
          select: { id: true },
        })
      ).map((c) => Number(c.id)),
    );

    let reminded = 0;
    for (const [conversationId, rows] of byConversation) {
      // Stamp first: a mail failure must not turn into a mail every minute.
      await this.alertRepo.update(
        { tenantId, conversationId, status: 'new', remindedAt: IsNull() },
        { remindedAt: now },
      );
      // Accepted or ended meanwhile (the alarm was simply never clicked) —
      // nothing to remind anyone about.
      if (!waiting.has(conversationId)) continue;

      await this.alerts.notifyRows(rows, { reminder: true });
      const paged = new Set(rows.map((r) => (r.targetUserId != null ? Number(r.targetUserId) : null)));
      const leadIds = [...new Set(leads.map(Number).filter((id) => Number.isFinite(id) && !paged.has(id)))];
      if (leadIds.length) {
        const first = rows[0];
        const leadRows = await this.alertRepo.save(
          leadIds.map((targetUserId) =>
            this.alertRepo.create({
              tenantId,
              conversationId,
              sessionId: first.sessionId,
              reason: first.reason,
              preview: first.preview,
              targetUserId,
              status: 'new',
              // Already a reminder — the lead must not be reminded again.
              remindedAt: now,
            }),
          ),
        );
        await this.alerts.notifyRows(leadRows, { reminder: true });
      }
      reminded += 1;
    }
    return reminded;
  }

  /**
   * Nobody accepted in time (PLN-261026 B2/B3, D3). An unassigned waiting
   * thread whose oldest open alarm is older than `queueTimeout.afterMinutes`:
   * the shopper is told (tenant line, moderated; built-in otherwise), with the
   * callback chip when callbacks are on; the thread goes back to the AI and
   * its open alarms expire. Off-hours email threads are left alone — they were
   * promised a mailed reply, not a live agent.
   */
  async sweepQueueTimeout(tenantId: number, config: HandoffConfig, now: Date = new Date()): Promise<number> {
    const minutes = Number(config.queueTimeout?.afterMinutes);
    if (!this.msgRepo || !Number.isFinite(minutes) || minutes <= 0) return 0;
    const due = await this.alertRepo.find({
      where: { tenantId, status: 'new', createdAt: LessThanOrEqual(new Date(now.getTime() - minutes * 60_000)) },
      select: { id: true, conversationId: true },
      order: { id: 'ASC' },
      take: BATCH,
    });
    if (!due.length) return 0;
    const ids = [...new Set(due.map((r) => Number(r.conversationId)))];
    const conversations = await this.convRepo.find({
      where: { tenantId, id: In(ids), status: CONVERSATION_STATUS.WAITING, agentId: IsNull(), replyChannel: IsNull() },
    });
    const callback = !!config.callback?.enabled;
    let count = 0;
    for (const conversation of conversations) {
      // Claim first: the status flip is the latch, so a second tick (or a
      // second instance) finds nothing to do.
      const claimed = await this.convRepo.update(
        { id: conversation.id, status: CONVERSATION_STATUS.WAITING, agentId: IsNull() },
        { status: CONVERSATION_STATUS.AI_ACTIVE },
      );
      if (claimed.affected === 0) continue;
      await this.alertRepo.update(
        { tenantId, conversationId: conversation.id, status: 'new' },
        { status: ALERT_STATUS_EXPIRED },
      );
      const session = await this.sessionRepo?.findOne({ where: { id: conversation.sessionId }, select: { id: true, language: true } });
      const language = session?.language ?? 'EN';
      await sayLine(
        { msgRepo: this.msgRepo, moderation: this.moderation },
        conversation,
        config.queueTimeout?.notice,
        CHAT_CLOSE_DEFAULT_COPY.queueDelay,
        language,
        {
          reason: 'queue_timeout',
          ...(callback
            ? { followUps: [{ id: CALLBACK_CHIP_ID, label: chatCopy(null, CHAT_CLOSE_DEFAULT_COPY.callbackChip, language) }] }
            : {}),
        },
      );
      await this.audit
        ?.write({
          tenantId,
          actorType: 'system',
          actorId: 0,
          action: 'chat.queue_timeout',
          target: `conversation:${conversation.id}`,
          metadata: { afterMinutes: minutes, callbackOffered: callback },
        })
        .catch((e: Error) => this.logger.warn(`queue timeout audit failed: ${e.message}`));
      count += 1;
    }
    return count;
  }
}
