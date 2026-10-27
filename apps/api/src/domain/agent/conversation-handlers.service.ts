import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Conversation } from '../chat/entity/conversation.entity';
import { User } from '../user/entity/user.entity';
import { Assignment } from './entity/assignment.entity';
import { AgentAlert } from './entity/agent-alert.entity';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { staffDisplayName } from '../../global/util/staff-name.util';

export type HandlerEventKind =
  | 'started'
  | 'handoff_request'
  | 'assigned'
  | 'transferred'
  | 'returned_to_ai'
  | 'ended';

export interface HandlerEvent {
  at: Date;
  kind: HandlerEventKind;
  agentId: number | null;
  agentName: string | null;
  /** Previous holder on a transfer. */
  fromName: string | null;
  /** Who made the assignment, when it was someone other than the agent. */
  byName: string | null;
  /** auto | manual | transfer — the assignment row's type. */
  assignType: string | null;
  /** Handoff request reason (low_confidence | moderation_blocked | user_request). */
  reason: string | null;
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

/**
 * Who handled one conversation, in order (PLN-261027 S2 D5).
 *
 * Built from what is already written — assignment rows (assign, transfer,
 * release), handoff alerts (the customer or the AI asking for a person) and
 * the conversation's own start/end — so the history exists for every past
 * conversation without a new table. A release is read as a hand-back to the
 * AI unless it coincides with the conversation's end.
 */
@Injectable()
export class ConversationHandlersService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Assignment) private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(AgentAlert) private readonly alertRepo: Repository<AgentAlert>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async history(
    conversationId: number,
    tenantId: number,
  ): Promise<{ events: HandlerEvent[]; handlers: HandlerSummary[] }> {
    const conv = await this.convRepo.findOne({
      where: { id: conversationId, tenantId },
      select: { id: true, agentId: true, createdAt: true, endedAt: true },
    });
    if (!conv) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);

    const [rows, alerts] = await Promise.all([
      this.assignmentRepo.find({ where: { tenantId, conversationId }, order: { assignedAt: 'ASC', id: 'ASC' } }),
      this.alertRepo.find({
        where: { tenantId, conversationId },
        select: { id: true, reason: true, targetUserId: true, createdAt: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    ]);

    const userIds = new Set<number>();
    for (const r of rows) {
      if (r.agentId != null) userIds.add(Number(r.agentId));
      if (r.assignedBy != null) userIds.add(Number(r.assignedBy));
    }
    for (const a of alerts) if (a.targetUserId != null) userIds.add(Number(a.targetUserId));
    const names = await this.names([...userIds]);
    const nameOf = (id: number | null) => (id == null ? null : (names.get(Number(id)) ?? null));

    const blank = { agentId: null, agentName: null, fromName: null, byName: null, assignType: null, reason: null };
    const events: HandlerEvent[] = [{ ...blank, at: conv.createdAt, kind: 'started' }];
    for (const a of alerts) {
      events.push({
        ...blank,
        at: a.createdAt,
        kind: 'handoff_request',
        reason: a.reason,
        agentId: a.targetUserId != null ? Number(a.targetUserId) : null,
        agentName: nameOf(a.targetUserId),
      });
    }

    const endedAt = conv.endedAt?.getTime() ?? null;
    let endShown = false;
    rows.forEach((r, i) => {
      const agentId = r.agentId != null ? Number(r.agentId) : null;
      const prev = i > 0 ? rows[i - 1] : null;
      // A transfer marks the previous holder `transferred` (manual assign, issue transfer).
      const transfer = !!prev && prev.status === 'transferred' && Number(prev.agentId) !== agentId;
      const by = r.assignedBy != null && Number(r.assignedBy) !== agentId ? nameOf(r.assignedBy) : null;
      events.push({
        ...blank,
        at: r.assignedAt,
        kind: transfer ? 'transferred' : 'assigned',
        agentId,
        agentName: nameOf(agentId),
        fromName: transfer ? nameOf(prev!.agentId) : null,
        byName: by,
        assignType: r.type,
      });
      if (r.status === 'released' && r.releasedAt) {
        const atEnd = endedAt != null && Math.abs(r.releasedAt.getTime() - endedAt) <= END_SLACK_MS;
        if (atEnd) endShown = true;
        events.push({
          ...blank,
          at: r.releasedAt,
          kind: atEnd ? 'ended' : 'returned_to_ai',
          agentId,
          agentName: nameOf(agentId),
        });
      }
    });
    if (conv.endedAt && !endShown) events.push({ ...blank, at: conv.endedAt, kind: 'ended' });
    // Stable: equal timestamps keep insertion order (request before assignment).
    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    const byAgent = new Map<number, HandlerSummary>();
    for (const r of rows) {
      if (r.agentId == null) continue;
      const id = Number(r.agentId);
      const last = r.releasedAt ?? r.assignedAt;
      const seen = byAgent.get(id);
      if (seen) {
        if (last > seen.lastAt) seen.lastAt = last;
      } else {
        byAgent.set(id, { agentId: id, name: nameOf(id), firstAt: r.assignedAt, lastAt: last, current: false });
      }
    }
    if (conv.agentId != null) {
      const current = byAgent.get(Number(conv.agentId));
      if (current) current.current = true;
    }
    return { events, handlers: [...byAgent.values()] };
  }

  private async names(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const users = await this.userRepo.find({ where: { id: In(ids) }, select: { id: true, name: true, email: true } });
    const map = new Map<number, string>();
    for (const u of users) {
      const name = staffDisplayName(u);
      if (name) map.set(Number(u.id), name);
    }
    return map;
  }
}
