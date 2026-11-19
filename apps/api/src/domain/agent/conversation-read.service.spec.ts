import { AgentService } from './agent.service';
import { ConversationReadService, unreadExistsSql } from './conversation-read.service';
import { toSessionResponse } from './agent.mapper';
import { Conversation } from '../chat/entity/conversation.entity';
import { Message } from '../chat/entity/message.entity';

/** Read / unread per staff member (PLN-261119 Live Chat unread). */
describe('ConversationReadService', () => {
  function build(rows: unknown[][] = []) {
    const query = jest.fn();
    for (const r of rows) query.mockResolvedValueOnce(r);
    query.mockResolvedValue([]);
    return { svc: new ConversationReadService({ query } as never), query };
  }

  it('counts only customer messages after the reader’s own marker', async () => {
    const { svc, query } = build([[{ cid: '11', n: '3' }]]);
    const counts = await svc.unreadCounts(7, [11, 12]);
    expect(counts.get('11')).toBe(3);
    // A conversation with nothing unread has no row: the caller reads it as 0.
    expect(counts.get('12')).toBeUndefined();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("m.sender_type = 'user'");
    expect(sql).toContain('r.user_id = ?');
    expect(sql).toContain('m.id > COALESCE(r.last_read_message_id, 0)');
    // The reader's marker, the page's conversations, the reader's join date — nobody else's.
    expect(params).toEqual([7, 11, 12, 7]);
    // No marker yet: only what arrived after the reader joined counts.
    expect(sql).toContain('r.id IS NOT NULL OR m.created_at > (SELECT u.created_at FROM users u WHERE u.id = ?)');
  });

  it('asks nothing for an empty page', async () => {
    const { svc, query } = build();
    expect((await svc.unreadCounts(7, [])).size).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('marks read through the tenant’s own conversations only', async () => {
    const { svc, query } = build();
    await svc.markRead(1, 7, [11, 11, 12]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE c.tenant_id = ? AND c.id IN (?,?)');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE');
    expect(params).toEqual([7, 1, 11, 12]);
  });

  it('mark all as read covers the whole tenant and no other', async () => {
    const { svc, query } = build();
    await svc.markRead(1, 7);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('WHERE c.tenant_id = ?');
    expect(sql).not.toContain('c.id IN');
    expect(params).toEqual([7, 1]);
  });

  it('an empty id list writes nothing — it must not fall through to "all"', async () => {
    const { svc, query } = build();
    await svc.markRead(1, 7, []);
    expect(query).not.toHaveBeenCalled();
  });

  it('mark as unread puts the marker just before the customer’s last message', async () => {
    const { svc, query } = build([[{ last: '40' }]]);
    expect(await svc.markUnread(1, 7, 11)).toBe(true);
    expect(query.mock.calls[0][1]).toEqual([1, 11]);
    expect(query.mock.calls[1][1]).toEqual([1, 11, 7, 39]);
  });

  it('a conversation the customer never wrote in cannot be unread', async () => {
    const { svc, query } = build([[{ last: null }]]);
    expect(await svc.markUnread(1, 7, 11)).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('a conversation of another tenant matches nothing', async () => {
    // The lookup joins conversations on tenant_id, so MAX() over no rows is NULL.
    const { svc, query } = build([[{ last: null }]]);
    expect(await svc.markUnread(2, 7, 11)).toBe(false);
    expect(query.mock.calls[0][0]).toContain('c.tenant_id = ?');
  });
});

describe('listSessions — unread scope', () => {
  function build() {
    const wheres: string[] = [];
    const params: Array<Record<string, unknown> | undefined> = [];
    const getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
    const qb: Record<string, unknown> = {
      where: jest.fn((_c: string, p?: Record<string, unknown>) => { params.push(p); return qb; }),
      andWhere: jest.fn((c: string, p?: Record<string, unknown>) => { wheres.push(c); params.push(p); return qb; }),
      orderBy: jest.fn(() => qb),
      addOrderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getManyAndCount,
    };
    const svc = new AgentService(
      { createQueryBuilder: jest.fn(() => qb) } as never,
      { createQueryBuilder: jest.fn(() => ({ select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) })) } as never,
      {} as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never, {} as never, {} as never, {} as never,
      { contactsByIds: jest.fn().mockResolvedValue(new Map()) } as never,
      {} as never, {} as never, {} as never, {} as never, {} as never,
    );
    return { svc, wheres, params, getManyAndCount };
  }

  it('filters on the reader’s unread and includes ended conversations', async () => {
    const { svc, wheres, params } = build();
    await svc.listSessions(1, 1, 20, undefined, 'unread', undefined, undefined, undefined, 7);
    expect(wheres).toContain(unreadExistsSql('c'));
    expect(params).toContainEqual({ readerId: 7 });
    const statuses = params.find((p) => p && 'statuses' in p) as { statuses: string[] };
    expect(statuses.statuses).toEqual(['ai_active', 'waiting', 'agent', 'ended']);
    // A merged room shows its newest UNREAD conversation, not just its newest.
    expect(wheres.find((w) => w.includes('merged_room_sessions'))).toContain(unreadExistsSql('c2'));
  });

  it('a reader without a marker only sees messages from after they joined', () => {
    expect(unreadExistsSql('c')).toContain('cr.id IS NOT NULL OR mu.created_at > (SELECT u.created_at FROM users u WHERE u.id = :readerId)');
  });

  it('without a reader there is nothing to list', async () => {
    const { svc, getManyAndCount } = build();
    expect(await svc.listSessions(1, 1, 20, undefined, 'unread')).toEqual({ items: [], total: 0 });
    expect(getManyAndCount).not.toHaveBeenCalled();
  });

  it('the other scopes never touch the read markers', async () => {
    const { svc, wheres } = build();
    await svc.listSessions(1, 1, 20, undefined, 'all', undefined, undefined, undefined, 7);
    expect(wheres.some((w) => w.includes('conversation_reads'))).toBe(false);
  });
});

describe('toSessionResponse — unread fields', () => {
  const c = { id: 5, sessionId: 9, status: 'ai_active', createdAt: new Date() } as unknown as Conversation;
  const msg = (senderType: string) => ({ body: 'hi', senderType, createdAt: new Date() }) as Message;

  it('defaults to read, with the last sender’s type', () => {
    const r = toSessionResponse(c, msg('user'));
    expect(r.unreadCount).toBe(0);
    expect(r.lastSenderType).toBe('user');
    expect(r.lastSenderName).toBeNull();
  });

  it('carries the count and the replying staff member’s name', () => {
    const r = toSessionResponse(
      c, msg('agent'), undefined, null, undefined, undefined, null, null, null, null, null,
      { unreadCount: 2, lastSenderName: 'Ivyusa Support' },
    );
    expect(r.unreadCount).toBe(2);
    expect(r.lastSenderName).toBe('Ivyusa Support');
  });

  it('a conversation with no message has no last sender', () => {
    expect(toSessionResponse(c, null).lastSenderType).toBeNull();
  });
});
