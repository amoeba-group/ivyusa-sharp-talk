import { AgentService } from './agent.service';

/**
 * PLN-261027-LiveChat-Staff-Takeover-History D4/D6 — a staff member turns the
 * AI off without accepting, then hands the conversation back. The service is
 * built bare (its constructor has many collaborators); only what the two
 * methods touch is wired.
 */
function build(opts: { status?: string; mode?: string; lastPause?: Record<string, unknown> | null }) {
  const writes: Record<string, unknown>[] = [];
  const sessionUpdates: Record<string, unknown>[] = [];
  const saved: Record<string, unknown>[] = [];
  const svc = Object.create(AgentService.prototype) as AgentService;
  Object.assign(svc, {
    logger: { warn: jest.fn(), log: jest.fn() },
    convRepo: {
      findOne: jest.fn(async ({ where }: { where: { id: number; tenantId: number } }) =>
        where.tenantId === 4 ? { id: where.id, tenantId: 4, sessionId: 22, status: opts.status ?? 'ai_active' } : null,
      ),
    },
    sessionRepo: {
      findOne: jest.fn(async () => ({ id: 22, sessionToken: 'tok', autoReplyMode: opts.mode ?? 'inherit', language: 'VI' })),
      update: jest.fn(async (_w: unknown, patch: Record<string, unknown>) => void sessionUpdates.push(patch)),
    },
    redis: { del: jest.fn(async () => 1) },
    audit: { write: jest.fn(async (a: Record<string, unknown>) => void writes.push(a)) },
    auditRepo: { findOne: jest.fn(async () => opts.lastPause ?? null) },
    msgRepo: {
      create: jest.fn((v: Record<string, unknown>) => v),
      save: jest.fn(async (v: Record<string, unknown>) => void saved.push(v)),
    },
    aiConfigRepo: { findOne: jest.fn(async () => null) },
  });
  return { svc, writes, sessionUpdates, saved };
}

describe('AgentService — AI pause / hand-over without accepting (PLN-261027 Takeover)', () => {
  it('pause turns the session auto-reply off and records the mode it replaced; no assignment', async () => {
    const { svc, writes, sessionUpdates } = build({ mode: 'approve' });
    await expect(svc.aiPause(938, 4, 7)).resolves.toEqual({ autoReplyMode: 'off' });
    expect(sessionUpdates).toEqual([{ autoReplyMode: 'off' }]);
    expect(writes[0]).toMatchObject({
      action: 'agent.ai_paused',
      target: 'session:22',
      metadata: { conversationId: '938', previousMode: 'approve' },
    });
  });

  it('hand-over restores the replaced mode and sends the hand-back notice', async () => {
    const { svc, writes, sessionUpdates, saved } = build({
      mode: 'off',
      lastPause: { id: 10, metadata: { previousMode: 'approve' } },
    });
    await expect(svc.aiResume(938, 4, 7)).resolves.toEqual({ autoReplyMode: 'approve' });
    expect(sessionUpdates).toEqual([{ autoReplyMode: 'approve' }]);
    expect(saved[0]).toMatchObject({ conversationId: 938, senderType: 'system', lang: 'VI' });
    expect(writes[0]).toMatchObject({ action: 'agent.ai_resumed', metadata: { conversationId: '938', mode: 'approve' } });
  });

  it('hand-over goes to the channel default when the session was already off before', async () => {
    const { svc, sessionUpdates } = build({ mode: 'off', lastPause: { id: 10, metadata: { previousMode: 'off' } } });
    await svc.aiResume(938, 4, 7);
    expect(sessionUpdates).toEqual([{ autoReplyMode: 'inherit' }]);
  });

  it('refuses an accepted conversation (use hand back) and another tenant\'s conversation', async () => {
    const accepted = build({ status: 'agent' });
    await expect(accepted.svc.aiResume(938, 4, 7)).rejects.toMatchObject({ status: 409 });
    expect(accepted.saved).toHaveLength(0);
    const other = build({});
    await expect(other.svc.aiPause(938, 9, 7)).rejects.toMatchObject({ status: 404 });
  });
});
