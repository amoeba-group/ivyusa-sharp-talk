import { CHAT_CLOSE_DEFAULT_COPY, CONVERSATION_STATUS, SENDER_TYPE } from '@sharptalk/types';
import { ChatService } from './chat.service';
import { ChatMapper } from './chat.mapper';
import { Session } from '../session/entity/session.entity';

/**
 * PLN-261026 A3: a rating the close policy asked for is taken while the thread
 * is still open, and ends it right away with the thank-you line. The same
 * latch under the platform rule means "anything else?", which is not a rating.
 */
describe('ChatService — rating requested by the close policy', () => {
  const session = { id: 9, tenantId: 1, language: 'KO' } as Session;
  const policy = { csatAfterMin: 3, closeAfterMin: 3 };

  function build(conversation: Record<string, unknown>, tenantPolicy: unknown) {
    const updates: any[] = [];
    const saved: any[] = [];
    const convRepo = {
      findOne: jest.fn(async () => conversation),
      update: jest.fn(async (where: unknown, patch: unknown) => void updates.push({ where, patch })),
      createQueryBuilder: () => {
        const qb: any = {};
        for (const k of ['select', 'addSelect', 'where', 'andWhere']) qb[k] = () => qb;
        qb.getRawOne = async () => ({ avg: '5', rated: '1' });
        return qb;
      },
    };
    const msgRepo = {
      findOne: jest.fn(async () => null),
      create: (m: any) => m,
      save: jest.fn(async (m: any) => (saved.push(m), m)),
    };
    const assignmentRepo = { update: jest.fn(async () => undefined) };
    const tenantRepo = { findOne: jest.fn(async () => ({ id: 1, chatClosePolicy: tenantPolicy })) };
    const svc = new ChatService(...(Array.from({ length: 13 }, () => ({})) as never[])) as ChatService;
    Object.assign(svc as unknown as Record<string, unknown>, {
      convRepo,
      msgRepo,
      assignmentRepo,
      tenantRepo,
      statRepo: { findOne: async () => null, create: (r: any) => r, save: async (r: any) => r },
      logger: { log: jest.fn(), warn: jest.fn() },
    });
    return { svc, updates, saved, assignmentRepo };
  }

  const open = (over: Record<string, unknown> = {}) => ({
    id: 42,
    sessionId: 9,
    tenantId: 1,
    status: CONVERSATION_STATUS.AI_ACTIVE,
    idlePromptAt: new Date(Date.now() - 60_000),
    endedAt: null,
    csatRating: null,
    ...over,
  });

  it('rates an open, rating-requested thread, thanks the shopper and ends it', async () => {
    const h = build(open(), policy);
    await expect(h.svc.rate(session, 42, 5)).resolves.toEqual({ rating: 5 });

    expect(h.updates[0].patch.csatRating).toBe(5);
    expect(h.saved).toHaveLength(1);
    expect(h.saved[0]).toMatchObject({ senderType: SENDER_TYPE.SYSTEM, body: CHAT_CLOSE_DEFAULT_COPY.thanksNotice.KO });
    expect(h.updates.some((u) => u.patch.status === CONVERSATION_STATUS.ENDED)).toBe(true);
    expect(h.assignmentRepo.update).toHaveBeenCalledWith(
      { conversationId: 42, status: 'active' },
      expect.objectContaining({ status: 'released' }),
    );
  });

  it('uses the tenant thank-you line for that language', async () => {
    const h = build(open(), { ...policy, thanksNotice: { KO: '감사합니다! 다음에 또 만나요.' } });
    await h.svc.rate(session, 42, 4);
    // No moderation service in this double → the built-in line (fail safe).
    expect(h.saved[0].body).toBe(CHAT_CLOSE_DEFAULT_COPY.thanksNotice.KO);
  });

  it('sends the moderated tenant line when the gate delivers it, the built-in one when it blocks', async () => {
    const own = { ...policy, thanksNotice: { KO: '감사합니다! 다음에 또 만나요.' } };
    const ok = build(open(), own);
    Object.assign(ok.svc as any, { moderation: { moderate: async ({ text }: any) => ({ decision: 'delivered', text }) } });
    await ok.svc.rate(session, 42, 4);
    expect(ok.saved[0].body).toBe('감사합니다! 다음에 또 만나요.');

    const blocked = build(open(), own);
    Object.assign(blocked.svc as any, { moderation: { moderate: async () => ({ decision: 'blocked', text: '' }) } });
    await blocked.svc.rate(session, 42, 4);
    expect(blocked.saved[0].body).toBe(CHAT_CLOSE_DEFAULT_COPY.thanksNotice.KO);
  });

  it('refuses an open thread when the tenant has no policy — the latch means "anything else?" there', async () => {
    const h = build(open(), null);
    await expect(h.svc.rate(session, 42, 5)).rejects.toMatchObject({ status: 409 });
    expect(h.updates).toHaveLength(0);
  });

  it('refuses an open thread that was never asked', async () => {
    const h = build(open({ idlePromptAt: null }), policy);
    await expect(h.svc.rate(session, 42, 5)).rejects.toMatchObject({ status: 409 });
  });
});

describe('ChatMapper canRate', () => {
  const conv = (over: Record<string, unknown> = {}) =>
    ({ id: 1, status: 'ai_active', csatRating: null, endedAt: null, ...over }) as never;

  it('offers stars on an open thread only when the policy asked', () => {
    expect(ChatMapper.toConversationResponse(conv(), [], undefined, undefined, true).canRate).toBe(true);
    expect(ChatMapper.toConversationResponse(conv(), []).canRate).toBe(false);
  });

  it('never offers stars twice', () => {
    expect(ChatMapper.toConversationResponse(conv({ csatRating: 4 }), [], undefined, undefined, true).canRate).toBe(false);
  });
});
