import { ReviewRequestService, REVIEW_REQUEST_BATCH } from './review-request.service';
import { EVENTS } from '../../infrastructure/infrastructure.module';

/**
 * Review requests N days after delivery (IVY PRD v1 N-05,
 * PLN-261125-IVY-PRD-v1-Phase4 §2.2). Query builders are recorded, not executed.
 */
describe('ReviewRequestService', () => {
  const NOW = new Date('2026-11-25T12:00:00Z');
  const DAY = 86_400_000;

  type Due = { fid: string; orderId: string; customerId: string; orderNumber: string };

  function build(opts: {
    tenants?: Array<{ id: number; reviewRequestDays: number | null }>;
    due?: Due[];
    items?: Array<{ id: string; orderId: string; title: string }>;
    reviews?: Array<{ orderItemId: string; customerId: string }>;
    refusers?: number[];
    languages?: Array<{ cid: string; lang: string | null }>;
    /** Fulfillment ids another instance already claimed. */
    taken?: string[];
  }) {
    const calls: Array<[string, unknown[]]> = [];
    const qb: Record<string, unknown> = {};
    for (const m of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'orderBy', 'limit']) {
      qb[m] = jest.fn((...args: unknown[]) => {
        calls.push([m, args]);
        return qb;
      });
    }
    qb.getRawMany = jest.fn(async () => opts.due ?? []);
    const claimed: Array<Record<string, unknown>> = [];
    const fulfillRepo = {
      createQueryBuilder: jest.fn(() => qb),
      update: jest.fn(async (where: Record<string, unknown>, set: Record<string, unknown>) => {
        claimed.push({ ...where, ...set });
        return { affected: (opts.taken ?? []).includes(String(where.id)) ? 0 : 1 };
      }),
    };
    const tenantRepo = { find: jest.fn(async () => opts.tenants ?? []) };
    const itemRepo = { find: jest.fn(async () => opts.items ?? []) };
    const reviewRepo = { find: jest.fn(async () => opts.reviews ?? []) };
    const sessionRepo = { query: jest.fn(async () => opts.languages ?? []) };
    const notifications = { marketingRefusers: jest.fn(async () => new Set(opts.refusers ?? [])) };
    const publish = jest.fn(async (_event: string, _payload: unknown) => undefined);
    const svc = new ReviewRequestService(
      tenantRepo as never,
      fulfillRepo as never,
      itemRepo as never,
      reviewRepo as never,
      sessionRepo as never,
      notifications as never,
      { publish } as never,
    );
    const notices = () => publish.mock.calls.filter(([e]) => e === EVENTS.NOTIFICATION).map(([, p]) => p as Record<string, unknown>);
    return { svc, calls, claimed, notices, fulfillRepo, notifications, tenantRepo };
  }

  const flat = (calls: Array<[string, unknown[]]>) => JSON.stringify(calls);
  const due = (n: number, customerId = '500'): Due => ({ fid: `${n}`, orderId: `${100 + n}`, customerId, orderNumber: `#IVY-${n}` });

  it('selects one tenant’s delivered orders from N to N + 7 days ago, never asked, not cancelled or refunded', async () => {
    const h = build({});
    await h.svc.sweepTenant(7, 5, NOW);
    const dump = flat(h.calls);
    expect(dump).toContain('f.tenant_id = :tenantId');
    expect(dump).toContain('o.tenant_id = :tenantId');
    expect(dump).toContain('f.status = :delivered');
    expect(dump).toContain('"delivered":"delivered"');
    expect(dump).toContain('f.review_requested_at IS NULL');
    expect(dump).toContain('o.customer_id IS NOT NULL');
    expect(dump).toContain('"ended":["cancelled","refunded"]');
    expect(dump).toContain(`"dueBefore":"${new Date(NOW.getTime() - 5 * DAY).toISOString()}"`);
    expect(dump).toContain(`"notBefore":"${new Date(NOW.getTime() - 12 * DAY).toISOString()}"`);
    expect(dump).toContain(`["limit",[${REVIEW_REQUEST_BATCH}]]`);
  });

  it('asks about the first line not yet reviewed, in the shopper’s language, and marks the order', async () => {
    const h = build({
      due: [due(1)],
      items: [
        { id: '11', orderId: '101', title: 'Gel Polish Set' },
        { id: '12', orderId: '101', title: 'Nail Glue' },
      ],
      reviews: [{ orderItemId: '11', customerId: '500' }],
      languages: [{ cid: '500', lang: 'KO' }],
    });
    const r = await h.svc.sweepTenant(7, 5, NOW);
    expect(r).toEqual({ asked: 1, skipped: 0 });
    expect(h.claimed[0]).toMatchObject({ id: 1, reviewRequestedAt: NOW });
    expect(h.notices()).toHaveLength(1);
    expect(h.notices()[0]).toMatchObject({
      tenantId: 7,
      customerId: 500,
      category: 'review',
      statusBadge: 'Review',
      refType: 'order_item',
      refId: 12,
      title: '주문하신 상품은 어떠셨나요?',
      body: 'Nail Glue 리뷰를 남겨 주세요. (#IVY-1)',
    });
  });

  it('falls back to English without a session language', async () => {
    const h = build({ due: [due(2)], items: [{ id: '21', orderId: '102', title: 'Lash Glue' }] });
    await h.svc.sweepTenant(7, 5, NOW);
    expect(h.notices()[0]).toMatchObject({ title: 'How was your order?', body: 'Leave a review for Lash Glue (#IVY-2).' });
  });

  it('skips — and still marks — a customer who refused marketing, and an order already fully reviewed', async () => {
    const h = build({
      due: [due(3, '501'), due(4, '502')],
      items: [
        { id: '31', orderId: '103', title: 'A' },
        { id: '41', orderId: '104', title: 'B' },
      ],
      reviews: [{ orderItemId: '41', customerId: '502' }],
      refusers: [501],
    });
    const r = await h.svc.sweepTenant(7, 5, NOW);
    expect(r).toEqual({ asked: 0, skipped: 2 });
    expect(h.claimed.map((c) => c.id)).toEqual([3, 4]);
    expect(h.notices()).toHaveLength(0);
  });

  it('a review by someone else does not count as this customer’s', async () => {
    const h = build({
      due: [due(5, '503')],
      items: [{ id: '51', orderId: '105', title: 'C' }],
      reviews: [{ orderItemId: '51', customerId: '999' }],
    });
    expect(await h.svc.sweepTenant(7, 5, NOW)).toEqual({ asked: 1, skipped: 0 });
  });

  it('never sends for an order another instance claimed first', async () => {
    const h = build({ due: [due(6)], items: [{ id: '61', orderId: '106', title: 'D' }], taken: ['6'] });
    expect(await h.svc.sweepTenant(7, 5, NOW)).toEqual({ asked: 0, skipped: 0 });
    expect(h.notices()).toHaveLength(0);
  });

  it('does nothing more when no order is due', async () => {
    const h = build({ due: [] });
    expect(await h.svc.sweepTenant(7, 5, NOW)).toEqual({ asked: 0, skipped: 0 });
    expect(h.notifications.marketingRefusers).not.toHaveBeenCalled();
    expect(h.fulfillRepo.update).not.toHaveBeenCalled();
  });

  it('sweeps only tenants with a valid number of days, and one failure does not stop the others', async () => {
    const h = build({
      tenants: [
        { id: 1, reviewRequestDays: 0 },
        { id: 2, reviewRequestDays: 7 },
        { id: 3, reviewRequestDays: 61 },
        { id: 4, reviewRequestDays: 14 },
      ],
    });
    const spy = jest
      .spyOn(h.svc, 'sweepTenant')
      .mockImplementationOnce(async () => {
        throw new Error('db down');
      })
      .mockImplementationOnce(async () => ({ asked: 2, skipped: 1 }));
    const r = await h.svc.sweep(NOW);
    expect(spy.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [2, 7],
      [4, 14],
    ]);
    expect(r).toEqual({ asked: 2, skipped: 1 });
  });
});
