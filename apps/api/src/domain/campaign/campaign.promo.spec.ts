import { Repository } from 'typeorm';
import { CampaignService } from './campaign.service';
import { Campaign } from './entity/campaign.entity';
import { Customer } from '../customer/entity/customer.entity';
import { ProductCache } from '../product/entity/product-cache.entity';
import { EventBusService } from '../../infrastructure/infrastructure.module';
import { NotificationService } from '../notification/notification.service';
import { ModerationService } from '../moderation/moderation.service';
import { AuditService } from '../audit/audit.service';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/**
 * Promo kind + coupon code (ivy-docs T05, PLN-261112 D1/D2): validated on
 * write, locked once sent, moderated with the rest of the copy, and every
 * fanned-out notification points back at its campaign.
 */
describe('CampaignService — promo kind + coupon code (ivy-docs T05)', () => {
  let svc: CampaignService;
  let campaigns: Campaign[];
  let notifyMock: jest.Mock;
  let moderate: jest.Mock;
  let auditWrite: jest.Mock;
  let busHandlers: Map<string, (payload: unknown) => Promise<void>>;

  beforeEach(() => {
    campaigns = [];
    busHandlers = new Map();
    const campaignRepo = {
      findOne: jest.fn(async ({ where }: { where: { id: number; tenantId?: number } }) =>
        campaigns.find((c) => c.id === where.id && (where.tenantId === undefined || c.tenantId === where.tenantId)) ?? null,
      ),
      create: jest.fn((e: Partial<Campaign>) => ({ id: 9, ...e }) as Campaign),
      save: jest.fn(async (e: Campaign) => e),
    } as unknown as Repository<Campaign>;
    const customerRepo = { find: jest.fn(async () => [{ id: 1, tenantId: 1 }]) } as unknown as Repository<Customer>;
    const productRepo = { findOne: jest.fn(async () => null) } as unknown as Repository<ProductCache>;
    const bus = {
      subscribe: jest.fn((event: string, h: (p: unknown) => Promise<void>) => busHandlers.set(event, h)),
      publish: jest.fn(),
    } as unknown as EventBusService;
    notifyMock = jest.fn(async () => [{}]);
    moderate = jest.fn(async ({ text }: { text: string }) => ({ decision: 'delivered', text }));
    auditWrite = jest.fn();
    svc = new CampaignService(
      campaignRepo,
      customerRepo,
      productRepo,
      bus,
      { notify: notifyMock } as unknown as NotificationService,
      { moderate } as unknown as ModerationService,
      { write: auditWrite } as unknown as AuditService,
    );
    svc.onModuleInit();
  });

  const seed = (over: Partial<Campaign>): Campaign => {
    const c = { id: 1, tenantId: 1, name: 'Back to school', segmentRef: null, content: null, status: 'draft', scheduledAt: null, sentAt: null, ...over } as Campaign;
    campaigns.push(c);
    return c;
  };
  const dispatch = () => busHandlers.get('campaign.dispatch')?.({ campaignId: 1 });
  const code = (e: unknown) => (e as { errorCode?: string }).errorCode;

  describe('write', () => {
    it('a coupon keeps its trimmed code; an event drops a stale one; no kind is left alone', async () => {
      const coupon = await svc.create(1, { name: 'c', content: { kind: 'coupon', couponCode: ' SCHOOL20 ' } });
      expect(coupon.content).toMatchObject({ kind: 'coupon', couponCode: 'SCHOOL20' });
      const event = await svc.create(1, { name: 'e', content: { kind: 'event', couponCode: 'OLD' } });
      expect(event.content).toEqual({ kind: 'event' });
      const legacy = await svc.create(1, { name: 'l', content: { message: 'hi' } });
      expect(legacy.content).toEqual({ message: 'hi' });
    });

    it('rejects an unknown kind and a coupon without a valid code (E5158)', async () => {
      for (const content of [
        { kind: 'flash' },
        { kind: 'coupon' },
        { kind: 'coupon', couponCode: 'TWO WORDS' },
        { kind: 'coupon', couponCode: 'A'.repeat(33) },
      ]) {
        const err = await svc.create(1, { name: 'x', content }).catch((e) => e);
        expect(code(err)).toBe(ERROR_CODE.CAMPAIGN_PROMO_INVALID.code);
      }
    });

    it('after sending, kind and code are locked (E5159); other edits still pass', async () => {
      seed({ status: 'sent', sentAt: new Date(), content: { kind: 'coupon', couponCode: 'SCHOOL20', message: 'old' } });
      const err = await svc.update(1, 1, { content: { kind: 'coupon', couponCode: 'SCHOOL30' } }).catch((e) => e);
      expect(code(err)).toBe(ERROR_CODE.CAMPAIGN_PROMO_LOCKED.code);
      await expect(svc.update(1, 1, { content: { kind: 'event' } })).rejects.toBeDefined();
      await expect(
        svc.update(1, 1, { content: { kind: 'coupon', couponCode: 'SCHOOL20', message: 'new copy' } }),
      ).resolves.toMatchObject({ content: { message: 'new copy', couponCode: 'SCHOOL20' } });
    });

    it('flipping status back to draft does not unlock the code', async () => {
      seed({ status: 'sent', sentAt: new Date(), content: { kind: 'coupon', couponCode: 'SCHOOL20' } });
      await svc.update(1, 1, { status: 'draft' });
      await expect(svc.update(1, 1, { content: { kind: 'coupon', couponCode: 'FREE' } })).rejects.toBeDefined();
    });

    it('a draft can still change kind and code', async () => {
      seed({ content: { kind: 'coupon', couponCode: 'SCHOOL20' } });
      await expect(svc.update(1, 1, { content: { kind: 'coupon', couponCode: 'SCHOOL30' } })).resolves.toMatchObject({
        content: { couponCode: 'SCHOOL30' },
      });
    });

    it('send re-checks content written before validation existed', async () => {
      seed({ content: { kind: 'coupon', couponCode: 'has space' } });
      await expect(svc.send(1, 1)).rejects.toBeDefined();
    });
  });

  describe('dispatch', () => {
    it('every notification points at its campaign; the code is moderated with the copy', async () => {
      seed({ content: { kind: 'coupon', couponCode: 'SCHOOL20', message: 'Buy one Get One' } });
      await dispatch();
      expect(moderate).toHaveBeenCalledWith(expect.objectContaining({ text: 'SCHOOL20' }));
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'event', refType: 'campaign', refId: 1 }),
      );
    });

    it('an event sends no code to moderation', async () => {
      seed({ content: { kind: 'event', message: 'Mad Shade' } });
      await dispatch();
      expect(moderate.mock.calls.map((c) => c[0].text)).not.toContain(undefined);
      expect(moderate).toHaveBeenCalledTimes(2);
    });

    it('a blocked or masked code blocks the whole dispatch, audited', async () => {
      for (const verdict of [
        { decision: 'blocked', text: 'SCHOOL20' },
        { decision: 'masked', text: 'SCH***20' },
      ]) {
        campaigns = [];
        notifyMock.mockClear();
        auditWrite.mockClear();
        seed({ content: { kind: 'coupon', couponCode: 'SCHOOL20', message: 'hi' } });
        moderate.mockImplementation(async ({ text }: { text: string }) =>
          text === 'SCHOOL20' ? verdict : { decision: 'delivered', text },
        );
        await dispatch();
        expect(notifyMock).not.toHaveBeenCalled();
        expect(auditWrite).toHaveBeenCalledWith(
          expect.objectContaining({ action: 'campaign.blocked', metadata: { reason: 'coupon_code_moderated' } }),
        );
      }
    });
  });
});
