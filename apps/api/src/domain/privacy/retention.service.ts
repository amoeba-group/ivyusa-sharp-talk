import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Conversation } from '../chat/entity/conversation.entity';
import { Message } from '../chat/entity/message.entity';
import { CjmEvent } from '../cjm/entity/cjm-event.entity';
import { Notification } from '../notification/entity/notification.entity';
import { Session } from '../session/entity/session.entity';
import { AuditService } from '../audit/audit.service';
import { AttachmentService } from '../attachment/attachment.service';
import { AiUsageDaily } from '../ai-engine/entity/ai-usage-daily.entity';
import { ModerationLog } from '../moderation/entity/moderation-log.entity';
import { AgentAlert } from '../agent/entity/agent-alert.entity';
import { isCliContext } from '../../global/util/cli-context.util';
import { OrderCache } from '../order/entity/order-cache.entity';

export interface RetentionPurgeResult {
  retentionDays: number;
  cutoff: string;
  messages: number;
  conversations: number;
  cjmEvents: number;
  notifications: number;
  sessions: number;
  /** Attachment rows disposed of, files included (PLN-260814 SI-5). */
  attachments: number;
  /** AI usage roll-ups dropped, on their own longer window (PLN-260824 D9). */
  aiUsage: number;
  aiUsageRetentionDays: number;
  /** Moderation records disposed of — they quote the message (PLN-260920 P4). */
  moderationLogs: number;
  /** Escalation alerts disposed of — they carry a message preview. */
  agentAlerts: number;
  /** Cached orders older than this are disposable (PLN-261117-Order-Cache-Purge). */
  orderCacheRetentionDays: number;
  /** False = report only: `ordersEligible` is counted, nothing is deleted. */
  orderCachePurgeEnabled: boolean;
  /** Cached orders past the window that nothing else points at, before this run. */
  ordersEligible: number;
  /** Cached orders deleted by this run, with their items and fulfillments. */
  orders: number;
}

/** Cached orders deleted per transaction, and the most batches one run takes. */
const ORDER_PURGE_BATCH = 500;
const ORDER_PURGE_MAX_BATCHES = 400;

/**
 * A cached order is disposable when it is old, has not been touched lately, and
 * nothing else points at it. It is a copy: the store still has the order, and
 * a login, a guest lookup or the console's "Look up on Shopify" fetch it again.
 *
 * Kept: an order an inquiry names (a support record), one a notification still
 * opens (the order or one of its items), and one with a review on an item —
 * deleting the item would orphan the review.
 */
const DISPOSABLE_ORDERS_SQL = `
  FROM orders_cache o
  WHERE COALESCE(o.ordered_at, o.created_at) < ?
    AND o.updated_at < ?
    AND NOT EXISTS (SELECT 1 FROM inquiries i WHERE i.order_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.ref_type = 'order' AND n.ref_id = o.id)
    AND NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN notifications n ON n.ref_type = 'order_item' AND n.ref_id = oi.id
      WHERE oi.order_id = o.id)
    AND NOT EXISTS (
      SELECT 1 FROM order_items oi
      JOIN reviews r ON r.order_item_id = oi.id
      WHERE oi.order_id = o.id)`;

/** First scheduled run fires shortly after boot so frequent restarts can't starve disposal. */
const INITIAL_DELAY_MS = 5 * 60_000;

/**
 * Data retention / disposal (POL-003, PRV-H3). Conversation logs, journey events,
 * notifications, and stale sessions are disposed of once older than the configured
 * retention window. Runs on a scheduler (RETENTION_PURGE_INTERVAL_HOURS, default
 * every 24h, first run 5 min after boot; set 0 to disable) and stays manually
 * triggerable via POST /privacy/retention/purge.
 */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @InjectRepository(CjmEvent) private readonly cjmRepo: Repository<CjmEvent>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(AiUsageDaily) private readonly aiUsageRepo: Repository<AiUsageDaily>,
    @InjectRepository(ModerationLog) private readonly moderationRepo: Repository<ModerationLog>,
    @InjectRepository(AgentAlert) private readonly alertRepo: Repository<AgentAlert>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly attachments: AttachmentService,
    // Appended and optional: the specs build this service positionally, and a
    // build without it simply has no order cache to dispose of.
    @Optional() @InjectRepository(OrderCache) private readonly orderRepo?: Repository<OrderCache>,
  ) {}

  onModuleInit(): void {
    // A one-off CLI must not run a second copy of this scheduler (PLN-261008 D2).
    if (isCliContext()) return;
    const raw = this.config.get<string | number>('RETENTION_PURGE_INTERVAL_HOURS', 24);
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours <= 0) {
      this.logger.log('Retention purge scheduler disabled (RETENTION_PURGE_INTERVAL_HOURS <= 0)');
      return;
    }
    this.initialTimer = setTimeout(() => void this.runScheduled(), INITIAL_DELAY_MS);
    this.timer = setInterval(() => void this.runScheduled(), hours * 3_600_000);
    this.logger.log(`Retention purge scheduled every ${hours}h (first run in 5 min)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.initialTimer) clearTimeout(this.initialTimer);
  }

  private async runScheduled(): Promise<void> {
    try {
      const result = await this.purgeExpired();
      this.logger.log(
        `Retention purge: msgs=${result.messages} convs=${result.conversations} cjm=${result.cjmEvents} ` +
          `notifs=${result.notifications} sessions=${result.sessions} aiUsage=${result.aiUsage} ` +
          `orders=${result.orders} (eligible=${result.ordersEligible}, ` +
          `${result.orderCachePurgeEnabled ? 'enabled' : 'report only'}, ${result.orderCacheRetentionDays}d)`,
      );
    } catch (err) {
      this.logger.error(`Scheduled retention purge failed: ${String(err)}`);
    }
  }

  private retentionDays(): number {
    // env values arrive as strings; coerce and fall back on a non-positive/NaN value.
    const raw = this.config.get<string | number>('CONVERSATION_LOG_RETENTION_DAYS', 365);
    const days = Number(raw);
    return Number.isFinite(days) && days > 0 ? days : 365;
  }

  /**
   * How long AI usage roll-ups are kept, in days.
   *
   * A separate window from the conversation one, and deliberately longer. The
   * conversation window exists to dispose of personal data; these rows hold
   * none — they are counters. Thirteen months is what makes "this month against
   * the same month last year" answerable, and disposing of them on the
   * conversation clock (a year by default) would quietly remove the comparison
   * the window was chosen for.
   */
  private aiUsageRetentionDays(): number {
    const raw = this.config.get<string | number>('AI_USAGE_RETENTION_DAYS', 400);
    const days = Number(raw);
    return Number.isFinite(days) && days > 0 ? days : 400;
  }

  /**
   * The order cache window (PLN-261117-Order-Cache-Purge). Deleting is opt-in:
   * until ORDER_CACHE_PURGE_ENABLED=true a run only counts what it would take,
   * so an operator sees the number before anything goes.
   */
  private orderCachePolicy(): { days: number; enabled: boolean } {
    const days = Number(this.config.get<string | number>('ORDER_CACHE_RETENTION_DAYS', 180));
    const enabled = String(this.config.get<string | boolean>('ORDER_CACHE_PURGE_ENABLED', 'false')).toLowerCase() === 'true';
    return { days: Number.isFinite(days) && days > 0 ? days : 180, enabled };
  }

  /** Count — and, when enabled, delete — the cached orders nothing needs any more. */
  private async purgeOrderCache(): Promise<{ days: number; enabled: boolean; eligible: number; purged: number }> {
    const { days, enabled } = this.orderCachePolicy();
    if (!this.orderRepo) return { days, enabled, eligible: 0, purged: 0 };
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const manager = this.orderRepo.manager;
    const counted = (await manager.query(`SELECT COUNT(*) AS n ${DISPOSABLE_ORDERS_SQL}`, [cutoff, cutoff])) as Array<{ n: string | number }>;
    const eligible = Number(counted[0]?.n ?? 0);
    if (!enabled || eligible === 0) return { days, enabled, eligible, purged: 0 };

    let purged = 0;
    for (let batch = 0; batch < ORDER_PURGE_MAX_BATCHES; batch++) {
      const rows = (await manager.query(
        `SELECT o.id AS id ${DISPOSABLE_ORDERS_SQL} ORDER BY o.id LIMIT ${ORDER_PURGE_BATCH}`,
        [cutoff, cutoff],
      )) as Array<{ id: string | number }>;
      if (!rows.length) break;
      const ids = rows.map((r) => String(r.id));
      // Children first, in one transaction: an order must never be left
      // without its lines, nor lines without their order.
      await manager.transaction(async (trx) => {
        await trx.query('DELETE FROM fulfillments WHERE order_id IN (?)', [ids]);
        await trx.query('DELETE FROM order_items WHERE order_id IN (?)', [ids]);
        await trx.query('DELETE FROM orders_cache WHERE id IN (?)', [ids]);
      });
      purged += ids.length;
      if (rows.length < ORDER_PURGE_BATCH) break;
    }
    return { days, enabled, eligible, purged };
  }

  /** Delete rows older than the retention window: messages → conversations → cjm → notifications → stale sessions → usage → cached orders. */
  async purgeExpired(): Promise<RetentionPurgeResult> {
    const retentionDays = this.retentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // Attachments before their messages: the row is the only pointer to the file
    // on disk, so deleting the message first would strand the bytes forever
    // (PLN-260814 SI-5). Uploads abandoned before they were ever sent go too.
    const attachments =
      (await this.attachments.deleteOlderThan(cutoff)) + (await this.attachments.purgeUnattached());

    // Messages first (child of conversations), then conversations, then journey events.
    const msg = await this.messageRepo.delete({ createdAt: LessThan(cutoff) });
    const conv = await this.conversationRepo.delete({ createdAt: LessThan(cutoff) });
    const cjm = await this.cjmRepo.delete({ createdAt: LessThan(cutoff) });

    // Notifications carry order numbers / PII in title+body — same window (PRV-H3).
    const notif = await this.notificationRepo.delete({ createdAt: LessThan(cutoff) });

    // Moderation records and escalation alerts quote the message that tripped
    // them (up to 512 chars, and a preview). They outlived the conversation
    // they came from until now, which made the conversation window a partial
    // promise (PLN-260920 P4, data-inventory gaps G-1~G-7).
    const moderation = await this.moderationRepo.delete({ createdAt: LessThan(cutoff) });
    const alerts = await this.alertRepo.delete({ createdAt: LessThan(cutoff) });

    // AI usage on its own clock: keyed by `stat_date`, not a row timestamp, and
    // held longer than conversations (see aiUsageRetentionDays).
    const aiUsageRetentionDays = this.aiUsageRetentionDays();
    const usageCutoff = new Date(Date.now() - aiUsageRetentionDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const usage = await this.aiUsageRepo.delete({ statDate: LessThan(usageCutoff) });

    // Stale sessions: inactive past the window AND not referenced by a surviving
    // conversation (conversations newer than the cutoff keep their session).
    const sess = await this.sessionRepo
      .createQueryBuilder()
      .delete()
      .where('updated_at < :cutoff', { cutoff })
      .andWhere('id NOT IN (SELECT session_id FROM conversations)')
      .execute();

    // After the notifications above: an order is kept while a notification
    // still opens it, so the expired ones must be gone first.
    const orderCache = await this.purgeOrderCache();

    const result: RetentionPurgeResult = {
      retentionDays,
      cutoff: cutoff.toISOString(),
      messages: msg.affected ?? 0,
      conversations: conv.affected ?? 0,
      cjmEvents: cjm.affected ?? 0,
      notifications: notif.affected ?? 0,
      sessions: sess.affected ?? 0,
      attachments,
      aiUsage: usage.affected ?? 0,
      aiUsageRetentionDays,
      moderationLogs: moderation.affected ?? 0,
      agentAlerts: alerts.affected ?? 0,
      orderCacheRetentionDays: orderCache.days,
      orderCachePurgeEnabled: orderCache.enabled,
      ordersEligible: orderCache.eligible,
      orders: orderCache.purged,
    };

    // Scheduler-driven purge — 'system' actor, not a phantom admin (Stage 4).
    await this.audit.write({
      tenantId: null,
      actorType: 'system',
      actorId: 0,
      action: 'retention.purge',
      target: `cutoff=${result.cutoff}`,
      metadata: {
        retentionDays: result.retentionDays,
        messages: result.messages,
        conversations: result.conversations,
        cjmEvents: result.cjmEvents,
        notifications: result.notifications,
        sessions: result.sessions,
        attachments: result.attachments,
        aiUsage: result.aiUsage,
        aiUsageRetentionDays: result.aiUsageRetentionDays,
        moderationLogs: result.moderationLogs,
        agentAlerts: result.agentAlerts,
        orderCacheRetentionDays: result.orderCacheRetentionDays,
        orderCachePurgeEnabled: result.orderCachePurgeEnabled,
        ordersEligible: result.ordersEligible,
        orders: result.orders,
      },
    });

    return result;
  }
}
