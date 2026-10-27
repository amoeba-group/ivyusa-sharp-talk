import { CHAT_CLOSE_DEFAULT_COPY, CONVERSATION_STATUS, SENDER_TYPE } from '@sharptalk/types';
import { IdleConversationService } from './idle-conversation.service';

const MIN = 60_000;

/**
 * PLN-261026 A1/A2: under a tenant close policy the sweep asks for a rating
 * once the AI or an agent has answered and the shopper went quiet, and closes
 * after a further wait. Each visible action is pinned here.
 */
describe('IdleConversationService.sweepPolicy', () => {
  const policy = { csatAfterMin: 3, closeAfterMin: 3 };

  function build(opts: {
    due?: any[];
    quiet?: Array<{ lastAt: Date; lastSender: string; id?: number }>;
    repliesAfterPrompt?: number;
  }) {
    const saved: any[] = [];
    const updates: any[] = [];
    const audits: any[] = [];
    const convRepo = {
      find: jest.fn(async () => opts.due ?? []),
      update: jest.fn(async (where: any, patch: any) => void updates.push({ where, patch })),
    };
    const msgRepo = {
      count: jest.fn(async () => opts.repliesAfterPrompt ?? 0),
      create: (m: any) => m,
      save: jest.fn(async (m: any) => (saved.push(m), m)),
    };
    const sessionRepo = { findOne: jest.fn(async () => ({ id: 9, language: 'VI' })) };
    const assignmentRepo = { update: jest.fn(async () => undefined) };
    const audit = { write: jest.fn(async (a: any) => void audits.push(a)) };
    const svc = new IdleConversationService(
      convRepo as never,
      msgRepo as never,
      sessionRepo as never,
      assignmentRepo as never,
      audit as never,
    );
    jest.spyOn(svc, 'quietCandidates').mockResolvedValue(
      (opts.quiet ?? []).map((q) => ({
        conversation: { id: q.id ?? 42, tenantId: 4, sessionId: 9, status: CONVERSATION_STATUS.AI_ACTIVE } as never,
        lastAt: q.lastAt,
        lastSender: q.lastSender,
      })),
    );
    return { svc, saved, updates, audits };
  }

  it('asks an AI thread for a rating after the AI answered and the shopper went quiet', async () => {
    const h = build({ quiet: [{ lastAt: new Date(Date.now() - 4 * MIN), lastSender: SENDER_TYPE.AI }] });
    const r = await h.svc.sweepPolicy(4, policy);

    expect(r.prompted).toBe(1);
    expect(h.saved[0]).toMatchObject({ senderType: SENDER_TYPE.SYSTEM, body: CHAT_CLOSE_DEFAULT_COPY.csatPrompt.VI });
    expect(h.updates[0].patch.idlePromptAt).toBeInstanceOf(Date);
    expect(h.audits[0].action).toBe('chat.csat_prompted');
  });

  it('does not ask when the shopper spoke last — they are owed an answer', async () => {
    const h = build({ quiet: [{ lastAt: new Date(Date.now() - 4 * MIN), lastSender: SENDER_TYPE.USER }] });
    const r = await h.svc.sweepPolicy(4, policy);
    expect(r).toEqual({ prompted: 0, closed: 0, silentlyClosed: 0 });
    expect(h.saved).toHaveLength(0);
  });

  it('closes threads that went quiet before the policy was switched on, without a word', async () => {
    const since = new Date(Date.now() - 10 * MIN).toISOString();
    const h = build({ quiet: [{ lastAt: new Date(Date.now() - 60 * MIN), lastSender: SENDER_TYPE.AI }] });
    const r = await h.svc.sweepPolicy(4, { ...policy, since });

    expect(r.silentlyClosed).toBe(1);
    expect(h.saved).toHaveLength(0);
    expect(h.updates[0].patch.status).toBe(CONVERSATION_STATUS.ENDED);
    expect(h.audits[0].metadata).toEqual({ reason: 'before_policy' });
  });

  it('closes with the closing line once the rating request went unanswered', async () => {
    const prompted = { id: 7, tenantId: 4, sessionId: 9, status: CONVERSATION_STATUS.AGENT, idlePromptAt: new Date(Date.now() - 4 * MIN) };
    const h = build({ due: [prompted] });
    const r = await h.svc.sweepPolicy(4, policy);

    expect(r.closed).toBe(1);
    expect(h.saved[0].body).toBe(CHAT_CLOSE_DEFAULT_COPY.closingNotice.VI);
    expect(h.updates.find((u) => u.patch.status === CONVERSATION_STATUS.ENDED)).toBeTruthy();
    expect(h.audits[0]).toMatchObject({ action: 'chat.idle_closed', metadata: { reason: 'csat_timeout' } });
  });

  it('keeps the thread when the shopper wrote after the request (latch cleared, no close)', async () => {
    const prompted = { id: 7, tenantId: 4, sessionId: 9, status: CONVERSATION_STATUS.AI_ACTIVE, idlePromptAt: new Date(Date.now() - 4 * MIN) };
    const h = build({ due: [prompted], repliesAfterPrompt: 1 });
    const r = await h.svc.sweepPolicy(4, policy);

    expect(r.closed).toBe(0);
    expect(h.updates).toEqual([{ where: { id: 7 }, patch: { idlePromptAt: null } }]);
  });
});

describe('IdleConversationService.sweep — platform rule beside a policy tenant', () => {
  it('leaves a policy tenant\'s AI/agent threads to the policy pass and keeps its WAITING threads', async () => {
    const wheres: any[] = [];
    const convRepo = {
      find: jest.fn(async ({ where }: any) => (wheres.push(where), [])),
      update: jest.fn(),
    };
    const tenantRepo = { find: jest.fn(async () => [{ id: 4, chatClosePolicy: { csatAfterMin: 3, closeAfterMin: 3 } }]) };
    const svc = new IdleConversationService(
      convRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { write: jest.fn() } as never,
      tenantRepo as never,
    );
    const policyPass = jest.spyOn(svc, 'sweepPolicy').mockResolvedValue({ prompted: 0, closed: 0, silentlyClosed: 0 });
    await svc.sweep();

    expect(policyPass).toHaveBeenCalledWith(4, expect.objectContaining({ csatAfterMin: 3 }));
    // Platform rule: one alternative pins tenant 4 to WAITING only.
    const legacy = wheres[0] as any[];
    const forTenant4 = legacy.filter((w) => w.tenantId?._type === 'in');
    expect(forTenant4.length).toBeGreaterThan(0);
    expect(forTenant4.every((w) => w.status === CONVERSATION_STATUS.WAITING)).toBe(true);
    expect(legacy.some((w) => w.tenantId?._type === 'not')).toBe(true);
  });
});
