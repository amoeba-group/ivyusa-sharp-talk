import { CONSENT_STATE } from '@sharptalk/types';
import { INQUIRY_HOURLY_LIMIT, InquiryService } from './inquiry.service';
import { InquiryMapper } from './inquiry.mapper';

/**
 * ivy-docs T11 D3/D4: the contact form stores what a shopper typed, so the
 * guards are about consent, shape, volume and whose record it becomes — and the
 * team's notice must reach the support address with Reply-To the shopper.
 */
describe('InquiryService', () => {
  const guest = { id: 9, tenantId: 4, language: 'KO', customerId: null, sessionToken: 'tok' };
  const member = { ...guest, customerId: 70 };
  const form = { name: ' test ', email: ' HyKim4@IvyEnt.com ', message: ' dfdfdf ' };

  function build(
    opts: {
      session?: any;
      consent?: string;
      suppressed?: boolean;
      count?: number;
      conversation?: any;
      supportEmail?: string | null;
      smtp?: boolean;
    } = {},
  ) {
    const rows: any[] = [];
    const audits: any[] = [];
    const mails: any[] = [];
    const leads: any[] = [];
    const inquiryRepo = {
      create: (r: any) => ({ ...r }),
      save: jest.fn(async (r: any) => {
        const row = { id: r.id ?? 9001, createdAt: new Date('2026-11-12T14:03:00Z'), ...r };
        rows.push(row);
        return row;
      }),
      findOne: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id && r.tenantId === where.tenantId) ?? null),
    };
    const redis = { incr: jest.fn(async () => opts.count ?? 1), set: jest.fn(async () => undefined) };
    const mailer = {
      configured: () => opts.smtp !== false,
      send: jest.fn(async (m: any) => (mails.push(m), true)),
    };
    const svc = new InquiryService(
      inquiryRepo as never,
      { findOne: jest.fn(async () => opts.session ?? guest) } as never,
      { findOne: jest.fn(async () => opts.conversation ?? null) } as never,
      {
        findOne: jest.fn(async () => ({
          id: 4,
          name: 'ivyusa',
          widgetCopy: { displayName: 'IVY Beauty', supportEmail: opts.supportEmail === undefined ? 'hello@ivyusa.com' : opts.supportEmail },
        })),
      } as never,
      { effectiveConsentFor: jest.fn(async () => opts.consent ?? CONSENT_STATE.GRANTED) } as never,
      { createFromLead: jest.fn(async (_t: number, lead: any) => (leads.push(lead), { id: 555 })) } as never,
      { isSuppressed: jest.fn(async () => !!opts.suppressed) } as never,
      { write: jest.fn(async (a: any) => void audits.push(a)) } as never,
      redis as never,
      mailer as never,
    );
    return { svc, rows, audits, mails, leads, redis };
  }

  const flush = () => new Promise((r) => setImmediate(r));

  it("stores a guest's inquiry normalized, on a lead customer made from the address only", async () => {
    const h = build();
    const out = await h.svc.create('tok', form);

    expect(out).toEqual({ id: '9001', status: 'open' });
    expect(h.rows[0]).toMatchObject({
      tenantId: 4,
      customerId: 555,
      contactName: 'test',
      contactEmail: 'hykim4@ivyent.com',
      message: 'dfdfdf',
      language: 'KO',
      status: 'open',
      conversationId: null,
    });
    // A typed name must not rename an existing customer row.
    expect(h.leads).toEqual([{ email: 'hykim4@ivyent.com' }]);
    expect(h.audits[0]).toMatchObject({ action: 'inquiry.created', target: 'inquiry:9001' });
    expect(JSON.stringify(h.audits[0])).not.toContain('hykim4');
  });

  it("keeps a signed-in shopper's own customer and links only their own conversation", async () => {
    const mine = build({ session: member, conversation: { id: 42, sessionId: 9 } });
    await mine.svc.create('tok', { ...form, conversationId: '42' });
    expect(mine.rows[0]).toMatchObject({ customerId: 70, conversationId: 42 });
    expect(mine.leads).toEqual([]);

    const theirs = build({ session: member, conversation: { id: 43, sessionId: 10 } });
    await theirs.svc.create('tok', { ...form, conversationId: '43' });
    expect(theirs.rows[0].conversationId).toBeNull();
  });

  it('mails the support address with Reply-To the shopper', async () => {
    const h = build();
    await h.svc.create('tok', form);
    await flush();
    expect(h.mails).toHaveLength(1);
    expect(h.mails[0]).toMatchObject({ to: 'hello@ivyusa.com', replyTo: 'hykim4@ivyent.com' });
    expect(h.mails[0].subject).toBe('[IVY Beauty] New inquiry from test');
    expect(h.mails[0].text).toContain('dfdfdf');
  });

  it('sends no mail without a support address or without SMTP — the inquiry still stands', async () => {
    const noAddress = build({ supportEmail: null });
    await expect(noAddress.svc.create('tok', form)).resolves.toMatchObject({ status: 'open' });
    const noSmtp = build({ smtp: false });
    await expect(noSmtp.svc.create('tok', form)).resolves.toMatchObject({ status: 'open' });
    await flush();
    expect(noAddress.mails).toHaveLength(0);
    expect(noSmtp.mails).toHaveLength(0);
  });

  it('refuses without consent, with a bad field, or for an erased address — and stores nothing', async () => {
    const cases: Array<[ReturnType<typeof build>, any, number]> = [
      [build({ consent: CONSENT_STATE.PENDING }), form, 403],
      [build(), { ...form, email: 'not-an-email' }, 400],
      [build(), { ...form, name: '   ' }, 400],
      [build(), { ...form, message: 'x'.repeat(2001) }, 400],
      [build({ suppressed: true }), form, 409],
    ];
    for (const [h, input, status] of cases) {
      await expect(h.svc.create('tok', input)).rejects.toMatchObject({ status });
      expect(h.rows).toHaveLength(0);
    }
  });

  it(`allows ${INQUIRY_HOURLY_LIMIT} an hour per session`, async () => {
    const first = build({ count: 1 });
    await first.svc.create('tok', form);
    expect(first.redis.set).toHaveBeenCalledWith('inquiry:rl:9', '1', 3600);

    const last = build({ count: INQUIRY_HOURLY_LIMIT });
    await expect(last.svc.create('tok', form)).resolves.toBeTruthy();

    const over = build({ count: INQUIRY_HOURLY_LIMIT + 1 });
    await expect(over.svc.create('tok', form)).rejects.toMatchObject({ status: 429 });
    expect(over.rows).toHaveLength(0);
  });

  it('opens one in full only for its own tenant, and audits the read', async () => {
    const h = build();
    await h.svc.create('tok', form);
    const detail = await h.svc.detail(4, 9001, 7);
    expect(detail).toMatchObject({ contactEmail: 'hykim4@ivyent.com', message: 'dfdfdf', contactEmailMasked: 'hy***@ivyent.com' });
    expect(h.audits.at(-1)).toMatchObject({ action: 'inquiry.viewed', actorId: 7, target: 'inquiry:9001' });
    await expect(h.svc.detail(5, 9001, 7)).rejects.toMatchObject({ status: 404 });
  });

  it('marks answered and back to open', async () => {
    const h = build();
    await h.svc.create('tok', form);
    expect((await h.svc.setStatus(4, 9001, 7)).status).toBe('answered');
    expect((await h.svc.setStatus(4, 9001, 7, 'open')).status).toBe('open');
    expect(h.audits.at(-1)).toMatchObject({ action: 'inquiry.status_changed', metadata: { status: 'open' } });
  });
});

describe('InquiryMapper.toAdminView', () => {
  it('masks the address and shortens a long message for the list', () => {
    const view = InquiryMapper.toAdminView({
      id: 1,
      tenantId: 4,
      conversationId: null,
      orderId: null,
      customerId: 70,
      contactName: 'Mia',
      contactEmail: 'mia@example.com',
      message: 'a'.repeat(300),
      language: 'EN',
      status: 'open',
      createdAt: new Date(),
    });
    expect(view.contactEmailMasked).toBe('mi***@example.com');
    expect(view.messagePreview!.length).toBeLessThanOrEqual(121);
    expect(view).not.toHaveProperty('contactEmail');
    expect(view).not.toHaveProperty('message');
  });
});
