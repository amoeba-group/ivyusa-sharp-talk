import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Notification } from './entity/notification.entity';
import { NotificationPref } from './entity/notification-pref.entity';
import { Session } from '../session/entity/session.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { SessionService } from '../session/session.service';
import { NotifyInput } from './dto/response/notification.response';
import { OrderCache } from '../order/entity/order-cache.entity';
import { OrderItem } from '../order/entity/order-item.entity';
import {
  EMPTY_ITEM_SUMMARY,
  orderSummaryText,
  summarizeOrderItems,
} from '../order/order-item-summary';
import {
  EXTERNAL_CHANNELS,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_REF,
  NOTIFICATION_SCOPE,
  ORDER_NOTIFICATION_CATEGORIES,
  ORDER_STATUS_INTERNAL,
  ORDER_STATUS_UI,
  TRANSACTIONAL_CATEGORIES,
  WIDGET_TAB,
  WIDGET_TABS_DEFAULT,
  channelAllowedByTenant,
  isMarketingCategory,
  normalizeWidgetTabs,
  type NotificationScope,
} from '@sharptalk/types';

/** Every real category (excludes the 'all' sentinel, which is a query filter). */
const NOTIFICATION_CATEGORY_LIST = Object.values(NOTIFICATION_CATEGORY).filter((c) => c !== 'all');
import { EventBusService, EVENTS } from '../../infrastructure/infrastructure.module';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { RedisService } from '../../infrastructure/cache/redis.service';

/** TTL for the unread-badge count cache (PERF-11) — widget polls it every 30s. */
const UNREAD_CACHE_TTL_SEC = 20;

/**
 * Order notices (ivy-docs T02 B2): the same recent window the widget's order
 * list reads (10 orders / 30 days, PLN-260808), checked at most once per
 * customer per 5 minutes. An order placed in the last 24 hours arrives unread.
 */
const ORDER_NOTICE_MAX = 10;
const ORDER_NOTICE_DAYS = 30;
const ORDER_NOTICE_THROTTLE_SEC = 300;
const ORDER_NOTICE_UNREAD_MS = 24 * 60 * 60 * 1000;

function orderNoticeLockKey(customerId: number): string {
  return `notif:order-notices:${customerId}`;
}

/**
 * The feed is the in-app channel. `notify()` also writes one row per external
 * channel it delivered to (email/sms/web_push/push) as a delivery record, with
 * the same customer and text, so reading every row showed each event up to five
 * times and counted it five times on the badge (ivy-docs BUG-015). The in_app
 * row is written unconditionally, so filtering to it never hides an event.
 */
const FEED_CHANNEL = 'in_app';

/** Per-scope, because the widget may show two badges that must not share a cache. */
function unreadCacheKey(customerId: number, scope?: NotificationScope): string {
  return scope ? `notif:unread:${customerId}:${scope}` : `notif:unread:${customerId}`;
}

/**
 * Every cache key a customer's unread count can live under. Invalidation must
 * clear all of them: dropping only the unscoped key would leave a per-tab badge
 * showing a count the shopper has already read away.
 */
function unreadCacheKeys(customerId: number): string[] {
  return [
    unreadCacheKey(customerId),
    unreadCacheKey(customerId, NOTIFICATION_SCOPE.ORDER),
    unreadCacheKey(customerId, NOTIFICATION_SCOPE.NOTICE),
  ];
}

/**
 * Build the WHERE for a feed request, honouring the order/notice split.
 *
 * An explicit `category` always wins — a chip asks for exactly one thing. The
 * scope only decides what "all" means, which is the whole point: with both list
 * tabs on, Notifications' "All" must NOT include the order rows the Orders tab
 * is already showing, or the chip split buys nothing.
 */
function scopedWhere(
  customerId: number,
  category: string | undefined,
  scope: NotificationScope | undefined,
): Record<string, unknown> {
  // Shopper-deleted rows never surface again (PLN-260916 P3).
  const where: Record<string, unknown> = { customerId, channel: FEED_CHANNEL, deletedAt: IsNull() };
  if (category && category !== 'all') {
    where.category = category;
    return where;
  }
  if (scope === NOTIFICATION_SCOPE.ORDER) {
    where.category = In([...ORDER_NOTIFICATION_CATEGORIES]);
  } else if (scope === NOTIFICATION_SCOPE.NOTICE) {
    where.category = Not(In([...ORDER_NOTIFICATION_CATEGORIES]));
  }
  return where;
}

// Both lists moved to @sharptalk/types so the widget's marketing opt-out covers
// exactly the categories the server treats as marketing — a second copy here
// would drift the first time a category is added, and the failure mode is
// silent delivery to someone who opted out
// (PLN-260817-Widget-Header-Prefs-Cleanup §6.1).

/**
 * Customer/session notifications (FR-030/031). Always creates an in-app
 * notification on EVENTS.NOTIFICATION; honors per-customer prefs for external
 * channels (mocked delivery -> a notification row per enabled channel).
 */
@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(NotificationPref) private readonly prefRepo: Repository<NotificationPref>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly sessionService: SessionService,
    private readonly bus: EventBusService,
    private readonly redis: RedisService,
    @InjectRepository(OrderCache) private readonly orderRepo: Repository<OrderCache>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
  ) {}

  /** ensureOrderNotices runs in flight, per customer — see ensureOrderNoticesOnce. */
  private readonly orderNoticeRuns = new Map<number, Promise<number>>();

  onModuleInit(): void {
    this.bus.subscribe(EVENTS.NOTIFICATION, async (payload: unknown) => {
      await this.notify(payload as NotifyInput);
    });
  }

  /**
   * Create notifications for the given input. Always creates an in-app row.
   * If the input requests an external channel (or no channel), it additionally
   * fans out to enabled external channels per the customer's preferences.
   * Idempotent enough: re-delivery just appends rows the UI dedupes by id.
   */
  async notify(input: NotifyInput): Promise<Notification[]> {
    const customerId = input.customerId ?? null;
    const sessionId = input.sessionId ?? null;
    const created: Notification[] = [];

    // In-app is transactional/always-on.
    created.push(await this.createRow(input, 'in_app', customerId, sessionId));

    // Determine which external channels to attempt.
    const requested = input.channel && input.channel !== 'in_app' ? [input.channel] : [];
    const externalTargets =
      requested.length > 0
        ? requested.filter((c) => (EXTERNAL_CHANNELS as readonly string[]).includes(c))
        : [...EXTERNAL_CHANNELS];

    for (const channel of externalTargets) {
      const suppressed = await this.isSuppressed(
        customerId,
        channel,
        input.category,
        input.tenantId ?? null,
      );
      if (suppressed) continue; // reason already logged by isSuppressed
      const row = await this.createRow(input, channel, customerId, sessionId);
      created.push(row);
      if (channel === 'push') {
        // Real delivery: hand off to the push module (device-token fan-out).
        // Decoupled via the bus so NotificationModule stays provider-agnostic.
        await this.bus.publish(EVENTS.PUSH_DISPATCH, {
          notificationId: row.id,
          tenantId: input.tenantId ?? null,
          customerId,
          category: input.category,
          title: input.title,
          body: input.body ?? null,
          statusBadge: input.statusBadge ?? null,
          linkUrl: input.linkUrl ?? null,
          productHandle: input.productHandle ?? null,
        });
      } else {
        // email/sms/web_push delivery is still mocked — row only.
        this.logger.debug(`mock-deliver ${channel} -> customer ${customerId}: ${input.title}`);
      }
    }

    return created;
  }

  private async createRow(
    input: NotifyInput,
    channel: string,
    customerId: number | null,
    sessionId: number | null,
  ): Promise<Notification> {
    const row = await this.notifRepo.save(
      this.notifRepo.create({
        // Explicit tenantId: this insert runs detached from the request (bus
        // handler), so the ALS TenantSubscriber cannot stamp it.
        tenantId: input.tenantId ?? null,
        customerId,
        sessionId,
        category: input.category,
        title: input.title,
        body: input.body ?? null,
        statusBadge: input.statusBadge ?? null,
        linkUrl: input.linkUrl ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        channel,
        readAt: null,
      }),
    );
    // Invalidate AFTER the row exists. Clearing first left a window where an
    // unreadCount() in flight could re-cache a total that excluded this row and
    // then hold it for the whole TTL — the badge would sit one behind.
    if (customerId != null) {
      await Promise.all(unreadCacheKeys(customerId).map((k) => this.redis.del(k)));
    }
    return row;
  }

  /**
   * Single suppression decision point for EXTERNAL channels (Stage 6, D-4).
   * - No identified recipient → suppressed (fail-closed: never send external
   *   to an anonymous session).
   * - Explicit pref row → follow it (opt-out AND re-consent both honored).
   * - No row → transactional (payment/shipping) allowed; marketing
   *   (event/review) default-DENY.
   * in_app is not routed through here — it is always-on by design.
   */
  /**
   * Two layers, in this order: what the SHOP permits, then what the CUSTOMER
   * chose (PLN-260817-Widget-Header-Prefs-Cleanup §2.2).
   *
   * The tenant policy is a ceiling — a shop that turns SMS off must not send
   * SMS however a customer's stored preference reads. Below that ceiling the
   * customer's own row still decides, which is what keeps the mobile/PWA push
   * toggles working after the widget stopped offering the full matrix.
   */
  async isSuppressed(
    customerId: number | null,
    channel: string,
    category: string,
    tenantId?: number | null,
  ): Promise<boolean> {
    if (customerId == null) {
      this.logger.debug(`suppress ${channel}/${category}: no identified recipient (fail-closed)`);
      return true;
    }
    if (tenantId != null && !(await this.tenantAllows(tenantId, category, channel))) {
      this.logger.debug(`suppress ${channel}/${category}: tenant ${tenantId} policy disallows`);
      return true;
    }
    const pref = await this.prefRepo.findOne({ where: { customerId, channel, category } });
    if (pref) {
      const suppressed = pref.enabled !== 1;
      if (suppressed) {
        this.logger.debug(`suppress ${channel}/${category} for customer ${customerId}: pref disabled`);
      }
      return suppressed;
    }
    const transactional = (TRANSACTIONAL_CATEGORIES as readonly string[]).includes(category);
    if (!transactional) {
      this.logger.debug(
        `suppress ${channel}/${category} for customer ${customerId}: marketing default-deny (no consent row)`,
      );
    }
    return !transactional;
  }

  /**
   * The tenant's delivery policy. Unconfigured (`NULL`) means "no ceiling",
   * which is exactly how the system behaved before this setting existed — so
   * every tenant that never touches it keeps sending precisely what it sent.
   */
  private async tenantAllows(tenantId: number, category: string, channel: string): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return channelAllowedByTenant(tenant?.notificationChannels ?? null, category, channel);
  }

  /**
   * Is this customer refusing marketing on external channels?
   *
   * True when NO marketing category/channel pair is explicitly enabled — which
   * is also the state of a customer who has never touched anything, because
   * marketing is default-deny. Showing that as "opted out" is the honest
   * reading: the alternative would display a toggle as ON while nothing was
   * actually being sent.
   */
  async marketingOptOut(token: string): Promise<boolean> {
    const customerId = await this.requireCustomerId(token);
    const rows = await this.prefRepo.find({ where: { customerId } });
    return !rows.some(
      (r) => isMarketingCategory(r.category) && EXTERNAL_CHANNELS.includes(r.channel) && r.enabled === 1,
    );
  }

  /**
   * Set that refusal in one call.
   *
   * The widget used to write this as a grid of individual toggles; expressing
   * "no marketing" as eight separate writes let a partial failure leave a
   * shopper half-opted-out with no way to tell. One request, one meaning.
   */
  async setMarketingOptOut(token: string, optOut: boolean): Promise<boolean> {
    const customerId = await this.requireCustomerId(token);
    const categories = NOTIFICATION_CATEGORY_LIST.filter(isMarketingCategory);
    for (const category of categories) {
      for (const channel of EXTERNAL_CHANNELS) {
        await this.upsertPrefRow(customerId, channel, category, optOut ? 0 : 1);
      }
    }
    this.logger.debug(
      `customer ${customerId} marketing opt-${optOut ? 'out' : 'in'} across ${categories.length} categories`,
    );
    return optOut;
  }

  /** Insert-or-update one preference row (channel × category). */
  private async upsertPrefRow(
    customerId: number,
    channel: string,
    category: string,
    enabled: 0 | 1,
  ): Promise<void> {
    const existing = await this.prefRepo.findOne({ where: { customerId, channel, category } });
    if (existing) {
      existing.enabled = enabled;
      await this.prefRepo.save(existing);
      return;
    }
    await this.prefRepo.save(this.prefRepo.create({ customerId, channel, category, enabled }));
  }

  /** Widget-session authorization — single implementation in SessionService. */
  private requireCustomerId(token: string): Promise<number> {
    return this.sessionService.requireCustomerId(token);
  }

  async list(
    token: string,
    category: string | undefined,
    page: number,
    size: number,
    scope?: NotificationScope,
  ): Promise<[Notification[], number]> {
    const customerId = await this.requireCustomerId(token);
    await this.ensureOrderNoticesOnce(token, customerId);
    return this.notifRepo.findAndCount({
      where: scopedWhere(customerId, category, scope),
      // Event time first: an order notice is written when it is first noticed
      // but dated when the order was placed, so its id is newer than its time.
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
  }

  /**
   * Shares one ensureOrderNotices run between calls that arrive together. The
   * widget opens the feed and polls the badge at the same moment; without this
   * the call that lost the Redis lock would answer before the winner had
   * written anything, and the first open would show an empty Order chip.
   * A failure is logged and swallowed: the feed must load either way.
   */
  private ensureOrderNoticesOnce(token: string, customerId: number): Promise<number> {
    const running = this.orderNoticeRuns.get(customerId);
    if (running) return running;
    const run = this.ensureOrderNotices(token, customerId)
      .catch((err: unknown) => {
        this.logger.warn(
          `order notices skipped for customer ${customerId}: ${(err as Error)?.message ?? String(err)}`,
        );
        return 0;
      })
      .finally(() => this.orderNoticeRuns.delete(customerId));
    this.orderNoticeRuns.set(customerId, run);
    return run;
  }

  /**
   * Writes the "order confirmed" notices the feed's Order chip is made of
   * (ivy-docs T02 B2). Nothing else in the system writes one: Shopify orders
   * reach the cache already paid, and only shipping changes ever notified.
   *
   * - One `payment` row per recent order (≤ 10, ≤ 30 days) that has no order
   *   notice at all yet. A soft-deleted row counts, so a deleted notice stays
   *   deleted (T07).
   * - Dated when the order was placed. Unread only if that was in the last
   *   24 hours, so the first open after deploy does not light the badge for a
   *   month of history.
   * - Written straight to the repository, never through notify(): notify()
   *   fans out to email/SMS/push, and these are catch-up notices for the
   *   widget, not messages to send.
   * - Only for tenants whose widget shows ONE list tab, as IVY does. With both
   *   Notifications and Orders on, the order list already covers this and the
   *   chip bar has no Order feed (tab-chips `chipsFor`).
   * - Redis is the only guard against two API calls writing the same notice
   *   (no unique key, and none without a migration), so without Redis this
   *   does nothing.
   *
   * Returns how many notices it wrote.
   */
  async ensureOrderNotices(token: string, customerId: number): Promise<number> {
    if (!this.redis.available()) return 0;
    const first = await this.redis.setIfAbsent(
      orderNoticeLockKey(customerId),
      '1',
      ORDER_NOTICE_THROTTLE_SEC,
    );
    if (first !== true) return 0;

    // Tenant-scoped like every order read: a missing tenant narrows to nothing.
    const session = await this.sessionService.requireCustomer(token);
    const tenantId = session.tenantId ?? null;
    if (tenantId == null || !(await this.showsOneListTab(tenantId))) return 0;

    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.customer_id = :customerId', { customerId })
      .andWhere('o.tenant_id = :tenantId', { tenantId })
      .andWhere('COALESCE(o.ordered_at, o.created_at) >= DATE_SUB(NOW(), INTERVAL :d DAY)', {
        d: ORDER_NOTICE_DAYS,
      })
      .orderBy('COALESCE(o.ordered_at, o.created_at)', 'DESC')
      .take(ORDER_NOTICE_MAX)
      .getMany();
    // Not confirmed yet: its notice comes on a later check, once it is paid.
    const confirmed = orders.filter(
      (o) => o.statusInternal !== ORDER_STATUS_INTERNAL.PENDING_PAYMENT,
    );
    if (confirmed.length === 0) return 0;

    const noticed = await this.notifRepo.find({
      where: {
        customerId,
        refType: NOTIFICATION_REF.ORDER,
        refId: In(confirmed.map((o) => o.id)),
      },
    });
    const has = new Set(noticed.map((n) => String(n.refId)));
    const missing = confirmed.filter((o) => !has.has(String(o.id)));
    if (missing.length === 0) return 0;

    const summaries = await summarizeOrderItems(
      this.itemRepo,
      missing.map((o) => o.id),
    );
    const now = Date.now();
    const rows = missing.map((o) => {
      const placedAt = o.orderedAt ?? o.createdAt;
      const recent = now - placedAt.getTime() < ORDER_NOTICE_UNREAD_MS;
      return this.notifRepo.create({
        tenantId,
        customerId,
        sessionId: null,
        category: NOTIFICATION_CATEGORY.PAYMENT,
        // The widget redraws the row from the order; these are its fallback.
        title: o.orderNumber,
        body: orderSummaryText(summaries.get(String(o.id)) ?? EMPTY_ITEM_SUMMARY),
        statusBadge: ORDER_STATUS_UI.CONFIRMED,
        linkUrl: null,
        refType: NOTIFICATION_REF.ORDER,
        refId: o.id,
        channel: FEED_CHANNEL,
        readAt: recent ? null : new Date(now),
        deletedAt: null,
        createdAt: placedAt,
      });
    });
    await this.notifRepo.save(rows);
    await Promise.all(unreadCacheKeys(customerId).map((k) => this.redis.del(k)));
    this.logger.debug(`customer ${customerId}: wrote ${rows.length} order notice(s)`);
    return rows.length;
  }

  /**
   * Whether the tenant's widget shows a single list tab — the same test as
   * the widget's `chipsFor`, on the same resolved tab list the session hands it.
   */
  private async showsOneListTab(tenantId: number): Promise<boolean> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return false;
    const tabs: string[] = normalizeWidgetTabs(tenant.widgetTabs) ?? [...WIDGET_TABS_DEFAULT];
    return !(tabs.includes(WIDGET_TAB.NOTIFICATIONS) && tabs.includes(WIDGET_TAB.ORDERS));
  }

  /**
   * Shopper-side delete (PLN-260916 P3): soft, ownership-checked, and bulk so
   * the widget's "delete selected / delete all" is one round trip. Returns how
   * many rows changed; ids that are not the caller's are silently skipped
   * rather than leaking whether they exist.
   */
  async remove(token: string, input: { ids?: number[]; all?: boolean }): Promise<number> {
    const customerId = await this.requireCustomerId(token);
    const ids = (input.ids ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (!input.all && ids.length === 0) return 0;
    const where: Record<string, unknown> = { customerId, deletedAt: IsNull() };
    if (!input.all) where.id = In(ids);
    const result = await this.notifRepo.update(where, { deletedAt: new Date() });
    await Promise.all(unreadCacheKeys(customerId).map((k) => this.redis.del(k)));
    return result.affected ?? 0;
  }

  async markRead(token: string, id: number): Promise<Notification> {
    const customerId = await this.requireCustomerId(token);
    const notif = await this.notifRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!notif || notif.customerId !== customerId) {
      throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (notif.readAt == null) {
      notif.readAt = new Date();
      const saved = await this.notifRepo.save(notif);
      await Promise.all(unreadCacheKeys(customerId).map((k) => this.redis.del(k)));
      return saved;
    }
    return notif;
  }

  /**
   * Unread count, optionally for one half of the feed.
   *
   * The widget can show two list tabs whose badges must add up to the whole and
   * never double-count, so the split is computed here rather than by tallying a
   * page of rows on the client — a page is capped at `size`, which would make
   * both badges wrong the moment a shopper has more unread than fits on one.
   */
  async unreadCount(token: string, scope?: NotificationScope): Promise<number> {
    const customerId = await this.requireCustomerId(token);
    // The badge poll is what finds a new order between feed opens.
    await this.ensureOrderNoticesOnce(token, customerId);
    const key = unreadCacheKey(customerId, scope);
    if (this.redis.available()) {
      const hit = await this.redis.get(key);
      if (hit != null) return Number(hit);
    }
    const count = await this.notifRepo.count({
      where: { ...scopedWhere(customerId, 'all', scope), readAt: IsNull() },
    });
    await this.redis.set(key, String(count), UNREAD_CACHE_TTL_SEC);
    return count;
  }

  async listPrefs(token: string): Promise<NotificationPref[]> {
    const customerId = await this.requireCustomerId(token);
    return this.prefRepo.find({ where: { customerId }, order: { id: 'ASC' } });
  }

  /** Upsert a preference. in_app is always-on: disabling it is ignored. */
  async upsertPref(
    token: string,
    channel: string,
    category: string,
    enabled: boolean,
  ): Promise<NotificationPref> {
    const customerId = await this.requireCustomerId(token);
    const effectiveEnabled = channel === 'in_app' ? 1 : enabled ? 1 : 0;
    const existing = await this.prefRepo.findOne({ where: { customerId, channel, category } });
    if (existing) {
      existing.enabled = effectiveEnabled;
      return this.prefRepo.save(existing);
    }
    return this.prefRepo.save(
      this.prefRepo.create({ customerId, channel, category, enabled: effectiveEnabled }),
    );
  }
}
