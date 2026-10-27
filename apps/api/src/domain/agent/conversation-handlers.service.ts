import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Like, Not, Repository } from 'typeorm';
import { maskContact } from '@sharptalk/types';
import { Conversation } from '../chat/entity/conversation.entity';
import { User } from '../user/entity/user.entity';
import { Assignment } from './entity/assignment.entity';
import { AgentAlert } from './entity/agent-alert.entity';
import { CallbackRequest } from '../callback/entity/callback-request.entity';
import { MergedRoomSession } from '../merged-room/entity/merged-room-session.entity';
import { AuditLog } from '../audit/entity/audit-log.entity';
import { Session } from '../session/entity/session.entity';
import { maskIp } from '../../global/util/pii-display.util';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { staffLabel } from '../../global/util/staff-name.util';
import { Message } from '../chat/entity/message.entity';

export type HandlerEventKind =
  | 'started'
  | 'handoff_request'
  | 'assigned'
  | 'transferred'
  | 'returned_to_ai'
  | 'ended'
  | 'callback_requested'
  | 'callback_done'
  | 'callback_canceled'
  | 'feedback'
  | 'room_created'
  | 'room_sessions_added'
  | 'room_session_joined'
  | 'room_session_removed'
  | 'room_auto_join'
  | 'room_dissolved'
  | 'room_session_ip'
  | 'staff_replied'
  | 'handoff_acked'
  | 'ai_paused'
  | 'ai_resumed'
  | 'auto_reply_changed';

/** Kinds grouped for the history modal's filter (PLN-261027 Thread-Events D5). */
export const HANDLER_EVENT_GROUP: Record<HandlerEventKind, 'handling' | 'callback' | 'feedback' | 'room'> = {
  started: 'handling',
  handoff_request: 'handling',
  assigned: 'handling',
  transferred: 'handling',
  returned_to_ai: 'handling',
  ended: 'handling',
  callback_requested: 'callback',
  callback_done: 'callback',
  callback_canceled: 'callback',
  feedback: 'feedback',
  room_created: 'room',
  room_sessions_added: 'room',
  room_session_joined: 'room',
  room_session_removed: 'room',
  room_auto_join: 'room',
  room_dissolved: 'room',
  room_session_ip: 'room',
  staff_replied: 'handling',
  handoff_acked: 'handling',
  ai_paused: 'handling',
  ai_resumed: 'handling',
  auto_reply_changed: 'handling',
};

export interface HandlerEvent {
  at: Date;
  kind: HandlerEventKind;
  /** Which conversation it belongs to (null for room-level events). */
  conversationId: number | null;
  agentId: number | null;
  agentName: string | null;
  /** Previous holder on a transfer. */
  fromName: string | null;
  /** Who did it, when someone other than the agent (assigner, room editor). */
  byName: string | null;
  /** auto | manual | transfer — the assignment row's type. */
  assignType: string | null;
  /** Handoff reason, callback channel or feedback reason. */
  reason: string | null;
  /** Callback: request → done/canceled. */
  durationMs: number | null;
  /** Feedback: 1–5 stars and whether the customer said it was resolved. */
  rating: number | null;
  resolved: boolean | null;
  comment: string | null;
  /** Room events: the conversations (sessions) concerned; auto-join: on/off. */
  conversationIds: number[] | null;
  on: boolean | null;
  /** Staff a handoff request paged (PLN-261027 Takeover D2); `on` = it also went to everyone. */
  targetNames: string[] | null;
  /** Replies a staff member sent in the conversation (Takeover D1). */
  count: number | null;
}

export interface HandlerSummary {
  agentId: number;
  name: string | null;
  firstAt: Date;
  lastAt: Date;
  current: boolean;
}

/** A release this close to the conversation's end is the end, not a hand-back. */
const END_SLACK_MS = 5_000;

type ConvRow = Pick<Conversation, 'id' | 'sessionId' | 'agentId' | 'createdAt' | 'endedAt'> &
  Partial<Pick<Conversation, 'customerId'>> &
  Partial<Pick<Conversation, 'csatRating' | 'csatRatedAt' | 'csatResolved' | 'csatReason' | 'csatComment'>>;

const BLANK: Omit<HandlerEvent, 'at' | 'kind' | 'conversationId'> = {
  agentId: null,
  agentName: null,
  fromName: null,
  byName: null,
  assignType: null,
  reason: null,
  durationMs: null,
  rating: null,
  resolved: null,
  comment: null,
  conversationIds: null,
  on: null,
  targetNames: null,
  count: null,
};

/**
 * Who handled a conversation, in order (PLN-261027 S2 D5), plus callbacks,
 * the customer's feedback (Thread-Events D4) and — for a merged room — every
 * conversation of the room and the room's own history (D5/D6).
 *
 * Built from what is already written: assignment rows (assign, transfer,
 * release), handoff alerts, callback requests, the conversation's CSAT
 * columns, merged-room membership rows and `merged_room.*` audit rows. A
 * release is read as a hand-back to the AI unless it coincides with the end.
 */
@Injectable()
export class ConversationHandlersService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(AgentAlert) private readonly alertRepo: Repository<AgentAlert>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(CallbackRequest) private readonly callbackRepo: Repository<CallbackRequest>,
    @InjectRepository(MergedRoomSession) private readonly memberRepo: Repository<MergedRoomSession>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    // Visitor addresses of the room's sessions (PLN-261027 Merge-Add D6) — last, optional.
    @Optional() @InjectRepository(Session) private readonly sessionRepo?: Repository<Session>,
    // Staff replies without an assignment (PLN-261027 Takeover D1) — optional, last.
    @Optional() @InjectRepository(Message) private readonly msgRepo?: Repository<Message>,
  ) {}

  /** One conversation — the card (polled with the thread). */
  async history(
    conversationId: number,
    tenantId: number,
  ): Promise<{ events: HandlerEvent[]; handlers: HandlerSummary[] }> {
    const conv = await this.requireConv(conversationId, tenantId);
    return this.build(tenantId, [conv], conv.agentId);
  }

  /**
   * The whole merged room the conversation belongs to (or just it) — the
   * "full history" modal. Room events need the audit trail, so this is read
   * on demand only, never polled.
   */
  async roomHistory(
    conversationId: number,
    tenantId: number,
  ): Promise<{ events: HandlerEvent[]; handlers: HandlerSummary[]; roomId: number | null; conversationIds: number[] }> {
    const conv = await this.requireConv(conversationId, tenantId);
    const place = await this.memberRepo.findOne({
      where: { tenantId, sessionId: conv.sessionId, state: 'member' },
      select: { id: true, roomId: true },
    });
    if (!place) {
      const one = await this.build(tenantId, [conv], conv.agentId);
      return { ...one, roomId: null, conversationIds: [Number(conv.id)] };
    }
    const roomId = Number(place.roomId);
    const members = await this.memberRepo.find({ where: { tenantId, roomId }, order: { createdAt: 'ASC', id: 'ASC' } });
    const memberSessions = members.filter((m) => m.state === 'member').map((m) => Number(m.sessionId));
    const convs = (await this.convRepo.find({
      where: { tenantId, sessionId: In(memberSessions) },
      select: this.convSelect(),
      order: { id: 'ASC' },
    })) as ConvRow[];
    const base = await this.build(tenantId, convs, conv.agentId);

    // Session → its latest conversation, the id the console labels a session with.
    const convOfSession = new Map<number, number>();
    for (const c of convs) convOfSession.set(Number(c.sessionId), Number(c.id));
    const label = (sessionIds: unknown) =>
      (Array.isArray(sessionIds) ? sessionIds : [sessionIds])
        .map((s) => convOfSession.get(Number(s)))
        .filter((id): id is number => id != null);

    const audits = await this.auditRepo.find({
      where: { tenantId, target: `merged_room:${roomId}`, action: Like('merged_room.%') },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const actorIds = new Set<number>();
    for (const a of audits) if (a.actorType === 'user') actorIds.add(Number(a.actorId));
    for (const m of members) if (m.addedBy != null) actorIds.add(Number(m.addedBy));
    const names = await this.names([...actorIds]);
    const nameOf = (id: number | null | undefined) => (id == null ? null : (names.get(Number(id)) ?? null));

    const roomEvents: HandlerEvent[] = [];
    let createdSeen = false;
    for (const a of audits) {
      const md = (a.metadata ?? {}) as Record<string, unknown>;
      const by = a.actorType === 'user' ? nameOf(a.actorId) : null;
      const at = a.createdAt;
      switch (a.action) {
        case 'merged_room.created':
          createdSeen = true;
          roomEvents.push({ ...BLANK, at, kind: 'room_created', conversationId: null, byName: by, conversationIds: label(md.sessionIds) });
          if (typeof md.autoJoin === 'boolean' && md.autoJoin) {
            roomEvents.push({ ...BLANK, at, kind: 'room_auto_join', conversationId: null, byName: by, on: true });
          }
          break;
        case 'merged_room.sessions_added':
          roomEvents.push({
            ...BLANK,
            at,
            kind: 'room_sessions_added',
            conversationId: null,
            byName: by,
            conversationIds: label(md.sessionIds),
            // Operator's manual add (Merge-Add D4); forced = outside the same-person check.
            reason: md.manual ? (md.forced ? 'forced' : 'manual') : null,
          });
          break;
        case 'merged_room.auto_joined': {
          const ids = label(md.sessionId);
          roomEvents.push({ ...BLANK, at, kind: 'room_session_joined', conversationId: ids[0] ?? null, conversationIds: ids });
          break;
        }
        case 'merged_room.session_removed': {
          const ids = label(md.sessionId);
          roomEvents.push({ ...BLANK, at, kind: 'room_session_removed', conversationId: null, byName: by, conversationIds: ids });
          break;
        }
        case 'merged_room.auto_join':
          roomEvents.push({ ...BLANK, at, kind: 'room_auto_join', conversationId: null, byName: by, on: md.autoJoin === true });
          break;
        case 'merged_room.dissolved':
          roomEvents.push({ ...BLANK, at, kind: 'room_dissolved', conversationId: null, byName: by });
          break;
      }
    }
    // Rooms merged before auditing was in place still show when they began.
    if (!createdSeen && members.length) {
      const first = members[0];
      roomEvents.push({
        ...BLANK,
        at: first.createdAt,
        kind: 'room_created',
        conversationId: null,
        byName: nameOf(first.addedBy),
        conversationIds: label(members.filter((m) => m.createdAt.getTime() === first.createdAt.getTime()).map((m) => m.sessionId)),
      });
    }

    // A member session reached from another address than the same person's
    // first one (Merge-Add D6) — that staff member from another place or device.
    // Per person: two staff on two networks in a company room is not a signal.
    if (this.sessionRepo && memberSessions.length > 1) {
      const sessions = await this.sessionRepo.find({
        where: { tenantId, id: In(memberSessions) },
        select: { id: true, firstIp: true, lastIp: true, customerId: true, createdAt: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      const personOfSession = new Map<number, string>();
      for (const c of convs) {
        const who = c.customerId ?? null;
        if (who != null) personOfSession.set(Number(c.sessionId), String(who));
      }
      const ipOf = (s: Session) => s.firstIp ?? s.lastIp ?? null;
      const personOf = (s: Session) =>
        personOfSession.get(Number(s.id)) ?? (s.customerId != null ? String(s.customerId) : 'room');
      const refIp = new Map<string, string>();
      for (const s of sessions) {
        const ip = ipOf(s);
        if (!ip) continue;
        const ref = refIp.get(personOf(s));
        if (!ref) {
          refIp.set(personOf(s), ip);
          continue;
        }
        if (ip === ref) continue;
        const ids = label(s.id);
        roomEvents.push({ ...BLANK, at: s.createdAt, kind: 'room_session_ip', conversationId: ids[0] ?? null, conversationIds: ids, reason: maskIp(ip) });
      }
    }

    const events = [...base.events, ...roomEvents].sort((a, b) => a.at.getTime() - b.at.getTime());
    return { events, handlers: base.handlers, roomId, conversationIds: convs.map((c) => Number(c.id)) };
  }

  /**
   * Callbacks and feedback to show inside the thread (Thread-Events D2/D3), for
   * the conversations whose messages the transcript holds (a merged room: all).
   * Contacts are masked; the full one stays behind the audited contact route.
   */
  async threadEvents(
    tenantId: number,
    conversationIds: number[],
  ): Promise<{
    callbacks: Array<{
      id: string;
      conversationId: string;
      channel: string;
      contactMasked: string;
      status: string;
      handledByName: string | null;
      handledAt: Date | null;
      createdAt: Date;
    }>;
    feedback: Array<{
      conversationId: string;
      rating: number;
      resolved: boolean | null;
      reason: string | null;
      comment: string | null;
      ratedAt: Date;
    }>;
  }> {
    if (!conversationIds.length) return { callbacks: [], feedback: [] };
    const [callbacks, rated] = await Promise.all([
      this.callbackRepo.find({ where: { tenantId, conversationId: In(conversationIds) }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.convRepo.find({
        where: { tenantId, id: In(conversationIds), csatRating: Not(IsNull()) },
        select: { id: true, createdAt: true, endedAt: true, csatRating: true, csatRatedAt: true, csatResolved: true, csatReason: true, csatComment: true },
      }),
    ]);
    const names = await this.names(callbacks.filter((c) => c.handledBy != null).map((c) => Number(c.handledBy)));
    return {
      callbacks: callbacks.map((c) => ({
        id: String(c.id),
        conversationId: String(c.conversationId),
        channel: c.channel,
        contactMasked: maskContact(c.channel, c.contact ?? ''),
        status: c.status,
        handledByName: c.handledBy != null ? (names.get(Number(c.handledBy)) ?? null) : null,
        handledAt: c.handledAt,
        createdAt: c.createdAt,
      })),
      feedback: rated.map((c) => ({
        conversationId: String(c.id),
        rating: Number(c.csatRating),
        resolved: c.csatResolved == null ? null : Number(c.csatResolved) === 1,
        reason: c.csatReason ?? null,
        comment: c.csatComment ?? null,
        ratedAt: c.csatRatedAt ?? c.endedAt ?? c.createdAt,
      })),
    };
  }

  private convSelect() {
    return {
      id: true,
      sessionId: true,
      customerId: true,
      agentId: true,
      createdAt: true,
      endedAt: true,
      csatRating: true,
      csatRatedAt: true,
      csatResolved: true,
      csatReason: true,
      csatComment: true,
    } as const;
  }

  private async requireConv(conversationId: number, tenantId: number): Promise<ConvRow> {
    const conv = (await this.convRepo.findOne({
      where: { id: conversationId, tenantId },
      select: this.convSelect(),
    })) as ConvRow | null;
    if (!conv) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    return conv;
  }

  private async build(
    tenantId: number,
    convs: ConvRow[],
    currentAgentId: number | null,
  ): Promise<{ events: HandlerEvent[]; handlers: HandlerSummary[] }> {
    const ids = convs.map((c) => Number(c.id));
    if (!ids.length) return { events: [], handlers: [] };
    const [rows, alerts, callbacks] = await Promise.all([
      this.assignmentRepo.find({
        where: { tenantId, conversationId: In(ids) },
        order: { assignedAt: 'ASC', id: 'ASC' },
      }),
      this.alertRepo.find({
        where: { tenantId, conversationId: In(ids) },
        select: { id: true, conversationId: true, reason: true, targetUserId: true, ackedBy: true, ackedAt: true, createdAt: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
      this.callbackRepo.find({
        where: { tenantId, conversationId: In(ids) },
        select: { id: true, conversationId: true, channel: true, status: true, handledBy: true, handledAt: true, createdAt: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    ]);

    const [replies, autoReplyAudits] = await Promise.all([
      this.staffReplies(ids),
      this.autoReplyAudits(tenantId, convs),
    ]);

    const userIds = new Set<number>();
    for (const r of rows) {
      if (r.agentId != null) userIds.add(Number(r.agentId));
      if (r.assignedBy != null) userIds.add(Number(r.assignedBy));
    }
    for (const a of alerts) {
      if (a.targetUserId != null) userIds.add(Number(a.targetUserId));
      if (a.ackedBy != null) userIds.add(Number(a.ackedBy));
    }
    for (const r of replies) userIds.add(r.senderId);
    for (const a of autoReplyAudits) userIds.add(a.actorId);
    for (const c of callbacks) if (c.handledBy != null) userIds.add(Number(c.handledBy));
    const names = await this.names([...userIds]);
    const nameOf = (id: number | null) => (id == null ? null : (names.get(Number(id)) ?? null));

    const events: HandlerEvent[] = [];
    const handlersById = new Map<number, HandlerSummary>();
    for (const conv of convs) {
      const cid = Number(conv.id);
      const ev = (e: Omit<HandlerEvent, keyof typeof BLANK | 'conversationId'> & Partial<HandlerEvent>) =>
        events.push({ ...BLANK, conversationId: cid, ...e });
      ev({ at: conv.createdAt, kind: 'started' });
      // One request = the alerts written together (a broadcast row plus one per
      // paged staff member, same second, same reason) — Takeover D2.
      const requests = new Map<string, typeof alerts>();
      for (const a of alerts.filter((x) => Number(x.conversationId) === cid)) {
        const key = `${Math.floor(a.createdAt.getTime() / 1000)}|${a.reason}`;
        requests.set(key, [...(requests.get(key) ?? []), a]);
      }
      for (const group of requests.values()) {
        const targets = [...new Set(group.filter((a) => a.targetUserId != null).map((a) => Number(a.targetUserId)))];
        ev({
          at: group[0].createdAt,
          kind: 'handoff_request',
          reason: group[0].reason,
          targetNames: targets.map((id) => nameOf(id) ?? `#${id}`),
          on: group.some((a) => a.targetUserId == null),
        });
        const acked = new Map<number, Date>();
        for (const a of group) {
          if (a.ackedBy == null || !a.ackedAt) continue;
          const prev = acked.get(Number(a.ackedBy));
          if (!prev || a.ackedAt < prev) acked.set(Number(a.ackedBy), a.ackedAt);
        }
        for (const [by, at] of acked) ev({ at, kind: 'handoff_acked', agentId: by, agentName: nameOf(by) });
      }
      // Staff who answered — with or without accepting (Takeover D1).
      for (const r of replies.filter((x) => x.conversationId === cid)) {
        ev({ at: r.firstAt, kind: 'staff_replied', agentId: r.senderId, agentName: nameOf(r.senderId), count: r.count });
        const seen = handlersById.get(r.senderId);
        if (seen) {
          if (r.lastAt > seen.lastAt) seen.lastAt = r.lastAt;
          if (r.firstAt < seen.firstAt) seen.firstAt = r.firstAt;
        } else {
          handlersById.set(r.senderId, { agentId: r.senderId, name: nameOf(r.senderId), firstAt: r.firstAt, lastAt: r.lastAt, current: false });
        }
      }
      // Auto-reply switched off / handed back / changed by staff (Takeover D7).
      for (const a of autoReplyAudits.filter((x) => x.conversationId === cid)) {
        ev({
          at: a.at,
          kind: a.kind,
          agentId: a.actorId,
          agentName: nameOf(a.actorId),
          reason: a.mode,
        });
      }

      const mine = rows.filter((r) => Number(r.conversationId) === cid);
      const endedAt = conv.endedAt?.getTime() ?? null;
      let endShown = false;
      mine.forEach((r, i) => {
        const agentId = r.agentId != null ? Number(r.agentId) : null;
        const prev = i > 0 ? mine[i - 1] : null;
        // A transfer marks the previous holder `transferred` (manual assign, issue transfer).
        const transfer = !!prev && prev.status === 'transferred' && Number(prev.agentId) !== agentId;
        ev({
          at: r.assignedAt,
          kind: transfer ? 'transferred' : 'assigned',
          agentId,
          agentName: nameOf(agentId),
          fromName: transfer ? nameOf(prev!.agentId) : null,
          byName: r.assignedBy != null && Number(r.assignedBy) !== agentId ? nameOf(r.assignedBy) : null,
          assignType: r.type,
        });
        if (r.status === 'released' && r.releasedAt) {
          const atEnd = endedAt != null && Math.abs(r.releasedAt.getTime() - endedAt) <= END_SLACK_MS;
          if (atEnd) endShown = true;
          ev({ at: r.releasedAt, kind: atEnd ? 'ended' : 'returned_to_ai', agentId, agentName: nameOf(agentId) });
        }
        if (agentId != null) {
          const last = r.releasedAt ?? r.assignedAt;
          const seen = handlersById.get(agentId);
          if (seen) {
            if (last > seen.lastAt) seen.lastAt = last;
          } else {
            handlersById.set(agentId, { agentId, name: nameOf(agentId), firstAt: r.assignedAt, lastAt: last, current: false });
          }
        }
      });
      if (conv.endedAt && !endShown) ev({ at: conv.endedAt, kind: 'ended' });

      // Callbacks: the request, then its outcome with who and how long (Thread-Events D4).
      for (const c of callbacks.filter((x) => Number(x.conversationId) === cid)) {
        ev({ at: c.createdAt, kind: 'callback_requested', reason: c.channel });
        if ((c.status === 'done' || c.status === 'canceled') && c.handledAt) {
          ev({
            at: c.handledAt,
            kind: c.status === 'done' ? 'callback_done' : 'callback_canceled',
            reason: c.channel,
            agentId: c.handledBy != null ? Number(c.handledBy) : null,
            agentName: nameOf(c.handledBy),
            durationMs: c.handledAt.getTime() - c.createdAt.getTime(),
          });
        }
      }
      if (conv.csatRating != null) {
        ev({
          at: conv.csatRatedAt ?? conv.endedAt ?? conv.createdAt,
          kind: 'feedback',
          rating: Number(conv.csatRating),
          resolved: conv.csatResolved == null ? null : Number(conv.csatResolved) === 1,
          reason: conv.csatReason ?? null,
          comment: conv.csatComment ?? null,
        });
      }
    }
    // Stable: equal timestamps keep insertion order (request before assignment).
    events.sort((a, b) => a.at.getTime() - b.at.getTime());
    if (currentAgentId != null) {
      const current = handlersById.get(Number(currentAgentId));
      if (current) current.current = true;
    }
    return { events, handlers: [...handlersById.values()] };
  }

  /** First/last reply and count per conversation per staff member (Takeover D1). */
  private async staffReplies(
    conversationIds: number[],
  ): Promise<Array<{ conversationId: number; senderId: number; firstAt: Date; lastAt: Date; count: number }>> {
    if (!this.msgRepo || !conversationIds.length) return [];
    const rows = await this.msgRepo
      .createQueryBuilder('m')
      .select('m.conversation_id', 'cid')
      .addSelect('m.sender_id', 'sid')
      .addSelect('MIN(m.created_at)', 'first')
      .addSelect('MAX(m.created_at)', 'last')
      .addSelect('COUNT(*)', 'n')
      .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
      .andWhere("m.sender_type = 'agent'")
      .andWhere('m.sender_id IS NOT NULL')
      .groupBy('m.conversation_id')
      .addGroupBy('m.sender_id')
      .getRawMany<{ cid: string | number; sid: string | number; first: Date | string; last: Date | string; n: string | number }>();
    return rows.map((r) => ({
      conversationId: Number(r.cid),
      senderId: Number(r.sid),
      firstAt: new Date(r.first),
      lastAt: new Date(r.last),
      count: Number(r.n) || 0,
    }));
  }

  /** Staff auto-reply switches on these conversations' sessions (Takeover D7). */
  private async autoReplyAudits(
    tenantId: number,
    convs: ConvRow[],
  ): Promise<Array<{ conversationId: number; at: Date; kind: 'ai_paused' | 'ai_resumed' | 'auto_reply_changed'; actorId: number; mode: string | null }>> {
    if (!convs.length) return [];
    const targets = [...new Set(convs.map((c) => `session:${c.sessionId}`))];
    const rows = await this.auditRepo.find({
      where: {
        tenantId,
        action: In(['agent.ai_paused', 'agent.ai_resumed', 'agent.session.auto_reply']),
        target: In(targets),
      },
      select: { id: true, action: true, actorId: true, metadata: true, createdAt: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const ids = new Set(convs.map((c) => Number(c.id)));
    const out: Array<{ conversationId: number; at: Date; kind: 'ai_paused' | 'ai_resumed' | 'auto_reply_changed'; actorId: number; mode: string | null }> = [];
    for (const a of rows) {
      const md = (a.metadata ?? {}) as { conversationId?: string; mode?: string };
      const cid = Number(md.conversationId);
      if (!ids.has(cid)) continue;
      const kind = a.action === 'agent.ai_paused' ? 'ai_paused' : a.action === 'agent.ai_resumed' ? 'ai_resumed' : 'auto_reply_changed';
      out.push({ conversationId: cid, at: a.createdAt, kind, actorId: Number(a.actorId), mode: md.mode ?? null });
    }
    return out;
  }

  private async names(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const users = await this.userRepo.find({ where: { id: In(ids) }, select: { id: true, name: true, email: true } });
    const map = new Map<number, string>();
    for (const u of users) {
      const name = staffLabel(u);
      if (name) map.set(Number(u.id), name);
    }
    return map;
  }
}
