import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  CALLBACK_CHANNEL,
  CALLBACK_SOURCE,
  CALLBACK_STATUS,
  CHAT_CLOSE_DEFAULT_COPY,
  CONSENT_STATE,
  SENDER_TYPE,
  chatCopy,
  maskContact,
  normalizePhone,
} from '@sharptalk/types';
import { CallbackRequest } from './entity/callback-request.entity';
import { CallbackMapper } from './callback.mapper';
import { CallbackCreatedResponse, CallbackOptionsResponse, CallbackRequestResponse } from './dto/response/callback.response';
import { Conversation } from '../chat/entity/conversation.entity';
import { Message } from '../chat/entity/message.entity';
import { Session } from '../session/entity/session.entity';
import { Customer } from '../customer/entity/customer.entity';
import { AgentAlert } from '../agent/entity/agent-alert.entity';
import { User } from '../user/entity/user.entity';
import { AiConfigService } from '../ai-engine/ai-config.service';
import { SessionService } from '../session/session.service';
import { ErasureSuppressionService } from '../privacy/erasure-suppression.service';
import { AuditService } from '../audit/audit.service';
import { EventBusService, EVENTS } from '../../infrastructure/infrastructure.module';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const REASON = 'callback_request';

type Contact = { channel: string; contact: string };

/**
 * Callback requests (PLN-261026 B4–B6, D5–D7).
 *
 * The widget offers the callback chip after the queue-timeout or off-hours
 * notice. A verified member may use the contact on their profile (read here,
 * server side — the widget only ever sees it masked) or type another; either
 * way a copy is stored on the request and the profile is left as it is.
 * Collecting a contact is processing personal data, so it is consent-gated
 * like the off-hours email card.
 */
@Injectable()
export class CallbackService {
  private readonly logger = new Logger(CallbackService.name);

  constructor(
    @InjectRepository(CallbackRequest) private readonly repo: Repository<CallbackRequest>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Customer) private readonly customerRepo: Repository<Customer>,
    @InjectRepository(AgentAlert) private readonly alertRepo: Repository<AgentAlert>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly aiConfig: AiConfigService,
    private readonly sessions: SessionService,
    private readonly suppression: ErasureSuppressionService,
    private readonly audit: AuditService,
    private readonly bus: EventBusService,
  ) {}

  /** Is the feature on, which kinds, and the member's contacts — masked (B6). */
  async options(session: Session): Promise<CallbackOptionsResponse> {
    const channels = await this.channels(session.tenantId);
    if (!channels.length) return { enabled: false, channels: [], member: [] };
    const member = (await this.memberContacts(session)).filter((c) => channels.includes(c.channel));
    return {
      enabled: true,
      channels,
      member: member.map((c) => ({ channel: c.channel, masked: maskContact(c.channel, c.contact) })),
    };
  }

  async create(
    session: Session,
    input: { conversationId: number; source: string; channel?: string; contact?: string },
  ): Promise<CallbackCreatedResponse> {
    const conversation = await this.convRepo.findOne({ where: { id: input.conversationId } });
    if (!conversation || Number(conversation.sessionId) !== Number(session.id)) {
      throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const tenantId = Number(conversation.tenantId ?? session.tenantId);
    const channels = await this.channels(tenantId);
    if (!channels.length) {
      this.logger.warn(`callback refused: disabled (tenant ${tenantId})`);
      throw new BusinessException(ERROR_CODE.CALLBACK_DISABLED, HttpStatus.FORBIDDEN);
    }
    const consent = await this.sessions.effectiveConsentFor(Number(session.id), tenantId);
    if (consent !== CONSENT_STATE.GRANTED) {
      throw new BusinessException(ERROR_CODE.CONSENT_REQUIRED, HttpStatus.FORBIDDEN);
    }

    const picked =
      input.source === CALLBACK_SOURCE.MEMBER
        ? this.pickMember(await this.memberContacts(session), channels, input.channel)
        : await this.entered(tenantId, channels, input.channel, input.contact);

    // One open request per conversation: asking again replaces the contact.
    const open = await this.repo.findOne({
      where: { tenantId, conversationId: conversation.id, status: CALLBACK_STATUS.REQUESTED },
    });
    const row = await this.repo.save(
      Object.assign(open ?? this.repo.create({ tenantId, conversationId: conversation.id }), {
        sessionId: Number(session.id),
        customerId: session.customerId ?? conversation.customerId ?? null,
        channel: picked.channel,
        contactSource: input.source,
        contact: picked.contact,
        language: session.language ?? null,
        status: CALLBACK_STATUS.REQUESTED,
        handledBy: null,
        handledAt: null,
      }),
    );

    const masked = maskContact(picked.channel, picked.contact);
    const body = chatCopy(null, CHAT_CLOSE_DEFAULT_COPY.callbackSaved, session.language).replace('{contact}', masked);
    await this.msgRepo.save(
      this.msgRepo.create({
        tenantId,
        conversationId: conversation.id,
        senderType: SENDER_TYPE.SYSTEM,
        body,
        lang: session.language,
        retrievalTrace: { callbackRequestId: String(row.id) },
      }),
    );
    await this.page(tenantId, conversation, picked.channel, masked);
    await this.audit
      .write({
        tenantId,
        actorType: 'system',
        actorId: 0,
        action: 'callback.requested',
        target: `conversation:${conversation.id}`,
        // Never the contact itself — only what kind and where it came from.
        metadata: { callbackId: String(row.id), channel: picked.channel, source: input.source, replaced: !!open },
      })
      .catch((e: Error) => this.logger.warn(`callback audit failed: ${e.message}`));
    this.logger.log(`callback ${row.id} requested (conversation ${conversation.id}, ${picked.channel}/${input.source})`);
    return { id: String(row.id), channel: picked.channel, contactMasked: masked, body };
  }

  async list(
    tenantId: number,
    filter: { status?: string; conversationId?: number },
    page: number,
    size: number,
  ): Promise<{ items: CallbackRequestResponse[]; total: number }> {
    const where = {
      tenantId,
      ...(filter.status && filter.status !== 'all' ? { status: filter.status } : {}),
      ...(filter.conversationId ? { conversationId: filter.conversationId } : {}),
    };
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { items: await this.toResponses(tenantId, rows), total };
  }

  /** The plain contact, for the agent about to call (audited, D6). */
  async reveal(tenantId: number, id: number, userId: number): Promise<{ contact: string; channel: string }> {
    const row = await this.find(tenantId, id);
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'callback.contact_revealed',
      target: `callback:${row.id}`,
      metadata: { conversationId: String(row.conversationId), channel: row.channel },
    });
    return { contact: row.contact, channel: row.channel };
  }

  async updateStatus(tenantId: number, id: number, userId: number, status: string): Promise<CallbackRequestResponse> {
    const row = await this.find(tenantId, id);
    const reopened = status === CALLBACK_STATUS.REQUESTED;
    row.status = status;
    row.handledBy = reopened ? null : userId;
    row.handledAt = reopened ? null : new Date();
    const saved = await this.repo.save(row);
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'callback.status_changed',
      target: `callback:${row.id}`,
      metadata: { status },
    });
    return (await this.toResponses(tenantId, [saved]))[0];
  }

  private async find(tenantId: number, id: number): Promise<CallbackRequest> {
    const row = await this.repo.findOne({ where: { id, tenantId } });
    if (!row) {
      this.logger.warn(`callback ${id} not found for tenant ${tenantId}`);
      throw new BusinessException(ERROR_CODE.CALLBACK_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return row;
  }

  /** Enabled contact kinds, [] = callbacks off. */
  private async channels(tenantId: number | null): Promise<string[]> {
    const cb = (await this.aiConfig.getHandoffConfig(tenantId))?.callback;
    if (!cb?.enabled) return [];
    return (cb.channels ?? []).filter((c) => c === CALLBACK_CHANNEL.EMAIL || c === CALLBACK_CHANNEL.PHONE);
  }

  /**
   * The member profile's contacts — a host-verified session only. A claimed
   * (unsigned) identity is a fact the host asserted without proof, so calling
   * the number on its profile could reach someone else.
   */
  private async memberContacts(session: Session): Promise<Contact[]> {
    if (session.identityLevel !== 'verified' || session.customerId == null || session.tenantId == null) return [];
    const customer = await this.customerRepo.findOne({
      where: { id: session.customerId, tenantId: session.tenantId },
      select: { id: true, email: true, phone: true },
    });
    const out: Contact[] = [];
    if (customer?.email?.trim()) out.push({ channel: CALLBACK_CHANNEL.EMAIL, contact: customer.email.trim() });
    if (customer?.phone?.trim()) out.push({ channel: CALLBACK_CHANNEL.PHONE, contact: customer.phone.trim() });
    return out;
  }

  private pickMember(member: Contact[], channels: string[], wanted?: string): Contact {
    const usable = member.filter((c) => channels.includes(c.channel) && (!wanted || c.channel === wanted));
    if (!usable.length) {
      throw new BusinessException(ERROR_CODE.CALLBACK_MEMBER_CONTACT_MISSING, HttpStatus.BAD_REQUEST);
    }
    return usable[0];
  }

  private async entered(tenantId: number, channels: string[], channel?: string, raw?: string): Promise<Contact> {
    if (!channel || !channels.includes(channel)) {
      throw new BusinessException(ERROR_CODE.CALLBACK_DISABLED, HttpStatus.FORBIDDEN);
    }
    if (channel === CALLBACK_CHANNEL.PHONE) {
      const phone = normalizePhone(raw ?? '');
      if (!phone) throw new BusinessException(ERROR_CODE.CALLBACK_CONTACT_INVALID, HttpStatus.BAD_REQUEST);
      return { channel, contact: phone };
    }
    const email = String(raw ?? '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw new BusinessException(ERROR_CODE.CALLBACK_CONTACT_INVALID, HttpStatus.BAD_REQUEST);
    }
    // An address whose owner asked to be erased is not stored again.
    if (await this.suppression.isSuppressed(tenantId, { email })) {
      throw new BusinessException(ERROR_CODE.IDENTITY_ERASED, HttpStatus.CONFLICT);
    }
    return { channel, contact: email };
  }

  /**
   * Alarm + mail to whoever was paged for this conversation and the managers
   * (`reAlert.escalateToUserIds`), through the usual alarm path (D7). Nobody
   * known = broadcast.
   */
  private async page(tenantId: number, conversation: Conversation, channel: string, masked: string): Promise<void> {
    const managers = (await this.aiConfig.getHandoffConfig(tenantId))?.reAlert?.escalateToUserIds ?? [];
    const earlier = await this.alertRepo.find({
      where: { tenantId, conversationId: conversation.id, reason: Not(REASON) },
      select: { id: true, targetUserId: true },
      order: { id: 'DESC' },
      take: 50,
    });
    const targets = [
      ...new Set(
        [...earlier.map((a) => a.targetUserId), ...managers, conversation.agentId]
          .filter((v): v is number => v != null && Number.isFinite(Number(v)))
          .map(Number),
      ),
    ];
    await this.bus.publish(EVENTS.ESCALATION, {
      tenantId,
      conversationId: Number(conversation.id),
      sessionId: Number(conversation.sessionId),
      reason: REASON,
      preview: `${channel === CALLBACK_CHANNEL.PHONE ? '☎' : '✉'} ${masked}`,
      targetUserIds: targets,
    });
  }

  private async toResponses(tenantId: number, rows: CallbackRequest[]): Promise<CallbackRequestResponse[]> {
    const handlerIds = [...new Set(rows.map((r) => r.handledBy).filter((v): v is number => v != null))];
    const sessionIds = [...new Set(rows.map((r) => r.sessionId).filter((v): v is number => v != null))];
    const [users, sessions] = await Promise.all([
      handlerIds.length
        ? this.userRepo.find({ where: { id: In(handlerIds), tenantId }, select: { id: true, name: true, email: true } })
        : Promise.resolve([] as User[]),
      sessionIds.length
        ? this.sessionRepo.find({ where: { id: In(sessionIds) }, select: { id: true, identityAttributes: true } })
        : Promise.resolve([] as Session[]),
    ]);
    const names = new Map(users.map((u) => [String(u.id), u.name?.trim() || u.email]));
    const hotels = new Map(
      sessions.map((s) => {
        const a = (s.identityAttributes ?? null) as Record<string, string> | null;
        return [String(s.id), a?.hotel_name || a?.hotel_id || null] as const;
      }),
    );
    return rows.map((r) => CallbackMapper.toResponse(r, names, hotels));
  }
}
