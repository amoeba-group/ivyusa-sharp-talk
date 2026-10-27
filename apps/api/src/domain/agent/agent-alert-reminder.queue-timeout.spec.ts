import { CALLBACK_CHIP_ID, CHAT_CLOSE_DEFAULT_COPY, CONVERSATION_STATUS } from '@sharptalk/types';
import { AgentAlertReminderService } from './agent-alert-reminder.service';

const MIN = 60_000;

/** PLN-261026 B2/B3/D3: nobody accepted in time → tell the shopper, AI takes over, alarms expire. */
describe('AgentAlertReminderService.sweepQueueTimeout', () => {
  function build(opts: { alerts?: any[]; conversations?: any[]; claimed?: number } = {}) {
    const alertUpdates: any[] = [];
    const convUpdates: any[] = [];
    const saved: any[] = [];
    const audits: any[] = [];
    const alertRepo = {
      find: jest.fn(async () => opts.alerts ?? [{ id: 1, conversationId: 42 }]),
      update: jest.fn(async (where: any, patch: any) => void alertUpdates.push({ where, patch })),
    };
    const convRepo = {
      find: jest.fn(async () => opts.conversations ?? [{ id: 42, tenantId: 4, sessionId: 9, status: CONVERSATION_STATUS.WAITING }]),
      update: jest.fn(async (where: any, patch: any) => (convUpdates.push({ where, patch }), { affected: opts.claimed ?? 1 })),
    };
    const msgRepo = { create: (m: any) => m, save: jest.fn(async (m: any) => (saved.push(m), m)) };
    const sessionRepo = { findOne: jest.fn(async () => ({ id: 9, language: 'KO' })) };
    const audit = { write: jest.fn(async (a: any) => void audits.push(a)) };
    const svc = new AgentAlertReminderService(
      alertRepo as never,
      {} as never,
      convRepo as never,
      {} as never,
      msgRepo as never,
      sessionRepo as never,
      undefined,
      audit as never,
    );
    return { svc, alertRepo, convRepo, alertUpdates, convUpdates, saved, audits };
  }

  it('hands the thread back to the AI, expires its alarms and tells the shopper — with the callback chip when on', async () => {
    const h = build();
    const n = await h.svc.sweepQueueTimeout(4, { queueTimeout: { afterMinutes: 3 }, callback: { enabled: true, channels: ['email'] } });

    expect(n).toBe(1);
    expect(h.convUpdates[0]).toEqual({
      where: expect.objectContaining({ id: 42, status: CONVERSATION_STATUS.WAITING }),
      patch: { status: CONVERSATION_STATUS.AI_ACTIVE },
    });
    expect(h.alertUpdates[0]).toEqual({ where: { tenantId: 4, conversationId: 42, status: 'new' }, patch: { status: 'expired' } });
    expect(h.saved[0].body).toBe(CHAT_CLOSE_DEFAULT_COPY.queueDelay.KO);
    expect(h.saved[0].retrievalTrace.followUps).toEqual([{ id: CALLBACK_CHIP_ID, label: CHAT_CLOSE_DEFAULT_COPY.callbackChip.KO }]);
    expect(h.audits[0].action).toBe('chat.queue_timeout');
  });

  it('offers no chip when callbacks are off', async () => {
    const h = build();
    await h.svc.sweepQueueTimeout(4, { queueTimeout: { afterMinutes: 3 } });
    expect(h.saved[0].retrievalTrace.followUps).toBeUndefined();
  });

  it('only looks at alarms older than the timeout, and only unassigned, waiting, non-email threads', async () => {
    const now = new Date('2026-10-27T10:00:00Z');
    const h = build();
    await h.svc.sweepQueueTimeout(4, { queueTimeout: { afterMinutes: 3 } }, now);
    const alertWhere = (h.alertRepo.find.mock.calls[0] as any)[0].where;
    expect(alertWhere.createdAt._value).toEqual(new Date(now.getTime() - 3 * MIN));
    const convWhere = (h.convRepo.find.mock.calls[0] as any)[0].where;
    expect(convWhere.status).toBe(CONVERSATION_STATUS.WAITING);
    expect(convWhere.agentId._type).toBe('isNull');
    expect(convWhere.replyChannel._type).toBe('isNull');
  });

  it('does nothing when another tick already claimed the thread', async () => {
    const h = build({ claimed: 0 });
    expect(await h.svc.sweepQueueTimeout(4, { queueTimeout: { afterMinutes: 3 } })).toBe(0);
    expect(h.saved).toHaveLength(0);
    expect(h.alertUpdates).toHaveLength(0);
  });

  it('is inert without a timeout', async () => {
    const h = build();
    expect(await h.svc.sweepQueueTimeout(4, {})).toBe(0);
    expect(h.alertRepo.find).not.toHaveBeenCalled();
  });
});
