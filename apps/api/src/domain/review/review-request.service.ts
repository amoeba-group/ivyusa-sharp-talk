import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import {
  FULFILLMENT_STATUS,
  NOTIFICATION_REF,
  ORDER_STATUS_INTERNAL,
  REVIEW_REQUEST_BODY,
  REVIEW_REQUEST_GRACE_DAYS,
  REVIEW_REQUEST_TITLE,
  isReviewRequestDays,
  localized,
} from '@sharptalk/types';
import { Tenant } from '../tenant/entity/tenant.entity';
import { Fulfillment } from '../order/entity/fulfillment.entity';
import { OrderCache } from '../order/entity/order-cache.entity';
import { OrderItem } from '../order/entity/order-item.entity';
import { Review } from './entity/review.entity';
import { Session } from '../session/entity/session.entity';
import { NotificationService } from '../notification/notification.service';
import { EventBusService, EVENTS } from '../../infrastructure/infrastructure.module';
import { envNumber } from '../../global/util/env-number.util';
import { isCliContext } from '../../global/util/cli-context.util';

/** Minutes between sweeps; 0 switches the scheduler off. */
const SWEEP_MIN = envNumber('REVIEW_REQUEST_SWEEP_MIN', '60');
/** The first sweep after boot, so a deploy does not wait a full interval. */
const FIRST_SWEEP_SEC = 90;
/** Orders handled per tenant per sweep, so a backlog cannot stall the tick. */
export const REVIEW_REQUEST_BATCH = 200;
const DAY_MS = 86_400_000;

export interface ReviewRequestSweep {
  asked: number;
  skipped: number;
}

type DueRow = { fid: string | number; orderId: string | number; customerId: string | number; orderNumber: string };

/**
 * Review requests N days after delivery (IVY PRD v1 N-05,
 * PLN-261125-IVY-PRD-v1-Phase4 §2).
 *
 * The state is kept in `fulfillments.review_requested_at`, not in a timer: it
 * survives a restart, and it is the latch that keeps every order to a single
 * request, whether it was sent or skipped.
 */
@Injectable()
export class ReviewRequestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReviewRequestService.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Fulfillment) private readonly fulfillRepo: Repository<Fulfillment>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    private readonly notifications: NotificationService,
    private readonly bus: EventBusService,
  ) {}

  onModuleInit(): void {
    // A one-off CLI must not run a second copy of this scheduler (PLN-261008 D2).
    if (isCliContext()) return;
    if (!Number.isFinite(SWEEP_MIN) || SWEEP_MIN <= 0) {
      this.logger.warn('Review request sweep DISABLED (REVIEW_REQUEST_SWEEP_MIN=0)');
      return;
    }
    this.logger.log(`Review request sweep every ${SWEEP_MIN} min`);
    this.first = setTimeout(() => void this.sweep(), FIRST_SWEEP_SEC * 1000);
    this.first.unref?.();
    this.timer = setInterval(() => void this.sweep(), SWEEP_MIN * 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass over every tenant that switched review requests on. */
  async sweep(now = new Date()): Promise<ReviewRequestSweep> {
    const total: ReviewRequestSweep = { asked: 0, skipped: 0 };
    if (this.running) return total;
    this.running = true;
    try {
      const tenants = await this.tenantRepo.find({
        where: { reviewRequestDays: Not(IsNull()) },
        select: { id: true, reviewRequestDays: true },
      });
      for (const t of tenants) {
        const days = Number(t.reviewRequestDays);
        if (!isReviewRequestDays(days)) continue;
        try {
          const r = await this.sweepTenant(Number(t.id), days, now);
          total.asked += r.asked;
          total.skipped += r.skipped;
          if (r.asked || r.skipped) {
            this.logger.log(`review requests (tenant ${t.id}, ${days}d): asked ${r.asked}, skipped ${r.skipped}`);
          }
        } catch (e) {
          // One tenant's failure must not stop the others.
          this.logger.warn(`review request sweep failed (tenant ${t.id}): ${(e as Error).message}`);
        }
      }
    } catch (e) {
      this.logger.warn(`review request sweep failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
    return total;
  }

  /**
   * Orders of one tenant delivered N to N + grace days ago that were never
   * handled. A cancelled or refunded order is not asked about. Neither is an
   * order whose customer refused marketing, or one whose every line already
   * has a review: those are marked handled and skipped.
   */
  async sweepTenant(tenantId: number, days: number, now = new Date()): Promise<ReviewRequestSweep> {
    const out: ReviewRequestSweep = { asked: 0, skipped: 0 };
    const dueBefore = new Date(now.getTime() - days * DAY_MS);
    const notBefore = new Date(now.getTime() - (days + REVIEW_REQUEST_GRACE_DAYS) * DAY_MS);
    const due: DueRow[] = await this.fulfillRepo
      .createQueryBuilder('f')
      .innerJoin(OrderCache, 'o', 'o.id = f.order_id')
      .select('f.id', 'fid')
      .addSelect('f.order_id', 'orderId')
      .addSelect('o.customer_id', 'customerId')
      .addSelect('o.order_number', 'orderNumber')
      .where('f.tenant_id = :tenantId', { tenantId })
      .andWhere('o.tenant_id = :tenantId', { tenantId })
      .andWhere('f.status = :delivered', { delivered: FULFILLMENT_STATUS.DELIVERED })
      .andWhere('f.review_requested_at IS NULL')
      .andWhere('f.delivered_at <= :dueBefore', { dueBefore })
      .andWhere('f.delivered_at > :notBefore', { notBefore })
      .andWhere('o.customer_id IS NOT NULL')
      .andWhere('(o.status_internal IS NULL OR o.status_internal NOT IN (:...ended))', {
        ended: [ORDER_STATUS_INTERNAL.CANCELLED, ORDER_STATUS_INTERNAL.REFUNDED],
      })
      .orderBy('f.delivered_at', 'ASC')
      .limit(REVIEW_REQUEST_BATCH)
      .getRawMany();
    if (!due.length) return out;

    const customerIds = [...new Set(due.map((r) => Number(r.customerId)))];
    const orderIds = [...new Set(due.map((r) => Number(r.orderId)))];
    const refusers = await this.notifications.marketingRefusers(customerIds);
    const items = await this.itemRepo.find({
      where: { orderId: In(orderIds) },
      select: { id: true, orderId: true, title: true },
      order: { orderId: 'ASC', id: 'ASC' },
    });
    const reviewed = items.length
      ? new Set(
          (
            await this.reviewRepo.find({
              where: { orderItemId: In(items.map((i) => i.id)) },
              select: { orderItemId: true, customerId: true },
            })
          ).map((r) => `${Number(r.customerId)}:${Number(r.orderItemId)}`),
        )
      : new Set<string>();
    const languages = await this.latestLanguages(customerIds);

    for (const row of due) {
      // Claim first: the column is the latch, so a second instance or an
      // overlapping tick finds nothing left to do.
      const claimed = await this.fulfillRepo.update(
        { id: Number(row.fid), reviewRequestedAt: IsNull() },
        { reviewRequestedAt: now },
      );
      if (!claimed.affected) continue;
      const customerId = Number(row.customerId);
      const item = items.find(
        (i) => Number(i.orderId) === Number(row.orderId) && !reviewed.has(`${customerId}:${Number(i.id)}`),
      );
      if (refusers.has(customerId) || !item) {
        out.skipped++;
        continue;
      }
      const lang = languages.get(customerId) ?? 'EN';
      await this.bus.publish(EVENTS.NOTIFICATION, {
        tenantId,
        customerId,
        category: 'review',
        title: localized(REVIEW_REQUEST_TITLE, lang),
        body: localized(REVIEW_REQUEST_BODY, lang)
          .replace('{item}', item.title)
          .replace('{order}', row.orderNumber),
        statusBadge: 'Review',
        // The widget's ⭐ Write Review opens this line's form (T06).
        refType: NOTIFICATION_REF.ORDER_ITEM,
        refId: Number(item.id),
      });
      out.asked++;
    }
    return out;
  }

  /** Each customer's language: the one of their latest chat session. */
  private async latestLanguages(customerIds: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (!customerIds.length) return out;
    const rows: Array<{ cid: string | number; lang: string | null }> = await this.sessionRepo.query(
      `SELECT s.customer_id AS cid, s.language AS lang
         FROM sessions s
         JOIN (SELECT customer_id, MAX(id) AS mid FROM sessions WHERE customer_id IN (?) GROUP BY customer_id) x
           ON x.mid = s.id`,
      [customerIds],
    );
    for (const r of rows) if (r.lang) out.set(Number(r.cid), String(r.lang));
    return out;
  }
}
