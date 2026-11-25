import { Repository } from 'typeorm';
import { CampaignService } from './campaign.service';
import { Campaign } from './entity/campaign.entity';
import { Customer } from '../customer/entity/customer.entity';
import { ProductCache } from '../product/entity/product-cache.entity';
import { NotificationPref } from '../notification/entity/notification-pref.entity';
import { NotificationService } from '../notification/notification.service';
import { EventBusService } from '../../infrastructure/infrastructure.module';
import { ModerationService } from '../moderation/moderation.service';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../global/exception/business.exception';
import { blindIndex } from '../../global/util/crypto.util';

/**
 * Campaign recipients (IVY PRD v1 N-04, PLN-261125 §2.7): a campaign goes to
 * the customers it names — or to all of them — and never to someone who
 * refused marketing or chose CCPA "do not sell / share".
 */
describe('CampaignService — recipients and marketing refusals (IVY PRD v1 N-04)', () => {
  // The blind index is keyed: this suite brings its own key and puts the env back.
  const OLD_ENV = process.env;
  beforeAll(() => {
    process.env = { ...OLD_ENV, CRED_ENC_KEY: Buffer.alloc(32, 7).toString('base64') };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });
  const customers = () =>
    [
      { id: 1, tenantId: 1, email: 'ann@example.com' },
      { id: 2, tenantId: 1, email: 'bob@example.com' },
      { id: 3, tenantId: 1, email: 'cat@example.com' },
    ].map((c) => ({ ...c, emailHash: blindIndex(c.email) }));

  function build(prefs: Array<{ customerId: number; enabled: number }> = []) {
    const CUSTOMERS = customers();
    const campaigns: Campaign[] = [];
    const handlers = new Map<string, (p: unknown) => Promise<void>>();
    const notify = jest.fn(async () => [{}]);
    const audits: Array<Record<string, unknown>> = [];
    const campaignRepo = {
      create: (c: Partial<Campaign>) => ({ ...c }) as Campaign,
      save: jest.fn(async (c: Campaign) => {
        const row = { id: c.id ?? 1, ...c } as Campaign;
        const i = campaigns.findIndex((x) => x.id === row.id);
        if (i >= 0) campaigns[i] = row;
        else campaigns.push(row);
        return row;
      }),
      findOne: jest.fn(async ({ where }: { where: { id: number; tenantId?: number } }) =>
        campaigns.find((c) => c.id === where.id && (where.tenantId === undefined || c.tenantId === where.tenantId)) ?? null,
      ),
      findAndCount: jest.fn(async () => [campaigns, campaigns.length]),
    } as unknown as Repository<Campaign>;
    const customerRepo = {
      find: jest.fn(async ({ where }: { where: { tenantId: number; id?: { value: number[] }; emailHash?: { value: string[] } } }) =>
        CUSTOMERS.filter(
          (c) =>
            c.tenantId === where.tenantId &&
            (!where.id || where.id.value.includes(c.id)) &&
            (!where.emailHash || where.emailHash.value.includes(c.emailHash!)),
        ),
      ),
    } as unknown as Repository<Customer>;
    // A real NotificationService for marketingRefusers(), over a fake preference table.
    const prefRepo = {
      find: jest.fn(async ({ where }: { where: { customerId: { value: number[] } } }) =>
        prefs
          .filter((p) => where.customerId.value.includes(p.customerId))
          .map((p) => ({ ...p, channel: 'email', category: 'event' })),
      ),
    } as unknown as Repository<NotificationPref>;
    const notifications = new NotificationService(
      {} as never,
      prefRepo,
      {} as never,
      {} as never,
      {} as never,
      { subscribe: jest.fn(), publish: jest.fn() } as unknown as EventBusService,
      {} as never,
    );
    (notifications as unknown as { notify: unknown }).notify = notify;
    const svc = new CampaignService(
      campaignRepo,
      customerRepo,
      {} as unknown as Repository<ProductCache>,
      {
        subscribe: jest.fn((event: string, h: (p: unknown) => Promise<void>) => handlers.set(event, h)),
        publish: jest.fn(),
      } as unknown as EventBusService,
      notifications,
      { moderate: jest.fn(async ({ text }: { text: string }) => ({ decision: 'delivered', text })) } as unknown as ModerationService,
      { write: jest.fn(async (a: Record<string, unknown>) => void audits.push(a)) } as unknown as AuditService,
    );
    svc.onModuleInit();
    const dispatch = () => handlers.get('campaign.dispatch')!({ campaignId: 1 });
    const recipients = () => notify.mock.calls.map((c) => (c as unknown as [{ customerId: number }])[0].customerId).sort();
    return { svc, campaigns, dispatch, recipients, audits };
  }

  it('specific customers: matched by address, unknown addresses reported, only they receive it', async () => {
    const h = build();
    const created = await h.svc.create(1, {
      name: 'VIP',
      content: { message: 'Hi' },
      target_emails: [' Ann@Example.com ', 'cat@example.com', 'nobody@example.com', 'ann@example.com'],
    });
    expect(created.targetCustomerIds).toEqual([1, 3]);
    expect(created.targetNotFound).toEqual(['nobody@example.com']);
    await h.dispatch();
    expect(h.recipients()).toEqual([1, 3]);
  });

  it('no list means every customer, as before', async () => {
    const h = build();
    await h.svc.create(1, { name: 'All', content: { message: 'Hi' } });
    expect(h.campaigns[0].targetCustomerIds).toBeNull();
    await h.dispatch();
    expect(h.recipients()).toEqual([1, 2, 3]);
  });

  it('an empty list is refused, never read as "everyone"', async () => {
    const h = build();
    await expect(h.svc.create(1, { name: 'Oops', content: { message: 'Hi' }, target_emails: ['  '] })).rejects.toThrow(
      BusinessException,
    );
  });

  it('nobody matched: saved, but Send refuses', async () => {
    const h = build();
    await h.svc.create(1, { name: 'Ghosts', content: { message: 'Hi' }, target_emails: ['ghost@example.com'] });
    await expect(h.svc.send(1, 1)).rejects.toThrow(BusinessException);
  });

  it('switching back to everyone with null', async () => {
    const h = build();
    await h.svc.create(1, { name: 'VIP', content: { message: 'Hi' }, target_emails: ['ann@example.com'] });
    const updated = await h.svc.update(1, 1, { target_emails: null });
    expect(updated.targetCustomerIds).toBeNull();
  });

  it('a customer who refused marketing gets nothing — one who opted back in, or never chose, still does', async () => {
    const h = build([
      { customerId: 1, enabled: 0 }, // opted out
      { customerId: 2, enabled: 0 }, // opted out…
      { customerId: 2, enabled: 1 }, // …and back in
      // customer 3 never touched a setting
    ]);
    await h.svc.create(1, { name: 'All', content: { message: 'Hi' } });
    await h.dispatch();
    expect(h.recipients()).toEqual([2, 3]);
    expect(h.audits.find((a) => a.action === 'campaign.dispatched')?.metadata).toMatchObject({
      targeted: 3,
      skippedOptOut: 1,
    });
  });

  it('the edit form gets the recipients back as addresses', async () => {
    const h = build();
    await h.svc.create(1, { name: 'VIP', content: { message: 'Hi' }, target_emails: ['bob@example.com'] });
    const [items] = await h.svc.listAll(1, 1, 20);
    expect(items[0].targetEmails).toEqual(['bob@example.com']);
  });

  it('saving keeps the message (IVY: "message lost on save")', async () => {
    const h = build();
    await h.svc.create(1, { name: 'Promo', content: { message: 'Buy one get one', kind: 'event' } });
    const updated = await h.svc.update(1, 1, { name: 'Promo 2', content: { message: 'Buy one get one', kind: 'event' } });
    expect(updated.content).toMatchObject({ message: 'Buy one get one', kind: 'event' });
  });
});
