import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Like, Not, Repository } from 'typeorm';
import { CONVERSATION_STATUS } from '@sharptalk/types';
import { MergedRoom } from './entity/merged-room.entity';
import { MERGED_SESSION_STATE, MergedRoomSession } from './entity/merged-room-session.entity';
import { Session } from '../session/entity/session.entity';
import { Conversation } from '../chat/entity/conversation.entity';
import { Customer } from '../customer/entity/customer.entity';
import { Company } from '../company/entity/company.entity';
import { AuditLog } from '../audit/entity/audit-log.entity';
import { maskIp } from '../../global/util/pii-display.util';
import { unsignedIdentifyAllowed } from '../embed/unsigned-identify';
import { AuditService } from '../audit/audit.service';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

const OPEN_STATUSES: string[] = [
  CONVERSATION_STATUS.AI_ACTIVE,
  CONVERSATION_STATUS.WAITING,
  CONVERSATION_STATUS.AGENT,
];

/** How many same-customer sessions the merge dialog lists at most. */
const CANDIDATE_LIMIT = 50;

/** How a candidate session matched the conversation's customer (D1). */
export type MergeMatch = 'customer' | 'email' | 'claimed' | 'company';

export interface MergedSessionView {
  sessionId: number;
  /** Newest conversation of the session — what choosing it opens. */
  conversationId: number;
  channel: string;
  alias: string | null;
  lastAt: Date;
  /** The newest conversation is still going (AI, waiting or with an agent). */
  open: boolean;
  /** Joined by auto-join rather than by an operator. */
  auto: boolean;
}

/** A member row of the manage dialog (PLN-261027 Merge-Add D4·D6). */
export interface MergedSessionDetail extends MergedSessionView {
  /** Visitor address, masked; the full one is the audited reveal. */
  ip: string | null;
  /** Differs from the same person's first session's address — another place or device. */
  ipDiffers: boolean;
  /** Added by an operator although the same-person check did not match it. */
  forced: boolean;
  firstAt: Date;
}

/** A room the conversation can be added to (PLN-261027 Merge-Add D4②). */
export interface RoomOption {
  id: number;
  sessionCount: number;
  /** Newest conversation of the room — how the console names it. */
  latestConversationId: number | null;
  customerId: number | null;
  companyId: number | null;
}

/** Who a conversation's customer side is (PLN-261027 Merge-Add D7·D8). */
export interface ConversationPerson {
  customerId: number | null;
  name: string | null;
  role: string | null;
}

export interface MergedRoomView {
  id: number;
  customerId: number | null;
  companyId: number | null;
  autoJoin: boolean;
  sessions: MergedSessionView[];
}

export interface MergeCandidateView {
  sessionId: number;
  conversationId: number;
  channel: string;
  alias: string | null;
  lastAt: Date;
  open: boolean;
  matchedBy: MergeMatch;
  /** Only the unsigned host claim ties it to the customer (PLN-261023 D4). */
  unverified: boolean;
  /** The conversation the dialog was opened from. */
  current: boolean;
  /** Already in this conversation's room. */
  inRoom: boolean;
  /** Taken out of this room earlier (D6) — merging it again is an explicit choice. */
  excluded: boolean;
  /** Sits in ANOTHER customer's room — cannot be merged here. */
  otherRoom: boolean;
}

interface Identity {
  /** The customer a new room is keyed on: the session's, else its conversations' newest. */
  anchor: number | null;
  /** Rows on the session and its conversations — matched "by account". */
  own: number[];
  /** Customer rows that count as the same person: the anchor's + same-email rows (D1). */
  customerIds: number[];
  /**
   * B2B company of the session or its conversations — for a business the
   * hotel IS the customer, so its other staff's sessions match (F1).
   */
  companyIds: number[];
}

/**
 * Merged room over the same customer's sessions
 * (PLN-261023-LiveChat-Merge-Same-Customer-Sessions).
 *
 * Same person = a confirmed identity (D1): the same customer row on the
 * session or on one of its conversations (a claimed host sign-in is filed on
 * the conversation only — PLN-261023 S4), or another customer row with the
 * same email (blind index). For a business, the same B2B company (hotel) as
 * well — its other staff are the same customer (PLN-261023-LiveChat-Merge-
 * Company-Conversations F1). A guest has no identity and is never merged.
 *
 * The room only changes what the console SHOWS together; every send, status,
 * assignment and stat stays per conversation.
 */
@Injectable()
export class MergedRoomService {
  private readonly logger = new Logger(MergedRoomService.name);

  constructor(
    @InjectRepository(MergedRoom) private readonly roomRepo: Repository<MergedRoom>,
    @InjectRepository(MergedRoomSession) private readonly memberRepo: Repository<MergedRoomSession>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @Optional() private readonly audit?: AuditService,
    // Identify-attribute matching and the manage dialog (PLN-261027 Merge-Add) — optional, last.
    @Optional() @InjectRepository(Company) private readonly companyRepo?: Repository<Company>,
    @Optional() @InjectRepository(AuditLog) private readonly auditRepo?: Repository<AuditLog>,
  ) {}

  // ---- identity ----

  /** The customer rows and companies a session belongs to, or null for a guest. */
  private async identityOf(tenantId: number, sessionId: number): Promise<Identity | null> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, tenantId },
      select: { id: true, customerId: true, companyId: true, identityAttributes: true, identityLevel: true },
    });
    if (!session) return null;
    // What the host said about this visitor (PLN-261027 Merge-Add D3): a claimed
    // sign-in leaves the session row empty, so its user id / hotel id are the
    // only tie for a conversation that ended before the sign-in. An unsigned
    // claim counts only where the tenant still accepts unsigned identities —
    // the same gate that files claimed conversations (PLN-261023 S4).
    const trusted = session.identityLevel !== 'claimed' || unsignedIdentifyAllowed(tenantId);
    const fromHost = trusted
      ? await this.hostIdentity(tenantId, session.identityAttributes)
      : { customerId: null, companyId: null };
    const filed = await this.convRepo.find({
      where: [
        { tenantId, sessionId, customerId: Not(IsNull()) },
        { tenantId, sessionId, companyId: Not(IsNull()) },
      ],
      select: { id: true, customerId: true, companyId: true },
      order: { id: 'DESC' },
    });
    // Session first, then its conversations newest first — the anchor is the head.
    const own = [
      ...(session.customerId != null ? [Number(session.customerId)] : []),
      ...filed.filter((c) => c.customerId != null).map((c) => Number(c.customerId)),
      ...(fromHost.customerId != null ? [fromHost.customerId] : []),
    ];
    const companies = [
      ...(session.companyId != null ? [Number(session.companyId)] : []),
      ...filed.filter((c) => c.companyId != null).map((c) => Number(c.companyId)),
      ...(fromHost.companyId != null ? [fromHost.companyId] : []),
    ];
    if (!own.length && !companies.length) return null;
    const unique = [...new Set(own)];
    return {
      anchor: own[0] ?? null,
      own: unique,
      customerIds: unique.length ? await this.withSameEmail(tenantId, unique) : [],
      companyIds: [...new Set(companies)],
    };
  }

  /** The customer / company a session's identify attributes name, if they exist. */
  private async hostIdentity(
    tenantId: number,
    attrs: Record<string, string> | null | undefined,
  ): Promise<{ customerId: number | null; companyId: number | null }> {
    const userId = attrs?.user_id?.trim();
    const hotelId = attrs?.hotel_id?.trim();
    const [customer, company] = await Promise.all([
      userId
        ? this.customerRepo.findOne({ where: { tenantId, externalCustomerId: userId }, select: { id: true } })
        : null,
      hotelId && this.companyRepo
        ? this.companyRepo.findOne({ where: { tenantId, externalKey: `hotel:${hotelId}` }, select: { id: true } })
        : null,
    ]);
    return {
      customerId: customer ? Number(customer.id) : null,
      companyId: company ? Number(company.id) : null,
    };
  }

  /** Rooms keyed on any of the identity's customers or companies (OR), oldest first. */
  private async roomsFor(tenantId: number, identity: Identity, autoJoinOnly = false): Promise<MergedRoom[]> {
    const extra = autoJoinOnly ? { autoJoin: 1 } : {};
    const where = [
      ...(identity.customerIds.length ? [{ tenantId, customerId: In(identity.customerIds), ...extra }] : []),
      ...(identity.companyIds.length ? [{ tenantId, companyId: In(identity.companyIds), ...extra }] : []),
    ];
    if (!where.length) return [];
    return this.roomRepo.find({ where, order: { id: 'ASC' } });
  }

  /** The given customer rows plus every other row with the same email. */
  private async withSameEmail(tenantId: number, customerIds: number[]): Promise<number[]> {
    const rows = await this.customerRepo.find({
      where: { tenantId, id: In(customerIds) },
      select: { id: true, emailHash: true },
    });
    const hashes = [...new Set(rows.map((r) => r.emailHash).filter((h): h is string => !!h))];
    const same = hashes.length
      ? await this.customerRepo.find({ where: { tenantId, emailHash: In(hashes) }, select: { id: true } })
      : [];
    return [...new Set([...customerIds, ...same.map((c) => Number(c.id))])];
  }

  /**
   * Sessions of those customers, each with how it matched: on the session
   * itself (customer / email), or only through a claimed conversation.
   */
  private async sessionsOf(
    tenantId: number,
    identity: Identity,
    emailOnly: Set<number>,
  ): Promise<Map<number, MergeMatch>> {
    const out = new Map<number, MergeMatch>();
    if (identity.customerIds.length) await this.sessionsOfCustomers(tenantId, identity, emailOnly, out);
    await this.sessionsByHostAttributes(tenantId, identity, out);
    if (identity.companyIds.length) {
      const byCompany = await this.sessionRepo.find({
        where: { tenantId, companyId: In(identity.companyIds) },
        select: { id: true },
        order: { id: 'DESC' },
        take: CANDIDATE_LIMIT,
      });
      for (const s of byCompany) if (!out.has(Number(s.id))) out.set(Number(s.id), 'company');
      const filedUnder = await this.convRepo
        .createQueryBuilder('c')
        .select('DISTINCT c.session_id', 'sessionId')
        .where('c.tenant_id = :tenantId AND c.company_id IN (:...ids)', { tenantId, ids: identity.companyIds })
        .orderBy('c.session_id', 'DESC')
        .limit(CANDIDATE_LIMIT)
        .getRawMany<{ sessionId: string }>();
      for (const r of filedUnder) if (!out.has(Number(r.sessionId))) out.set(Number(r.sessionId), 'company');
    }
    return out;
  }

  /**
   * Sessions whose identify attributes name one of these customers (user id)
   * or companies (hotel id) — signed-in sessions whose conversations were never
   * filed, e.g. a conversation that ended before the sign-in (PLN-261027 D3).
   * Read on demand (merge dialog), so the JSON scan stays off the message path.
   */
  private async sessionsByHostAttributes(
    tenantId: number,
    identity: Identity,
    out: Map<number, MergeMatch>,
  ): Promise<void> {
    const [customers, companies] = await Promise.all([
      identity.customerIds.length
        ? this.customerRepo.find({
            where: { tenantId, id: In(identity.customerIds), externalCustomerId: Not(IsNull()) },
            select: { id: true, externalCustomerId: true },
          })
        : [],
      identity.companyIds.length && this.companyRepo
        ? this.companyRepo.find({
            where: { tenantId, id: In(identity.companyIds), externalKey: Like('hotel:%') },
            select: { id: true, externalKey: true },
          })
        : [],
    ]);
    const userIds = customers.map((c) => c.externalCustomerId as string);
    const hotelIds = companies.map((c) => c.externalKey.slice('hotel:'.length));
    const find = async (path: string, values: string[], how: MergeMatch) => {
      if (!values.length) return;
      const rows = await this.sessionRepo
        .createQueryBuilder('s')
        .select('s.id', 'id')
        .where('s.tenant_id = :tenantId', { tenantId })
        .andWhere(`JSON_UNQUOTE(JSON_EXTRACT(s.identity_attributes, '${path}')) IN (:...values)`, { values })
        .orderBy('s.id', 'DESC')
        .limit(CANDIDATE_LIMIT)
        .getRawMany<{ id: string }>();
      for (const r of rows) if (!out.has(Number(r.id))) out.set(Number(r.id), how);
    };
    await find('$.user_id', userIds, 'claimed');
    await find('$.hotel_id', hotelIds, 'company');
  }

  private async sessionsOfCustomers(
    tenantId: number,
    identity: Identity,
    emailOnly: Set<number>,
    out: Map<number, MergeMatch>,
  ): Promise<void> {
    const bySession = await this.sessionRepo.find({
      where: { tenantId, customerId: In(identity.customerIds) },
      select: { id: true, customerId: true },
      order: { id: 'DESC' },
      take: CANDIDATE_LIMIT,
    });
    for (const s of bySession) out.set(Number(s.id), emailOnly.has(Number(s.customerId)) ? 'email' : 'customer');
    const byConversation = await this.convRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.session_id', 'sessionId')
      .where('c.tenant_id = :tenantId AND c.customer_id IN (:...ids)', { tenantId, ids: identity.customerIds })
      .orderBy('c.session_id', 'DESC')
      .limit(CANDIDATE_LIMIT)
      .getRawMany<{ sessionId: string }>();
    for (const r of byConversation) {
      const sid = Number(r.sessionId);
      if (!out.has(sid)) out.set(sid, 'claimed');
    }
  }

  // ---- reads ----

  /** Does this session belong to the room's person or company (the merge check)? */
  private async sessionMatchesRoom(tenantId: number, sessionId: number, room: MergedRoom): Promise<boolean> {
    const identity = await this.identityOf(tenantId, sessionId);
    if (!identity) return false;
    if (room.customerId != null && identity.customerIds.includes(Number(room.customerId))) return true;
    if (room.companyId != null && identity.companyIds.includes(Number(room.companyId))) return true;
    return (await this.roomsFor(tenantId, identity)).some((r) => Number(r.id) === Number(room.id));
  }

  /**
   * Add one session to a room by one of its conversations (PLN-261027 Merge-Add
   * D4/D5) — the operator's way in for a session the same-person check missed.
   * A session the check does not match needs `force` (the operator confirmed);
   * it is recorded as forced in the audit trail. A session in another room is
   * refused with that room named — it has to be taken out there first.
   */
  async addSession(
    tenantId: number,
    userId: number,
    roomId: number,
    conversationId: number,
    force: boolean,
  ): Promise<MergedRoomView> {
    const room = await this.owned(roomId, tenantId);
    const conv = await this.convRepo.findOne({ where: { id: conversationId, tenantId }, select: { id: true, sessionId: true } });
    if (!conv) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const sessionId = Number(conv.sessionId);
    const place = await this.memberRepo.findOne({ where: { tenantId, sessionId } });
    if (place && Number(place.roomId) !== roomId && place.state === MERGED_SESSION_STATE.MEMBER) {
      const other = await this.latestConversations(tenantId, [sessionId]);
      this.logger.warn(`add-session refused: session=${sessionId} sits in room ${place.roomId}`);
      throw new BusinessException(ERROR_CODE.MERGE_SESSION_CONFLICT, HttpStatus.CONFLICT, {
        roomId: [String(place.roomId)],
        conversationId: [String(other.get(sessionId)?.id ?? conversationId)],
      });
    }
    if (place && Number(place.roomId) === roomId && place.state === MERGED_SESSION_STATE.MEMBER) {
      return (await this.view(tenantId, roomId))!;
    }
    const matches = await this.sessionMatchesRoom(tenantId, sessionId, room);
    if (!matches && !force) {
      this.logger.warn(`add-session needs confirmation: session=${sessionId} room=${roomId}`);
      throw new BusinessException(ERROR_CODE.MERGE_NEEDS_CONFIRM, HttpStatus.CONFLICT);
    }
    if (place) {
      // Taken out of this room earlier, or out of another room: it moves here.
      await this.memberRepo.update(
        { id: Number(place.id) },
        { roomId, state: MERGED_SESSION_STATE.MEMBER, addedBy: userId },
      );
    } else {
      await this.memberRepo.save(
        this.memberRepo.create({ tenantId, roomId, sessionId, state: MERGED_SESSION_STATE.MEMBER, addedBy: userId }),
      );
    }
    await this.audit?.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'merged_room.sessions_added',
      target: `merged_room:${roomId}`,
      metadata: { sessionIds: [sessionId], conversationId, manual: true, forced: !matches },
    });
    return (await this.view(tenantId, roomId))!;
  }

  /**
   * Rooms a conversation could join (PLN-261027 Merge-Add D4②): its person's
   * or company's rooms, or — with `targetConversationId` — the room that
   * conversation sits in (the operator typed its number).
   */
  async roomOptions(tenantId: number, conversationId: number, targetConversationId?: number): Promise<RoomOption[]> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId, tenantId }, select: { id: true, sessionId: true } });
    if (!conv) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    let rooms: MergedRoom[] = [];
    if (targetConversationId != null) {
      const target = await this.convRepo.findOne({
        where: { id: targetConversationId, tenantId },
        select: { id: true, sessionId: true },
      });
      const place = target
        ? await this.memberRepo.findOne({
            where: { tenantId, sessionId: Number(target.sessionId), state: MERGED_SESSION_STATE.MEMBER },
          })
        : null;
      const room = place ? await this.roomRepo.findOne({ where: { id: Number(place.roomId), tenantId } }) : null;
      rooms = room ? [room] : [];
    } else {
      const identity = await this.identityOf(tenantId, Number(conv.sessionId));
      rooms = identity ? await this.roomsFor(tenantId, identity) : [];
    }
    if (!rooms.length) return [];
    const members = await this.memberRepo.find({
      where: { tenantId, roomId: In(rooms.map((r) => Number(r.id))), state: MERGED_SESSION_STATE.MEMBER },
    });
    const latest = await this.latestConversations(tenantId, members.map((m) => Number(m.sessionId)));
    return rooms.map((r) => {
      const mine = members.filter((m) => Number(m.roomId) === Number(r.id));
      const ids = mine.map((m) => Number(latest.get(Number(m.sessionId))?.id ?? 0)).filter(Boolean);
      return {
        id: Number(r.id),
        sessionCount: mine.length,
        latestConversationId: ids.length ? Math.max(...ids) : null,
        customerId: r.customerId != null ? Number(r.customerId) : null,
        companyId: r.companyId != null ? Number(r.companyId) : null,
      };
    });
  }

  /**
   * The manage dialog's rows (PLN-261027 Merge-Add D4·D6): each member with its
   * masked address, whether the address differs from the room's first
   * session's, and whether an operator forced it in. Read when the dialog
   * opens — the forced flag comes from the audit trail.
   */
  async roomDetail(tenantId: number, roomId: number): Promise<{ room: MergedRoomView; sessions: MergedSessionDetail[] }> {
    await this.owned(roomId, tenantId);
    const view = (await this.view(tenantId, roomId))!;
    const ids = view.sessions.map((s) => s.sessionId);
    const [sessions, audits] = await Promise.all([
      ids.length
        ? this.sessionRepo.find({
            where: { tenantId, id: In(ids) },
            select: { id: true, firstIp: true, lastIp: true, createdAt: true },
          })
        : [],
      this.auditRepo
        ? this.auditRepo.find({
            where: { tenantId, target: `merged_room:${roomId}`, action: 'merged_room.sessions_added' },
            select: { id: true, metadata: true },
          })
        : [],
    ]);
    const forced = new Set<number>();
    for (const a of audits) {
      const md = (a.metadata ?? {}) as { forced?: boolean; sessionIds?: unknown[] };
      if (md.forced) for (const sid of md.sessionIds ?? []) forced.add(Number(sid));
    }
    const byId = new Map(sessions.map((s) => [Number(s.id), s]));
    const ipOf = (sid: number) => {
      const s = byId.get(sid);
      return s?.firstIp ?? s?.lastIp ?? null;
    };
    // "Another place" is per person: in a company room each staff member is
    // compared with their own first session — two staff on two networks is
    // normal, the same staff on a new network is the signal (Merge-Add D6).
    const people = await this.conversationPeople(
      tenantId,
      view.sessions.map((s) => ({ id: s.conversationId, sessionId: s.sessionId })),
    );
    const personOf = (s: MergedSessionView) => String(people.get(s.conversationId)?.customerId ?? 'room');
    const refIp = new Map<string, string>();
    for (const s of [...view.sessions].sort(
      (a, b) => (byId.get(a.sessionId)?.createdAt?.getTime() ?? 0) - (byId.get(b.sessionId)?.createdAt?.getTime() ?? 0),
    )) {
      const ip = ipOf(s.sessionId);
      if (ip && !refIp.has(personOf(s))) refIp.set(personOf(s), ip);
    }
    return {
      room: view,
      sessions: view.sessions.map((s) => {
        const ip = ipOf(s.sessionId);
        const ref = refIp.get(personOf(s)) ?? null;
        return {
          ...s,
          ip: maskIp(ip),
          ipDiffers: !!ip && !!ref && ip !== ref,
          forced: forced.has(s.sessionId),
          firstAt: byId.get(s.sessionId)?.createdAt ?? s.lastAt,
        };
      }),
    };
  }

  /**
   * The customer side of each conversation (PLN-261027 Merge-Add D7·D8): the
   * conversation's customer, else the session's, named by the customer row or
   * the host's identify; plus the host role. One pass for a room.
   */
  async conversationPeople(
    tenantId: number,
    convs: Array<{ id: number; sessionId: number }>,
  ): Promise<Map<number, ConversationPerson>> {
    const out = new Map<number, ConversationPerson>();
    if (!convs.length) return out;
    const [rows, sessions] = await Promise.all([
      this.convRepo.find({
        where: { tenantId, id: In(convs.map((c) => c.id)) },
        select: { id: true, sessionId: true, customerId: true },
      }),
      this.sessionRepo.find({
        where: { tenantId, id: In([...new Set(convs.map((c) => c.sessionId))]) },
        select: { id: true, customerId: true, identityAttributes: true },
      }),
    ]);
    const sessionById = new Map(sessions.map((s) => [Number(s.id), s]));
    const customerIdOf = (c: Conversation) =>
      c.customerId != null
        ? Number(c.customerId)
        : sessionById.get(Number(c.sessionId))?.customerId != null
          ? Number(sessionById.get(Number(c.sessionId))!.customerId)
          : null;
    const customerIds = [...new Set(rows.map(customerIdOf).filter((id): id is number => id != null))];
    const names = customerIds.length
      ? await this.customerRepo.find({ where: { tenantId, id: In(customerIds) }, select: { id: true, name: true } })
      : [];
    const nameOf = new Map(names.map((n) => [Number(n.id), n.name]));
    for (const c of rows) {
      const attrs = sessionById.get(Number(c.sessionId))?.identityAttributes ?? null;
      const customerId = customerIdOf(c);
      out.set(Number(c.id), {
        customerId,
        name: (customerId != null ? nameOf.get(customerId) : null) || attrs?.name || attrs?.user_id || null,
        role: attrs?.role ?? null,
      });
    }
    return out;
  }

  /** The room a session is a member of, or null. */
  async roomOfSession(tenantId: number, sessionId: number): Promise<MergedRoomView | null> {
    const row = await this.memberRepo.findOne({
      where: { tenantId, sessionId, state: MERGED_SESSION_STATE.MEMBER },
    });
    if (!row) return null;
    return this.view(tenantId, Number(row.roomId));
  }

  /**
   * Every conversation of the room the session is in — the merged transcript
   * and its "session N · channel · date" dividers. Null outside a room.
   */
  async roomConversations(
    tenantId: number,
    sessionId: number,
  ): Promise<Array<{ id: number; sessionId: number; channel: string; status: string; createdAt: Date }> | null> {
    const row = await this.memberRepo.findOne({
      where: { tenantId, sessionId, state: MERGED_SESSION_STATE.MEMBER },
    });
    if (!row) return null;
    const members = await this.memberRepo.find({
      where: { tenantId, roomId: Number(row.roomId), state: MERGED_SESSION_STATE.MEMBER },
    });
    const convs = await this.convRepo.find({
      where: { tenantId, sessionId: In(members.map((m) => Number(m.sessionId))) },
      select: { id: true, sessionId: true, channel: true, status: true, createdAt: true },
      order: { id: 'ASC' },
    });
    return convs.map((c) => ({
      id: Number(c.id),
      sessionId: Number(c.sessionId),
      channel: c.channel || 'widget',
      status: c.status,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Queue badges: room id, member count and how many member sessions have a
   * conversation still going, per session — one pass for a page of rows.
   */
  async badgesForSessions(
    tenantId: number,
    sessionIds: number[],
  ): Promise<Map<number, { roomId: number; sessionCount: number; openCount: number }>> {
    const out = new Map<number, { roomId: number; sessionCount: number; openCount: number }>();
    const ids = [...new Set(sessionIds.map(Number))];
    if (!ids.length) return out;
    const rows = await this.memberRepo.find({
      where: { tenantId, sessionId: In(ids), state: MERGED_SESSION_STATE.MEMBER },
    });
    if (!rows.length) return out;
    const roomIds = [...new Set(rows.map((r) => Number(r.roomId)))];
    const members = await this.memberRepo.find({
      where: { tenantId, roomId: In(roomIds), state: MERGED_SESSION_STATE.MEMBER },
    });
    const open = await this.convRepo.find({
      where: { tenantId, sessionId: In(members.map((m) => Number(m.sessionId))), status: In(OPEN_STATUSES) },
      select: { id: true, sessionId: true },
    });
    const openSessions = new Set(open.map((c) => Number(c.sessionId)));
    const perRoom = new Map<number, { sessionCount: number; openCount: number }>();
    for (const m of members) {
      const agg = perRoom.get(Number(m.roomId)) ?? { sessionCount: 0, openCount: 0 };
      agg.sessionCount += 1;
      if (openSessions.has(Number(m.sessionId))) agg.openCount += 1;
      perRoom.set(Number(m.roomId), agg);
    }
    for (const r of rows) {
      const agg = perRoom.get(Number(r.roomId));
      if (agg) out.set(Number(r.sessionId), { roomId: Number(r.roomId), ...agg });
    }
    return out;
  }

  private async view(tenantId: number, roomId: number): Promise<MergedRoomView | null> {
    const room = await this.roomRepo.findOne({ where: { id: roomId, tenantId } });
    if (!room) return null;
    const members = await this.memberRepo.find({
      where: { tenantId, roomId, state: MERGED_SESSION_STATE.MEMBER },
    });
    const latest = await this.latestConversations(
      tenantId,
      members.map((m) => Number(m.sessionId)),
    );
    const sessions = await this.sessionRepo.find({
      where: { tenantId, id: In(members.map((m) => Number(m.sessionId))) },
      select: { id: true, alias: true },
    });
    const alias = new Map(sessions.map((s) => [Number(s.id), s.alias ?? null]));
    const views: MergedSessionView[] = [];
    for (const m of members) {
      const c = latest.get(Number(m.sessionId));
      if (!c) continue;
      views.push({
        sessionId: Number(m.sessionId),
        conversationId: Number(c.id),
        channel: c.channel || 'widget',
        alias: alias.get(Number(m.sessionId)) ?? null,
        lastAt: c.createdAt,
        open: OPEN_STATUSES.includes(c.status),
        auto: m.addedBy == null,
      });
    }
    views.sort((a, b) => b.conversationId - a.conversationId);
    return {
      id: Number(room.id),
      customerId: room.customerId != null ? Number(room.customerId) : null,
      companyId: room.companyId != null ? Number(room.companyId) : null,
      autoJoin: room.autoJoin === 1,
      sessions: views,
    };
  }

  private async latestConversations(tenantId: number, sessionIds: number[]): Promise<Map<number, Conversation>> {
    const out = new Map<number, Conversation>();
    if (!sessionIds.length) return out;
    const convs = await this.convRepo.find({
      where: { tenantId, sessionId: In(sessionIds) },
      order: { id: 'DESC' },
    });
    for (const c of convs) if (!out.has(Number(c.sessionId))) out.set(Number(c.sessionId), c);
    return out;
  }

  /**
   * The merge dialog: every session of this conversation's customer (D1), the
   * current one included, with where each stands. Session metadata only — no
   * message of another session leaves here before the operator merges it.
   */
  async candidates(
    conversationId: number,
    tenantId: number,
  ): Promise<{ sessionId: number; room: MergedRoomView | null; sessions: MergeCandidateView[] }> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId, tenantId } });
    if (!conv) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const sessionId = Number(conv.sessionId);
    const room = await this.roomOfSession(tenantId, sessionId);
    const identity = await this.identityOf(tenantId, sessionId);
    if (!identity) return { sessionId, room, sessions: [] };

    // "Same email" = another customer ROW; the session's own rows match by account.
    const emailOnly = new Set(identity.customerIds.filter((id) => !identity.own.includes(id)));
    const matched = await this.sessionsOf(tenantId, identity, emailOnly);
    matched.set(sessionId, matched.get(sessionId) ?? 'customer');

    const ids = [...matched.keys()];
    const placed = await this.memberRepo.find({ where: { tenantId, sessionId: In(ids) } });
    const placeOf = new Map(placed.map((p) => [Number(p.sessionId), p]));
    const latest = await this.latestConversations(tenantId, ids);
    const sessions = await this.sessionRepo.find({
      where: { tenantId, id: In(ids) },
      select: { id: true, alias: true, customerId: true, companyId: true },
    });
    const sessionById = new Map(sessions.map((s) => [Number(s.id), s]));

    const out: MergeCandidateView[] = [];
    for (const [sid, how] of matched) {
      const c = latest.get(sid);
      // A session nobody ever wrote in has nothing to merge.
      if (!c) continue;
      const place = placeOf.get(sid);
      const inThisRoom = !!room && !!place && Number(place.roomId) === room.id;
      out.push({
        sessionId: sid,
        conversationId: Number(c.id),
        channel: c.channel || 'widget',
        alias: sessionById.get(sid)?.alias ?? null,
        lastAt: c.createdAt,
        open: OPEN_STATUSES.includes(c.status),
        matchedBy: how,
        // Only an unsigned host claim ties it in: no customer or company on the session itself.
        unverified:
          (how === 'claimed' || how === 'company') &&
          sessionById.get(sid)?.customerId == null &&
          sessionById.get(sid)?.companyId == null,
        current: sid === sessionId,
        inRoom: inThisRoom && place!.state === MERGED_SESSION_STATE.MEMBER,
        excluded: inThisRoom && place!.state === MERGED_SESSION_STATE.EXCLUDED,
        otherRoom: !!place && !inThisRoom,
      });
    }
    out.sort((a, b) => b.conversationId - a.conversationId);
    return { sessionId, room, sessions: out.slice(0, CANDIDATE_LIMIT) };
  }


  // ---- writes ----

  /**
   * Merge `sessionIds` with this conversation's session. Every session is
   * re-checked against the customer here — the dialog's list is not trusted.
   * Joins the customer's existing room when there is one (D5).
   */
  async merge(
    tenantId: number,
    userId: number,
    conversationId: number,
    sessionIds: number[],
    autoJoin: boolean,
  ): Promise<MergedRoomView> {
    const { sessionId, room: current, sessions } = await this.candidates(conversationId, tenantId);
    if (!sessions.length) {
      this.logger.warn(`merge refused: conversation=${conversationId} has no confirmed customer`);
      throw new BusinessException(ERROR_CODE.MERGE_NO_IDENTITY, HttpStatus.BAD_REQUEST);
    }
    const allowed = new Map(sessions.map((s) => [s.sessionId, s]));
    const wanted = [...new Set([sessionId, ...sessionIds.map(Number)])];
    const bad = wanted.filter((sid) => !allowed.has(sid) || allowed.get(sid)!.otherRoom);
    if (bad.length) {
      this.logger.warn(`merge refused: sessions ${bad.join(',')} are not this customer's or sit in another room`);
      throw new BusinessException(ERROR_CODE.MERGE_SESSION_CONFLICT, HttpStatus.CONFLICT);
    }
    const memberCount = wanted.length + (current ? current.sessions.filter((s) => !wanted.includes(s.sessionId)).length : 0);
    if (memberCount < 2) throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);

    const identity = (await this.identityOf(tenantId, sessionId))!;
    let room = current ? await this.roomRepo.findOne({ where: { id: current.id, tenantId } }) : null;
    room ??= (await this.roomsFor(tenantId, identity))[0] ?? null;
    const company = identity.companyIds[0] ?? null;
    const created = !room;
    let changed = created;
    if (!room) {
      room = await this.roomRepo.save(
        this.roomRepo.create({
          tenantId,
          customerId: identity.anchor,
          companyId: company,
          autoJoin: autoJoin ? 1 : 0,
          createdBy: userId,
        }),
      );
    } else {
      // A room merged for a person picks up their company when merged again from
      // a business thread (F3) — unless another room is already that company's.
      if (room.companyId == null && company != null) {
        const taken = await this.roomRepo.findOne({ where: { tenantId, companyId: company }, select: { id: true } });
        if (!taken) {
          room.companyId = company;
          changed = true;
        }
      }
      if (room.customerId == null && identity.anchor != null) {
        const taken = await this.roomRepo.findOne({ where: { tenantId, customerId: identity.anchor }, select: { id: true } });
        if (!taken) {
          room.customerId = identity.anchor;
          changed = true;
        }
      }
      if ((room.autoJoin === 1) !== autoJoin) {
        room.autoJoin = autoJoin ? 1 : 0;
        changed = true;
      }
      if (changed) room = await this.roomRepo.save(room);
    }
    const roomId = Number(room.id);

    const existing = await this.memberRepo.find({ where: { tenantId, sessionId: In(wanted) } });
    const have = new Map(existing.map((e) => [Number(e.sessionId), e]));
    for (const sid of wanted) {
      const row = have.get(sid);
      if (!row) {
        await this.memberRepo.save(
          this.memberRepo.create({ tenantId, roomId, sessionId: sid, state: MERGED_SESSION_STATE.MEMBER, addedBy: userId }),
        );
        changed = true;
      } else if (Number(row.roomId) === roomId && row.state !== MERGED_SESSION_STATE.MEMBER) {
        await this.memberRepo.update({ id: Number(row.id) }, { state: MERGED_SESSION_STATE.MEMBER, addedBy: userId });
        changed = true;
      }
    }
    // A repeated click that changes nothing leaves no audit row.
    if (changed) await this.audit?.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: created ? 'merged_room.created' : 'merged_room.sessions_added',
      target: `merged_room:${roomId}`,
      metadata: { sessionIds: wanted, autoJoin, conversationId },
    });
    return (await this.view(tenantId, roomId))!;
  }

  private async owned(id: number, tenantId: number): Promise<MergedRoom> {
    const room = await this.roomRepo.findOne({ where: { id, tenantId } });
    if (!room) {
      this.logger.warn(`merged room refused: id=${id} tenant=${tenantId}`);
      throw new BusinessException(ERROR_CODE.MERGED_ROOM_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return room;
  }

  async setAutoJoin(id: number, tenantId: number, userId: number, on: boolean): Promise<MergedRoomView> {
    const room = await this.owned(id, tenantId);
    await this.roomRepo.update({ id: Number(room.id) }, { autoJoin: on ? 1 : 0 });
    await this.audit?.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'merged_room.auto_join',
      target: `merged_room:${id}`,
      metadata: { autoJoin: on },
    });
    return (await this.view(tenantId, Number(room.id)))!;
  }

  /**
   * Take one session out (D6): remembered as excluded so auto-join never
   * brings it back. A room left with one session is no longer a merge — it
   * is dissolved and `null` returned.
   */
  async removeSession(id: number, tenantId: number, userId: number, sessionId: number): Promise<MergedRoomView | null> {
    const room = await this.owned(id, tenantId);
    const row = await this.memberRepo.findOne({
      where: { tenantId, roomId: Number(room.id), sessionId, state: MERGED_SESSION_STATE.MEMBER },
    });
    if (!row) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    const remaining = await this.memberRepo.count({
      where: { tenantId, roomId: Number(room.id), state: MERGED_SESSION_STATE.MEMBER },
    });
    if (remaining <= 2) {
      await this.dissolve(id, tenantId, userId, 'last_session_removed');
      return null;
    }
    await this.memberRepo.update({ id: Number(row.id) }, { state: MERGED_SESSION_STATE.EXCLUDED });
    await this.audit?.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'merged_room.session_removed',
      target: `merged_room:${id}`,
      metadata: { sessionId },
    });
    return this.view(tenantId, Number(room.id));
  }

  /** Dissolve: the room and its memberships go; every conversation stays. */
  async dissolve(id: number, tenantId: number, userId: number, reason = 'operator'): Promise<void> {
    const room = await this.owned(id, tenantId);
    await this.memberRepo.delete({ tenantId, roomId: Number(room.id) });
    await this.roomRepo.delete({ id: Number(room.id), tenantId });
    await this.audit?.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'merged_room.dissolved',
      target: `merged_room:${id}`,
      metadata: { customerId: room.customerId, companyId: room.companyId, reason },
    });
  }

  /**
   * Auto-join (D4): put this session into its customer's room when the room
   * has auto-join on and the session was never placed (an excluded session
   * stays out). Called on every widget message, so the common cases — no
   * room in the tenant, session already placed — cost one indexed lookup.
   * Never throws: a failure here must not cost the shopper their message.
   */
  async autoJoin(tenantId: number | null, sessionId: number): Promise<void> {
    if (tenantId == null) return;
    try {
      const anyRoom = await this.roomRepo.findOne({ where: { tenantId, autoJoin: 1 }, select: { id: true } });
      if (!anyRoom) return;
      const placed = await this.memberRepo.findOne({ where: { tenantId, sessionId }, select: { id: true } });
      if (placed) return;
      const identity = await this.identityOf(tenantId, sessionId);
      if (!identity) return;
      const room = (await this.roomsFor(tenantId, identity, true))[0];
      if (!room) return;
      await this.memberRepo.save(
        this.memberRepo.create({
          tenantId,
          roomId: Number(room.id),
          sessionId,
          state: MERGED_SESSION_STATE.MEMBER,
          addedBy: null,
        }),
      );
      await this.audit?.write({
        tenantId,
        actorType: 'system',
        actorId: 0,
        action: 'merged_room.auto_joined',
        target: `merged_room:${room.id}`,
        metadata: { sessionId },
      });
    } catch (err) {
      // A racing message of the same session hits the unique key — already joined.
      if ((err as { code?: string })?.code === 'ER_DUP_ENTRY') return;
      this.logger.warn(`merged room auto-join failed: session=${sessionId} — ${(err as Error).message}`);
    }
  }

  /**
   * DSAR erasure: a room keyed only on the erased person goes with them; a
   * company's room stays (a company is not a data subject) and just forgets
   * the person.
   */
  async eraseCustomer(tenantId: number, customerId: number): Promise<void> {
    const rooms = await this.roomRepo.find({ where: { tenantId, customerId } });
    const personal = rooms.filter((r) => r.companyId == null).map((r) => Number(r.id));
    const company = rooms.filter((r) => r.companyId != null).map((r) => Number(r.id));
    if (company.length) await this.roomRepo.update({ tenantId, id: In(company) }, { customerId: null });
    if (!personal.length) return;
    await this.memberRepo.delete({ tenantId, roomId: In(personal) });
    await this.roomRepo.delete({ tenantId, id: In(personal) });
  }
}

