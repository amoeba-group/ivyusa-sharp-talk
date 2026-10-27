import { CALLBACK_CHIP_ID, CONVERSATION_STATUS } from '@sharptalk/types';
import { ChatService } from './chat.service';

/**
 * PLN-261026 D4: off hours with callback requests on, the shopper hears the
 * off-hours notice at once, nobody is paged, the AI keeps the thread, and the
 * callback chip rides on the notice.
 */
describe('ChatService — off-hours callback', () => {
  function build(notice: string | null) {
    const saved: any[] = [];
    const convUpdates: any[] = [];
    const bus = { publish: jest.fn(async () => undefined) };
    const svc = new ChatService(...(Array.from({ length: 13 }, () => ({})) as never[])) as ChatService;
    Object.assign(svc as unknown as Record<string, unknown>, {
      convRepo: {
        findOne: jest.fn(async () => ({ id: 42, sessionId: 9, tenantId: 4, status: CONVERSATION_STATUS.AI_ACTIVE })),
        update: jest.fn(async (w: any, p: any) => void convUpdates.push({ w, p })),
      },
      msgRepo: { create: (m: any) => m, save: jest.fn(async (m: any) => (saved.push(m), m)), findOne: jest.fn(async () => null) },
      handoffRouter: {
        offHoursCallbackNotice: jest.fn(async () => notice),
        route: jest.fn(async () => ({ mode: 'agent', targetUserIds: [] })),
      },
      bus,
      logger: { log: jest.fn(), warn: jest.fn() },
    });
    return { svc, saved, convUpdates, bus };
  }

  const session = { id: 9, tenantId: 4, language: 'KO', channel: 'widget' } as never;

  it('handoff(): notice with the callback chip, not escalated, nobody paged, thread stays with the AI', async () => {
    const h = build('지금은 상담 시간이 아니에요.');
    const out = await h.svc.handoff(42, session, 4, 'user_request', 'help');

    expect(out).toEqual({ body: '지금은 상담 시간이 아니에요.', needsContactEmail: false, escalated: false });
    expect(h.saved[0].retrievalTrace.followUps[0].id).toBe(CALLBACK_CHIP_ID);
    expect(h.bus.publish).not.toHaveBeenCalled();
    expect(h.convUpdates.some((u) => u.p.status === CONVERSATION_STATUS.WAITING)).toBe(false);
  });

  it('escalate(): the widget button gets the same treatment', async () => {
    const h = build('지금은 상담 시간이 아니에요.');
    await h.svc.escalate(session, 42);
    expect(h.saved).toHaveLength(1);
    expect(h.bus.publish).not.toHaveBeenCalled();
  });

  it('on shift (or callbacks off) the normal escalation runs', async () => {
    const h = build(null);
    Object.assign(h.svc as any, {
      preferPreviousAgent: async (_t: number, _c: number, route: unknown) => route,
      routingContext: async () => ({}),
    });
    await h.svc.escalate(session, 42);
    expect(h.bus.publish).toHaveBeenCalled();
    expect(h.convUpdates.some((u) => u.p.status === CONVERSATION_STATUS.WAITING)).toBe(true);
  });
});
