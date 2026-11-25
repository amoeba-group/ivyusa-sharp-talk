import { Repository } from 'typeorm';
import { NotificationService, countNewCards } from './notification.service';
import { Notification } from './entity/notification.entity';
import { NotificationPref } from './entity/notification-pref.entity';
import { Session } from '../session/entity/session.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { EventBusService } from '../../infrastructure/infrastructure.module';
import { RedisService } from '../../infrastructure/cache/redis.service';

/**
 * New / Recent (IVY PRD v1 slide 9): a new status for an order reads that
 * order's older notices, the badge counts one card per order, and read rows
 * stay listed for 30 days.
 */
describe('NotificationService — New / Recent (IVY PRD v1)', () => {
  type Row = Pick<Notification, 'id' | 'category' | 'refType' | 'refId'>;

  function build() {
    const updates: Array<{ where: Record<string, unknown>; set: Record<string, unknown> }> = [];
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const state: { listWhere?: Record<string, unknown>[]; unread: Row[] } = { unread: [] };
    let nextId = 900;
    const notifRepo = {
      create: jest.fn((e: Partial<Notification>) => e as Notification),
      save: jest.fn(async (e: Notification) => ({ ...e, id: nextId++ }) as Notification),
      update: jest.fn(async (where: Record<string, unknown>, set: Record<string, unknown>) => {
        updates.push({ where, set });
        return { affected: 1 };
      }),
      findAndCount: jest.fn(async ({ where }: { where: Record<string, unknown>[] }) => {
        state.listWhere = where;
        return [[], 0];
      }),
      find: jest.fn(async () => state.unread),
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
      }),
    } as unknown as Repository<Notification>;
    const svc = new NotificationService(
      notifRepo,
      { findOne: jest.fn(async () => null) } as unknown as Repository<NotificationPref>,
      {} as unknown as Repository<Session>,
      { findOne: jest.fn(async () => null) } as unknown as Repository<Tenant>,
      {
        requireCustomerId: jest.fn(async () => 42),
        requireCustomer: jest.fn(async () => ({ tenantId: null })),
      } as never,
      { subscribe: jest.fn(), publish: jest.fn() } as unknown as EventBusService,
      { del: jest.fn(), get: jest.fn(async () => null), set: jest.fn(), available: () => false } as unknown as RedisService,
    );
    return { svc, updates, queries, state };
  }

  it('a new status notice reads the older unread notices of the same order — only those', async () => {
    const h = build();
    await h.svc.notify({ tenantId: 1, customerId: 42, category: 'shipping', title: 'Shipping update', refType: 'order', refId: 7 });
    // One update, for the in-app row; the email/SMS/push copies are delivery records.
    expect(h.updates).toHaveLength(1);
    const { where, set } = h.updates[0];
    expect(where).toMatchObject({ customerId: 42, channel: 'in_app', refType: 'order', refId: 7 });
    expect((where.category as { value?: unknown }).value).toEqual(['payment', 'shipping']);
    expect((where.readAt as { type?: string }).type).toBe('isNull');
    // Never the row just written.
    const id = where.id as { type?: string; value?: unknown };
    expect(id.type).toBe('not');
    expect(id.value).toBe(900);
    expect(set.readAt).toBeInstanceOf(Date);
  });

  it('a promo, a review request or a notice about no order reads nothing', async () => {
    const h = build();
    await h.svc.notify({ tenantId: 1, customerId: 42, category: 'event', title: 'Sale', refType: 'campaign', refId: 3 });
    await h.svc.notify({ tenantId: 1, customerId: 42, category: 'review', title: 'Review', refType: 'order_item', refId: 9 });
    await h.svc.notify({ tenantId: 1, customerId: 42, category: 'shipping', title: 'Update' });
    expect(h.updates).toHaveLength(0);
  });

  it('opening the list reads superseded notices first, then lists unread + 30 days of read', async () => {
    const h = build();
    const before = Date.now();
    await h.svc.list('tok', 'all', 1, 20);
    expect(h.queries).toHaveLength(1);
    expect(h.queries[0].sql).toMatch(/UPDATE notifications n\s+JOIN notifications m/);
    expect(h.queries[0].params).toContain(42);
    const [unread, read] = h.state.listWhere!;
    expect((unread.readAt as { type?: string }).type).toBe('isNull');
    expect((read.readAt as { type?: string }).type).toBe('not');
    const since = (read.createdAt as { type?: string; value?: Date });
    expect(since.type).toBe('moreThanOrEqual');
    const days = (before - since.value!.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
    // Same feed filter on both halves.
    expect(unread).toMatchObject({ customerId: 42, channel: 'in_app' });
    expect(read).toMatchObject({ customerId: 42, channel: 'in_app' });
  });

  it('the badge counts one card per order', async () => {
    const h = build();
    h.state.unread = [
      { id: 1, category: 'payment', refType: 'order', refId: 7 },
      { id: 2, category: 'shipping', refType: 'order', refId: 7 },
      { id: 3, category: 'shipping', refType: 'order', refId: 8 },
      { id: 4, category: 'event', refType: 'campaign', refId: 5 },
    ];
    await expect(h.svc.unreadCount('tok')).resolves.toBe(3);
  });

  it('countNewCards: review requests and promos each count on their own', () => {
    expect(
      countNewCards([
        { id: 1, category: 'review', refType: 'order_item', refId: 7 },
        { id: 2, category: 'review', refType: 'order_item', refId: 7 },
        { id: 3, category: 'event', refType: 'campaign', refId: 5 },
        { id: 4, category: 'event', refType: 'campaign', refId: 5 },
        { id: 5, category: 'shipping', refType: 'order', refId: null },
      ]),
    ).toBe(5);
    expect(countNewCards([])).toBe(0);
  });
});
