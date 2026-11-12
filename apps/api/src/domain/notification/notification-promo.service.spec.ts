import { Repository } from 'typeorm';
import { NotificationPromoService } from './notification-promo.service';
import { Notification } from './entity/notification.entity';
import { Campaign } from '../campaign/entity/campaign.entity';
import { toNotificationResponse } from './notification.mapper';

/** ivy-docs T05 D2: a campaign row inherits kind + code from its own tenant's campaign only. */
describe('NotificationPromoService.forRows', () => {
  const row = (over: Partial<Notification>): Notification =>
    ({
      id: 1,
      tenantId: 1,
      customerId: 42,
      category: 'event',
      title: 't',
      body: null,
      statusBadge: null,
      linkUrl: null,
      refType: 'campaign',
      refId: 77,
      channel: 'in_app',
      readAt: null,
      deletedAt: null,
      createdAt: new Date('2026-11-12T00:00:00Z'),
      ...over,
    }) as Notification;

  function build(campaigns: Array<Partial<Campaign>>) {
    const find = jest.fn(async () => campaigns as Campaign[]);
    return { svc: new NotificationPromoService({ find } as unknown as Repository<Campaign>), find };
  }

  it("maps each campaign row to its campaign's kind and code, in one query", async () => {
    const { svc, find } = build([
      { id: 77, tenantId: 1, content: { kind: 'coupon', couponCode: 'SCHOOL20' } },
      { id: 78, tenantId: 1, content: { message: 'Mad Shade' } },
    ]);
    const out = await svc.forRows([row({ id: 1, refId: 77 }), row({ id: 2, refId: 78 }), row({ id: 3, refId: 77 })]);
    expect(find).toHaveBeenCalledTimes(1);
    expect(out.get('1')).toEqual({ kind: 'coupon', couponCode: 'SCHOOL20' });
    expect(out.get('2')).toEqual({ kind: 'event', couponCode: null });
    expect(out.get('3')).toEqual({ kind: 'coupon', couponCode: 'SCHOOL20' });
  });

  it("never uses another tenant's campaign", async () => {
    const { svc } = build([{ id: 77, tenantId: 2, content: { kind: 'coupon', couponCode: 'OTHER' } }]);
    const out = await svc.forRows([row({ refId: 77, tenantId: 1 })]);
    expect(out.size).toBe(0);
  });

  it('no campaign rows → no query; a deleted campaign → no promo', async () => {
    const none = build([]);
    await none.svc.forRows([row({ refType: 'order', refId: 5 }), row({ refType: null, refId: null })]);
    expect(none.find).not.toHaveBeenCalled();
    const gone = build([]);
    expect((await gone.svc.forRows([row({})])).size).toBe(0);
  });

  it('the response carries kind + code, null when there is no promo', () => {
    expect(toNotificationResponse(row({}), { kind: 'coupon', couponCode: 'SCHOOL20' })).toMatchObject({
      kind: 'coupon',
      couponCode: 'SCHOOL20',
      refType: 'campaign',
      refId: '77',
    });
    expect(toNotificationResponse(row({ refType: 'order' }))).toMatchObject({ kind: null, couponCode: null });
  });
});
