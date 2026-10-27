import { ConversationHandlersService } from './conversation-handlers.service';

const t = (min: number) => new Date(Date.UTC(2026, 9, 27, 9, min));

/** Repos as TypeORM returns them: bigint ids come back as strings. */
function build(opts: { conv: object | null; rows?: object[]; alerts?: object[]; users?: object[] }) {
  const convRepo = { findOne: jest.fn().mockResolvedValue(opts.conv) };
  const assignmentRepo = { find: jest.fn().mockResolvedValue(opts.rows ?? []) };
  const alertRepo = { find: jest.fn().mockResolvedValue(opts.alerts ?? []) };
  const userRepo = { find: jest.fn().mockResolvedValue(opts.users ?? []) };
  const svc = new ConversationHandlersService(convRepo as never, assignmentRepo as never, alertRepo as never, userRepo as never);
  return { svc, convRepo, assignmentRepo };
}

const users = [
  { id: '7', name: null, email: 'minh@go2joy.vn' },
  { id: '8', name: 'Thao', email: 'thao@go2joy.vn' },
  { id: '9', name: 'An', email: 'an@go2joy.vn' },
];

describe('ConversationHandlersService.history', () => {
  it('orders start → request → assign → transfer → end and names agents', async () => {
    const { svc } = build({
      conv: { id: '77', agentId: '8', createdAt: t(0), endedAt: t(30) },
      alerts: [{ id: '1', reason: 'user_request', targetUserId: null, createdAt: t(3) }],
      rows: [
        { id: '1', agentId: '7', assignedBy: '7', type: 'manual', status: 'transferred', assignedAt: t(4), releasedAt: t(10) },
        { id: '2', agentId: '8', assignedBy: '9', type: 'manual', status: 'released', assignedAt: t(10), releasedAt: t(30) },
      ],
      users,
    });
    const { events, handlers } = await svc.history(77, 4);
    expect(events.map((e) => e.kind)).toEqual(['started', 'handoff_request', 'assigned', 'transferred', 'ended']);
    expect(events[1].reason).toBe('user_request');
    expect(events[2]).toMatchObject({ agentName: 'minh', byName: null });
    expect(events[3]).toMatchObject({ agentName: 'Thao', fromName: 'minh', byName: 'An' });
    expect(events[4]).toMatchObject({ kind: 'ended', agentName: 'Thao' });
    expect(handlers.map((h) => [h.name, h.current])).toEqual([
      ['minh', false],
      ['Thao', true],
    ]);
  });

  it('reads a release away from the end as a hand-back to the AI', async () => {
    const { svc } = build({
      conv: { id: '5', agentId: null, createdAt: t(0), endedAt: null },
      rows: [{ id: '1', agentId: '7', assignedBy: '7', type: 'manual', status: 'released', assignedAt: t(2), releasedAt: t(8) }],
      users,
    });
    const { events, handlers } = await svc.history(5, 4);
    expect(events.map((e) => e.kind)).toEqual(['started', 'assigned', 'returned_to_ai']);
    expect(handlers[0]).toMatchObject({ name: 'minh', current: false });
  });

  it('shows the end of an AI-only conversation and scopes the lookup to the tenant', async () => {
    const { svc, convRepo, assignmentRepo } = build({ conv: { id: '6', agentId: null, createdAt: t(0), endedAt: t(5) } });
    const { events, handlers } = await svc.history(6, 4);
    expect(events.map((e) => e.kind)).toEqual(['started', 'ended']);
    expect(handlers).toEqual([]);
    expect(convRepo.findOne.mock.calls[0][0].where).toEqual({ id: 6, tenantId: 4 });
    expect(assignmentRepo.find.mock.calls[0][0].where).toEqual({ tenantId: 4, conversationId: 6 });
  });

  it('404s a conversation of another tenant', async () => {
    const { svc } = build({ conv: null });
    await expect(svc.history(1, 4)).rejects.toMatchObject({ status: 404 });
  });
});
