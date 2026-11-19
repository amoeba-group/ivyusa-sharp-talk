import { CONSENT_STATE, MODERATION_DECISION } from '@sharptalk/types';
import { AgentService } from './agent.service';
import { Conversation } from '../chat/entity/conversation.entity';
import { Message } from '../chat/entity/message.entity';
import { BusinessException } from '../../global/exception/business.exception';

/**
 * BUG-044: a staff reply has to land where the customer's chat is. The widget
 * shows only the newest conversation of a chat session, so a reply to an older
 * one is refused; a reply to an ended one reopens it; and the session replied
 * in becomes the customer's current one.
 */
describe('AgentService.sendMessage — where the customer sees it (BUG-044)', () => {
  function build(opts: { id: number; newest: number; status: string; blocked?: boolean; touchFails?: boolean }) {
    const conversation = { id: opts.id, tenantId: 1, sessionId: 5, status: opts.status } as Conversation;
    const saved: Message[] = [];
    const convRepo = {
      findOne: jest.fn(async (q: { where: Record<string, unknown> }) =>
        'sessionId' in q.where ? ({ id: opts.newest } as Conversation) : conversation,
      ),
      findOneOrFail: jest.fn(async () => conversation),
      update: jest.fn(async () => ({})),
    };
    const msgRepo = {
      findOne: jest.fn(async () => null),
      create: (m: Partial<Message>) => m,
      save: jest.fn(async (m: Message) => {
        saved.push(m);
        return { ...m, id: 900 + saved.length } as Message;
      }),
    };
    const sessionRepo = {
      findOne: jest.fn(async () => ({ id: 5, customerId: 42, language: 'EN' })),
      update: jest.fn(async () => {
        if (opts.touchFails) throw new Error('db down');
        return {};
      }),
    };
    const assignmentRepo = {
      find: jest.fn(async () => []),
      update: jest.fn(async () => ({})),
      create: (a: Record<string, unknown>) => a,
      save: jest.fn(async (a: Record<string, unknown>) => a),
    };
    const svc = new AgentService(
      convRepo as never,
      msgRepo as never,
      {} as never, // userRepo
      sessionRepo as never,
      { findOne: jest.fn(async () => null) } as never, // profileRepo — no capacity limit
      assignmentRepo as never,
      {} as never, // statRepo
      {
        moderate: jest.fn(async () => ({
          decision: opts.blocked ? MODERATION_DECISION.BLOCKED : MODERATION_DECISION.DELIVERED,
          text: 'Your order ships today.',
        })),
      } as never,
      {} as never, // customerService
      {} as never, // aiGateway
      { write: jest.fn(async () => undefined) } as never, // audit
      {} as never, // redis
      { effectiveConsentFor: jest.fn(async () => CONSENT_STATE.GRANTED) } as never,
      { publish: jest.fn() } as never,
      { send: jest.fn() } as never,
    );
    return { svc, saved, convRepo, sessionRepo, assignmentRepo };
  }

  it('refuses a reply to an older conversation of the session — the customer would never see it', async () => {
    const { svc, saved, sessionRepo } = build({ id: 10, newest: 16, status: 'ai_active' });
    const err = await svc.sendMessage(10, 9, 1, 'hi').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect((err as BusinessException).errorCode).toBe('E5165');
    expect((err as BusinessException).getStatus()).toBe(409);
    expect(saved).toHaveLength(0);
    expect(sessionRepo.update).not.toHaveBeenCalled();
  });

  it('replies in the newest open conversation and makes its session the current one', async () => {
    const { svc, saved, convRepo, sessionRepo, assignmentRepo } = build({ id: 16, newest: 16, status: 'agent' });
    await svc.sendMessage(16, 9, 1, 'Your order ships today.');
    expect(saved.map((m) => m.senderType)).toEqual(['agent']);
    expect(sessionRepo.update).toHaveBeenCalledWith({ id: 5 }, { updatedAt: expect.any(Function) });
    // Nothing reopened.
    expect(convRepo.update).not.toHaveBeenCalled();
    expect(assignmentRepo.save).not.toHaveBeenCalled();
  });

  it('a reply to the newest ENDED conversation reopens it for the replying staff member', async () => {
    const { svc, saved, convRepo, assignmentRepo } = build({ id: 16, newest: 16, status: 'ended' });
    await svc.sendMessage(16, 9, 1, 'Your order ships today.');
    // Accept's hand-over: an active assignment and status 'agent' with this agent.
    expect(assignmentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ agentId: 9, status: 'active', conversationId: 16 }));
    expect(convRepo.update).toHaveBeenCalledWith({ id: 16 }, { status: 'agent', agentId: 9 });
    // No longer ended: no end time, idle cycle restarted.
    expect(convRepo.update).toHaveBeenCalledWith({ id: 16 }, { endedAt: null, idlePromptAt: null });
    expect(saved).toHaveLength(1);
  });

  it('a blocked reply reopens nothing', async () => {
    const { svc, saved, convRepo, assignmentRepo } = build({ id: 16, newest: 16, status: 'ended', blocked: true });
    await expect(svc.sendMessage(16, 9, 1, 'bad words')).rejects.toBeInstanceOf(BusinessException);
    expect(convRepo.update).not.toHaveBeenCalled();
    expect(assignmentRepo.save).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });

  it('a failed session touch does not fail a reply that was already delivered', async () => {
    const { svc, saved } = build({ id: 16, newest: 16, status: 'agent', touchFails: true });
    await expect(svc.sendMessage(16, 9, 1, 'Your order ships today.')).resolves.toMatchObject({ id: 901 });
    expect(saved).toHaveLength(1);
  });
});
