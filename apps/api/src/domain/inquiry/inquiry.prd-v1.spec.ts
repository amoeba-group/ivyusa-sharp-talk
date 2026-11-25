import { CONSENT_STATE } from '@sharptalk/types';
import { InquiryService, transcriptLines } from './inquiry.service';

/**
 * IVY PRD v1 (PLN-261125 §2.5–2.6): Feedback is kept for the admin and needs
 * only a message; an inquiry carries the shopper's own order and the recent
 * chat to the support mailbox.
 */
describe('InquiryService — PRD v1 feedback, order and recent chat', () => {
  const guest = { id: 9, tenantId: 4, language: 'en', customerId: null, sessionToken: 'tok' };
  const member = { ...guest, customerId: 70 };
  const form = { name: 'Jane', email: 'jane@example.com', message: 'Where is my parcel?' };
  const flush = () => new Promise((r) => setImmediate(r));

  function build(
    opts: {
      session?: any;
      conversation?: any;
      order?: any;
      messages?: any[];
    } = {},
  ) {
    const rows: any[] = [];
    const audits: any[] = [];
    const mails: any[] = [];
    const leads: any[] = [];
    let listWhere: any;
    const inquiryRepo = {
      create: (r: any) => ({ ...r }),
      save: jest.fn(async (r: any) => {
        const row = { id: 9001, createdAt: new Date('2026-11-25T14:03:00Z'), ...r };
        rows.push(row);
        return row;
      }),
      findAndCount: jest.fn(async ({ where }: any) => {
        listWhere = where;
        return [[{ id: 1, tenantId: 4, orderId: 7, kind: 'inquiry', status: 'open', message: 'm' }], 1];
      }),
    };
    const orderRepo = {
      findOne: jest.fn(async ({ where }: any) =>
        opts.order && opts.order.id === where.id && opts.order.tenantId === where.tenantId ? opts.order : null,
      ),
      find: jest.fn(async () => (opts.order ? [opts.order] : [{ id: 7, orderNumber: 'IVY-39891' }])),
    };
    const messageRepo = { find: jest.fn(async () => [...(opts.messages ?? [])].reverse()) };
    const svc = new InquiryService(
      inquiryRepo as never,
      { findOne: jest.fn(async () => opts.session ?? guest) } as never,
      { findOne: jest.fn(async () => opts.conversation ?? null) } as never,
      { findOne: jest.fn(async () => ({ id: 4, name: 'ivyusa', widgetCopy: { displayName: 'IVY USA', supportEmail: 'hello@ivyusa.com' } })) } as never,
      { effectiveConsentFor: jest.fn(async () => CONSENT_STATE.GRANTED) } as never,
      { createFromLead: jest.fn(async (_t: number, lead: any) => (leads.push(lead), { id: 555 })) } as never,
      { isSuppressed: jest.fn(async () => false) } as never,
      { write: jest.fn(async (a: any) => void audits.push(a)) } as never,
      { incr: jest.fn(async () => 1), set: jest.fn(async () => undefined) } as never,
      { configured: () => true, send: jest.fn(async (m: any) => (mails.push(m), true)) } as never,
      orderRepo as never,
      messageRepo as never,
    );
    return { svc, rows, audits, mails, leads, get listWhere() { return listWhere; } };
  }

  it('feedback needs only a message: stored as feedback, no address, no lead, no mail', async () => {
    const h = build();
    await h.svc.create('tok', { name: '', email: '', message: ' Love the new serum! ', kind: 'feedback' });
    await flush();
    expect(h.rows[0]).toMatchObject({
      kind: 'feedback',
      message: 'Love the new serum!',
      contactName: null,
      contactEmail: null,
      customerId: null,
    });
    expect(h.leads).toEqual([]);
    expect(h.mails).toEqual([]);
    expect(h.audits[0]).toMatchObject({ action: 'feedback.created' });
  });

  it('feedback still refuses an empty message or a malformed address', async () => {
    const h = build();
    await expect(h.svc.create('tok', { name: '', email: '', message: '  ', kind: 'feedback' })).rejects.toBeTruthy();
    await expect(h.svc.create('tok', { name: '', email: 'not-an-address', message: 'hi', kind: 'feedback' })).rejects.toBeTruthy();
    expect(h.rows).toEqual([]);
  });

  it('an inquiry still needs the name and the address', async () => {
    const h = build();
    await expect(h.svc.create('tok', { name: '', email: '', message: 'hi' })).rejects.toBeTruthy();
    expect(h.rows).toEqual([]);
  });

  it("attaches the shopper's own order and names it in the mail", async () => {
    const h = build({ session: member, order: { id: 7, tenantId: 4, customerId: 70, orderNumber: 'IVY-39891' } });
    await h.svc.create('tok', { ...form, orderId: '7' });
    await flush();
    expect(h.rows[0]).toMatchObject({ orderId: 7, kind: 'inquiry' });
    expect(h.mails[0].subject).toBe('[IVY USA] New inquiry from Jane — order IVY-39891');
    expect(h.mails[0].text).toContain('Order: IVY-39891');
  });

  it("never attaches someone else's order, nor one named by an anonymous session", async () => {
    const theirs = build({ session: member, order: { id: 7, tenantId: 4, customerId: 71, orderNumber: 'IVY-1' } });
    await theirs.svc.create('tok', { ...form, orderId: '7' });
    expect(theirs.rows[0].orderId).toBeNull();

    const anon = build({ order: { id: 7, tenantId: 4, customerId: 70, orderNumber: 'IVY-1' } });
    await anon.svc.create('tok', { ...form, orderId: '7' });
    expect(anon.rows[0].orderId).toBeNull();
  });

  it('carries the recent chat and a console link when sent from a conversation', async () => {
    const prev = process.env.APP_PUBLIC_URL;
    process.env.APP_PUBLIC_URL = 'https://talk.ivyusa.com/';
    try {
      const h = build({
        session: member,
        conversation: { id: 42, sessionId: 9 },
        messages: [
          { id: 1, senderType: 'user', body: 'Where is my order?', createdAt: new Date('2026-11-25T14:01:00Z') },
          { id: 2, senderType: 'ai', body: 'Your order IVY-39891\nis In Transit.', createdAt: new Date('2026-11-25T14:02:00Z') },
        ],
      });
      await h.svc.create('tok', { ...form, conversationId: '42' });
      await flush();
      const text: string = h.mails[0].text;
      expect(text).toContain('— Recent chat (last 2 messages) —');
      expect(text).toContain('[14:01 UTC] Customer: Where is my order?');
      expect(text).toContain('[14:02 UTC] AI: Your order IVY-39891 is In Transit.');
      expect(text).toContain('Open the chat in the console: https://talk.ivyusa.com/live-chat?c=42');
      expect(text.indexOf('Customer: Where')).toBeLessThan(text.indexOf('AI: Your order'));
    } finally {
      if (prev === undefined) delete process.env.APP_PUBLIC_URL;
      else process.env.APP_PUBLIC_URL = prev;
    }
  });

  it('transcript lines are one line each and cut at 500 characters', () => {
    const [line] = transcriptLines([{ senderType: 'agent', body: `${'x'.repeat(600)}`, createdAt: new Date('2026-11-25T09:05:00Z') }]);
    expect(line.startsWith('[09:05 UTC] Staff: ')).toBe(true);
    expect(line.endsWith('…')).toBe(true);
    expect(line.length).toBe('[09:05 UTC] Staff: '.length + 500 + 1);
  });

  it('the console list filters by kind and shows the order number', async () => {
    const h = build();
    const page = (await h.svc.listAll(4, 'all', '1', '20', 'feedback')) as any;
    expect(h.listWhere).toEqual({ tenantId: 4, kind: 'feedback' });
    expect(page.items[0]).toMatchObject({ kind: 'inquiry', orderNumber: 'IVY-39891' });
  });
});
