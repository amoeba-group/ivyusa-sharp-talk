import { ConversationHandlersService } from './conversation-handlers.service';

const t = (min: number) => new Date(Date.UTC(2026, 9, 27, 9, min));

/** Repos as TypeORM returns them: bigint ids come back as strings. */
function build(opts: {
  conv: object | null;
  rows?: object[];
  alerts?: object[];
  users?: object[];
  callbacks?: object[];
  place?: object | null;
  members?: object[];
  roomConvs?: object[];
  audits?: object[];
}) {
  const convRepo = {
    findOne: jest.fn().mockResolvedValue(opts.conv),
    find: jest.fn().mockResolvedValue(opts.roomConvs ?? []),
  };
  const assignmentRepo = { find: jest.fn().mockResolvedValue(opts.rows ?? []) };
  const alertRepo = { find: jest.fn().mockResolvedValue(opts.alerts ?? []) };
  const userRepo = { find: jest.fn().mockResolvedValue(opts.users ?? []) };
  const callbackRepo = { find: jest.fn().mockResolvedValue(opts.callbacks ?? []) };
  const memberRepo = {
    findOne: jest.fn().mockResolvedValue(opts.place ?? null),
    find: jest.fn().mockResolvedValue(opts.members ?? []),
  };
  const auditRepo = { find: jest.fn().mockResolvedValue(opts.audits ?? []) };
  const svc = new ConversationHandlersService(
    convRepo as never,
    assignmentRepo as never,
    alertRepo as never,
    userRepo as never,
    callbackRepo as never,
    memberRepo as never,
    auditRepo as never,
  );
  return { svc, convRepo, assignmentRepo, auditRepo };
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
      alerts: [{ id: '1', conversationId: '77', reason: 'user_request', targetUserId: null, createdAt: t(3) }],
      rows: [
        { id: '1', conversationId: '77', agentId: '7', assignedBy: '7', type: 'manual', status: 'transferred', assignedAt: t(4), releasedAt: t(10) },
        { id: '2', conversationId: '77', agentId: '8', assignedBy: '9', type: 'manual', status: 'released', assignedAt: t(10), releasedAt: t(30) },
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
      rows: [{ id: '1', conversationId: '5', agentId: '7', assignedBy: '7', type: 'manual', status: 'released', assignedAt: t(2), releasedAt: t(8) }],
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
    expect(assignmentRepo.find.mock.calls[0][0].where).toMatchObject({ tenantId: 4 });
  });

  it('404s a conversation of another tenant', async () => {
    const { svc } = build({ conv: null });
    await expect(svc.history(1, 4)).rejects.toMatchObject({ status: 404 });
  });
});

describe('ConversationHandlersService — callbacks, feedback, room (PLN-261027 Thread-Events)', () => {
  it('adds the callback request, its outcome with who and how long, and the feedback', async () => {
    const { svc } = build({
      conv: { id: '77', sessionId: '5', agentId: null, createdAt: t(0), endedAt: t(60), csatRating: 4, csatRatedAt: t(61), csatResolved: 1, csatReason: 'fast', csatComment: 'nice' },
      callbacks: [{ id: '1', conversationId: '77', channel: 'phone', status: 'done', handledBy: '8', handledAt: t(41), createdAt: t(20) }],
      users,
    });
    const { events } = await svc.history(77, 4);
    expect(events.map((e) => e.kind)).toEqual(['started', 'callback_requested', 'callback_done', 'ended', 'feedback']);
    const done = events.find((e) => e.kind === 'callback_done')!;
    expect(done).toMatchObject({ agentName: 'Thao', reason: 'phone', durationMs: 21 * 60_000 });
    expect(events.at(-1)).toMatchObject({ rating: 4, resolved: true, reason: 'fast', comment: 'nice' });
  });

  it('merges every conversation of the room and the room\'s own events, labelled by conversation', async () => {
    const { svc, auditRepo } = build({
      conv: { id: '90', sessionId: '12', agentId: null, createdAt: t(30), endedAt: null },
      place: { id: '1', roomId: '3' },
      members: [
        { sessionId: '11', state: 'member', addedBy: '9', createdAt: t(20) },
        { sessionId: '12', state: 'member', addedBy: null, createdAt: t(30) },
      ],
      roomConvs: [
        { id: '80', sessionId: '11', agentId: null, createdAt: t(0), endedAt: t(5) },
        { id: '90', sessionId: '12', agentId: null, createdAt: t(30), endedAt: null },
      ],
      audits: [
        { actorType: 'user', actorId: '9', action: 'merged_room.created', metadata: { sessionIds: [11], autoJoin: true }, createdAt: t(20) },
        { actorType: 'system', actorId: '0', action: 'merged_room.auto_joined', metadata: { sessionId: 12 }, createdAt: t(30) },
      ],
      users,
    });
    const out = await svc.roomHistory(90, 4);
    expect(out.roomId).toBe(3);
    expect(out.conversationIds).toEqual([80, 90]);
    expect(out.events.map((e) => [e.kind, e.conversationId])).toEqual([
      ['started', 80],
      ['ended', 80],
      ['room_created', null],
      ['room_auto_join', null],
      ['started', 90],
      ['room_session_joined', 90],
    ]);
    expect(out.events[2]).toMatchObject({ byName: 'An', conversationIds: [80] });
    expect(auditRepo.find.mock.calls[0][0].where).toMatchObject({ tenantId: 4, target: 'merged_room:3' });
  });

  it('falls back to the one conversation when it is not in a room', async () => {
    const { svc, auditRepo } = build({ conv: { id: '6', sessionId: '1', agentId: null, createdAt: t(0), endedAt: null } });
    const out = await svc.roomHistory(6, 4);
    expect(out).toMatchObject({ roomId: null, conversationIds: [6] });
    expect(auditRepo.find).not.toHaveBeenCalled();
  });
});

describe('ConversationHandlersService — another address per person (PLN-261027 Merge-Add D6)', () => {
  it('flags the same staff member on a new address, not two staff on two networks', async () => {
    const { svc } = build({
      conv: { id: '92', sessionId: '13', agentId: null, createdAt: t(40), endedAt: null },
      place: { id: '1', roomId: '3' },
      members: [
        { sessionId: '11', state: 'member', addedBy: '9', createdAt: t(20) },
        { sessionId: '12', state: 'member', addedBy: null, createdAt: t(30) },
        { sessionId: '13', state: 'member', addedBy: null, createdAt: t(40) },
      ],
      roomConvs: [
        { id: '80', sessionId: '11', customerId: '518', agentId: null, createdAt: t(0), endedAt: t(5) },
        { id: '90', sessionId: '12', customerId: '593', agentId: null, createdAt: t(30), endedAt: null },
        { id: '92', sessionId: '13', customerId: '518', agentId: null, createdAt: t(40), endedAt: null },
      ],
    });
    (svc as any).sessionRepo = {
      find: jest.fn(async () => [
        { id: '11', firstIp: '203.0.113.7', lastIp: null, customerId: null, createdAt: t(0) },
        { id: '12', firstIp: '198.51.100.9', lastIp: null, customerId: null, createdAt: t(30) },
        { id: '13', firstIp: '192.0.2.55', lastIp: null, customerId: null, createdAt: t(40) },
      ]),
    };
    const out = await svc.roomHistory(92, 4);
    const ipEvents = out.events.filter((e) => e.kind === 'room_session_ip');
    expect(ipEvents.map((e) => e.conversationId)).toEqual([92]);
    expect(ipEvents[0].reason).not.toBe('192.0.2.55');
  });
});
