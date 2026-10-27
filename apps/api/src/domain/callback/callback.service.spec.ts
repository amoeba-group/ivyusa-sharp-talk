import { CONSENT_STATE } from '@sharptalk/types';
import { CallbackService } from './callback.service';

/**
 * PLN-261026 B4–B6: a callback stores a contact the shopper chose to give, so
 * every guard is about whose contact, which kind, and whether it may be kept.
 */
describe('CallbackService', () => {
  const conversation = { id: 42, tenantId: 4, sessionId: 9, customerId: 70, agentId: null };
  const guest = { id: 9, tenantId: 4, language: 'KO', identityLevel: 'guest', customerId: null } as never;
  const member = { id: 9, tenantId: 4, language: 'KO', identityLevel: 'verified', customerId: 70 } as never;
  const claimed = { id: 9, tenantId: 4, language: 'KO', identityLevel: 'claimed', customerId: 70 } as never;

  function build(opts: { channels?: string[] | null; consent?: string; open?: any; suppressed?: boolean; managers?: number[] } = {}) {
    const rows: any[] = [];
    const msgs: any[] = [];
    const events: any[] = [];
    const repo = {
      findOne: jest.fn(async () => opts.open ?? null),
      create: (r: any) => ({ ...r }),
      save: jest.fn(async (r: any) => (rows.push(r), { id: r.id ?? 501, ...r })),
    };
    const svc = new CallbackService(
      repo as never,
      { findOne: jest.fn(async () => conversation) } as never,
      { create: (m: any) => m, save: jest.fn(async (m: any) => (msgs.push(m), m)) } as never,
      {} as never,
      { findOne: jest.fn(async () => ({ id: 70, email: 'member@hotel.vn', phone: '+84901234521' })) } as never,
      { find: jest.fn(async () => [{ id: 1, targetUserId: 11 }, { id: 2, targetUserId: 12 }]) } as never,
      {} as never,
      {
        getHandoffConfig: jest.fn(async () => ({
          callback: opts.channels === null ? undefined : { enabled: true, channels: opts.channels ?? ['email', 'phone'] },
          reAlert: { escalateToUserIds: opts.managers ?? [99] },
        })),
      } as never,
      { effectiveConsentFor: jest.fn(async () => opts.consent ?? CONSENT_STATE.GRANTED) } as never,
      { isSuppressed: jest.fn(async () => !!opts.suppressed) } as never,
      { write: jest.fn(async () => undefined) } as never,
      { publish: jest.fn(async (_e: string, p: any) => void events.push(p)) } as never,
    );
    return { svc, rows, msgs, events };
  }

  it('stores an entered phone normalized, says so masked, and pages earlier assignees + managers', async () => {
    const h = build();
    const out = await h.svc.create(guest, { conversationId: 42, source: 'entered', channel: 'phone', contact: '+84 90-123 4521' });

    expect(h.rows[0]).toMatchObject({ channel: 'phone', contact: '+84901234521', contactSource: 'entered', status: 'requested' });
    expect(out.contactMasked).toBe('+84 90*****21');
    expect(h.msgs[0].body).toContain('+84 90*****21');
    expect(h.msgs[0].body).not.toContain('901234521');
    expect(h.events[0]).toMatchObject({ reason: 'callback_request', targetUserIds: [11, 12, 99] });
    expect(h.events[0].preview).not.toContain('901234521');
  });

  it("uses a verified member's own contact, read server side", async () => {
    const h = build();
    await h.svc.create(member, { conversationId: 42, source: 'member', channel: 'email' });
    expect(h.rows[0]).toMatchObject({ channel: 'email', contact: 'member@hotel.vn', contactSource: 'member' });
  });

  it('does not treat a claimed (unsigned) identity as a member', async () => {
    const h = build();
    await expect(h.svc.create(claimed, { conversationId: 42, source: 'member' })).rejects.toMatchObject({ status: 400 });
    expect((await h.svc.options(claimed)).member).toEqual([]);
  });

  it('shows the member contacts masked in the options', async () => {
    const h = build({ channels: ['phone'] });
    expect(await h.svc.options(member)).toEqual({
      enabled: true,
      channels: ['phone'],
      member: [{ channel: 'phone', masked: '+84 90*****21' }],
    });
  });

  it('refuses when callbacks are off, the kind is not offered, consent is missing, or the contact is unreadable', async () => {
    await expect(build({ channels: null }).svc.create(guest, { conversationId: 42, source: 'entered', channel: 'email', contact: 'a@b.co' })).rejects.toMatchObject({ status: 403 });
    await expect(build({ channels: ['email'] }).svc.create(guest, { conversationId: 42, source: 'entered', channel: 'phone', contact: '0901234521' })).rejects.toMatchObject({ status: 403 });
    await expect(build({ consent: CONSENT_STATE.DECLINED }).svc.create(guest, { conversationId: 42, source: 'entered', channel: 'email', contact: 'a@b.co' })).rejects.toMatchObject({ status: 403 });
    await expect(build().svc.create(guest, { conversationId: 42, source: 'entered', channel: 'email', contact: 'not-an-email' })).rejects.toMatchObject({ status: 400 });
  });

  it('refuses an address whose owner asked to be erased', async () => {
    await expect(build({ suppressed: true }).svc.create(guest, { conversationId: 42, source: 'entered', channel: 'email', contact: 'gone@x.com' })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses someone else's conversation", async () => {
    const other = { ...(guest as any), id: 10 };
    await expect(build().svc.create(other, { conversationId: 42, source: 'entered', channel: 'email', contact: 'a@b.co' })).rejects.toMatchObject({ status: 404 });
  });

  it('asking again replaces the open request instead of adding one', async () => {
    const open = { id: 77, tenantId: 4, conversationId: 42, status: 'requested', channel: 'email', contact: 'old@x.com' };
    const h = build({ open });
    const out = await h.svc.create(guest, { conversationId: 42, source: 'entered', channel: 'email', contact: 'New@X.com' });
    expect(out.id).toBe('77');
    expect(h.rows[0]).toMatchObject({ id: 77, contact: 'new@x.com' });
  });
});
