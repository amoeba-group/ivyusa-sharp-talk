import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { buildPagination, normalizePage } from '@sharptalk/common';
import { CONSENT_STATE, inquiryProblems, normalizeInquiry } from '@sharptalk/types';
import type { InquiryCreatedResponse, InquiryInput } from '@sharptalk/types';
import { Inquiry } from './entity/inquiry.entity';
import { INQUIRY_STATUS, InquiryStatus } from './dto/request/inquiry.request';
import { Session } from '../session/entity/session.entity';
import { Conversation } from '../chat/entity/conversation.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { SessionService } from '../session/session.service';
import { CustomerService } from '../customer/customer.service';
import { ErasureSuppressionService } from '../privacy/erasure-suppression.service';
import { AuditService } from '../audit/audit.service';
import { InquiryMapper } from './inquiry.mapper';
import { Paginated } from '../../global/interceptor/transform.interceptor';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { MailerService, RedisService } from '../../infrastructure/infrastructure.module';

/** Contact forms one session may send per hour (T11 D3) — the IP throttle is the second fence. */
export const INQUIRY_HOURLY_LIMIT = 5;
const LIMIT_WINDOW_SEC = 3600;
export const inquiryLimitKey = (sessionId: number) => `inquiry:rl:${sessionId}`;

export interface CreateInquiryInput extends InquiryInput {
  conversationId?: string | null;
  orderId?: string | null;
}

/**
 * Customer support inquiries (FR-044, ivy-docs T11).
 *
 * The widget's contact form files one: who wrote, which address to answer,
 * what they asked. The team learns of it by mail to the tenant's support
 * address — Reply-To the shopper, so answering is one click — and works it in
 * the console's alarm center. Collecting an address is processing personal
 * data, so it is consent-gated like the off-hours email card.
 */
@Injectable()
export class InquiryService {
  private readonly logger = new Logger(InquiryService.name);
  /** One warning per process, not one per inquiry, when mail cannot go out. */
  private static smtpWarned = false;

  constructor(
    @InjectRepository(Inquiry) private readonly inquiryRepo: Repository<Inquiry>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    private readonly sessions: SessionService,
    private readonly customers: CustomerService,
    private readonly suppression: ErasureSuppressionService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    @Optional() private readonly mailer?: MailerService,
  ) {}

  /** The contact form (T11 D3). */
  async create(sessionToken: string, input: CreateInquiryInput): Promise<InquiryCreatedResponse> {
    const session = await this.loadSession(sessionToken);
    const tenantId = session.tenantId;
    if (tenantId == null) {
      this.logger.warn(`inquiry refused: session ${session.id} has no tenant`);
      throw new BusinessException(ERROR_CODE.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const consent = await this.sessions.effectiveConsentFor(Number(session.id), tenantId);
    if (consent !== CONSENT_STATE.GRANTED) {
      this.logger.warn(`inquiry refused: consent ${consent} (session ${session.id})`);
      throw new BusinessException(ERROR_CODE.CONSENT_REQUIRED, HttpStatus.FORBIDDEN);
    }
    const problems = inquiryProblems(input);
    if (Object.keys(problems).length) {
      // Which fields, never their content.
      this.logger.warn(`inquiry refused: ${JSON.stringify(problems)} (session ${session.id})`);
      throw new BusinessException(ERROR_CODE.INQUIRY_INVALID, HttpStatus.BAD_REQUEST);
    }
    const form = normalizeInquiry(input);

    const key = inquiryLimitKey(Number(session.id));
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.set(key, '1', LIMIT_WINDOW_SEC);
    if (count > INQUIRY_HOURLY_LIMIT) {
      this.logger.warn(`inquiry refused: ${count} this hour (session ${session.id})`);
      throw new BusinessException(ERROR_CODE.INQUIRY_LIMIT, HttpStatus.TOO_MANY_REQUESTS);
    }

    // An address whose owner asked to be erased is not stored again.
    if (await this.suppression.isSuppressed(tenantId, { email: form.email })) {
      this.logger.warn(`inquiry refused: address erased (session ${session.id})`);
      throw new BusinessException(ERROR_CODE.IDENTITY_ERASED, HttpStatus.CONFLICT);
    }
    // A guest gets a lead customer from the address, so the inquiry is erasable
    // with the person (D3). Email only: a typed name must not overwrite the
    // name an existing customer row already carries.
    const customerId =
      session.customerId ?? (await this.customers.createFromLead(tenantId, { email: form.email })).id;
    const conversationId = await this.ownConversationId(session, input.conversationId);

    const row = await this.inquiryRepo.save(
      this.inquiryRepo.create({
        // Stamped from the session (SEC-L6): a public endpoint has no tenant context.
        tenantId,
        customerId,
        conversationId,
        orderId: input.orderId != null && /^\d+$/.test(input.orderId) ? Number(input.orderId) : null,
        contactName: form.name,
        contactEmail: form.email,
        message: form.message,
        language: session.language ?? null,
        status: INQUIRY_STATUS.OPEN,
      }),
    );
    await this.audit
      .write({
        tenantId,
        actorType: 'system',
        actorId: 0,
        action: 'inquiry.created',
        target: `inquiry:${row.id}`,
        // Never the contact or the message — only where it came from.
        metadata: { conversationId: conversationId != null ? String(conversationId) : null, guest: session.customerId == null },
      })
      .catch((e: Error) => this.logger.warn(`inquiry audit failed: ${e.message}`));
    this.logger.log(`inquiry ${row.id} created (tenant ${tenantId}, session ${session.id})`);
    // The shopper's confirmation never waits on an SMTP round trip.
    void this.notifyTeam(tenantId, row).catch((e: Error) => this.logger.warn(`inquiry ${row.id} mail failed: ${e.message}`));
    return { id: String(row.id), status: row.status };
  }

  /** List the session customer's inquiries (paginated). */
  async listForSession(sessionToken: string, page?: string, size?: string) {
    const session = await this.loadSession(sessionToken);
    const { page: p, size: s } = normalizePage(page, size);
    const [items, total] = await this.inquiryRepo.findAndCount({
      where: { customerId: session.customerId ?? IsNull() },
      order: { createdAt: 'DESC' },
      skip: (p - 1) * s,
      take: s,
    });
    return new Paginated(InquiryMapper.toViewList(items), buildPagination(p, s, total));
  }

  /** Admin: the tenant's inquiries, newest first (address masked, message shortened). */
  async listAll(tenantId: number, status?: string, page?: string, size?: string) {
    const { page: p, size: s } = normalizePage(page, size);
    const [items, total] = await this.inquiryRepo.findAndCount({
      where: { tenantId, ...(status && status !== 'all' ? { status } : {}) },
      order: { id: 'DESC' },
      skip: (p - 1) * s,
      take: s,
    });
    return new Paginated(InquiryMapper.toAdminViewList(items), buildPagination(p, s, total));
  }

  /** Admin: one inquiry in full — the address and the whole message (audited, D4). */
  async detail(tenantId: number, id: number, userId: number) {
    const inquiry = await this.find(tenantId, id);
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'inquiry.viewed',
      target: `inquiry:${inquiry.id}`,
    });
    return InquiryMapper.toAdminDetail(inquiry);
  }

  /** Admin: mark an inquiry answered, or open again (tenant-scoped). */
  async setStatus(tenantId: number, id: number, userId: number, status: InquiryStatus = INQUIRY_STATUS.ANSWERED) {
    const inquiry = await this.find(tenantId, id);
    inquiry.status = status;
    await this.inquiryRepo.save(inquiry);
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'inquiry.status_changed',
      target: `inquiry:${inquiry.id}`,
      metadata: { status },
    });
    return InquiryMapper.toAdminView(inquiry);
  }

  /**
   * Mail the tenant's support address (T11 §8-4a). Reply-To is the shopper, so
   * the team answers from their own mailbox. No support address or no SMTP:
   * the console's Inquiries tab is the only place it shows.
   */
  private async notifyTeam(tenantId: number, row: Inquiry): Promise<void> {
    const tenant = await this.tenantRepo.findOne({
      where: { id: tenantId },
      select: { id: true, name: true, widgetCopy: true },
    });
    const to = tenant?.widgetCopy?.supportEmail?.trim();
    if (!to || !this.mailer) return;
    if (!this.mailer.configured()) {
      if (!InquiryService.smtpWarned) {
        InquiryService.smtpWarned = true;
        this.logger.warn('inquiry mail skipped: SMTP_HOST is not set — inquiries show only in the console');
      }
      return;
    }
    const shop = tenant?.widgetCopy?.displayName?.trim() || tenant?.name || 'Shop';
    const sent = await this.mailer.send({
      to,
      replyTo: row.contactEmail ?? undefined,
      subject: `[${shop}] New inquiry from ${row.contactName ?? 'a customer'}`,
      text: [
        'A customer sent this from the chat widget.',
        '',
        `Name: ${row.contactName ?? ''}`,
        `Email: ${row.contactEmail ?? ''}`,
        `Language: ${row.language ?? ''}`,
        `Received: ${new Date(row.createdAt ?? Date.now()).toISOString()}`,
        '',
        'Message:',
        row.message ?? '',
        '',
        '—',
        'Reply to this email to answer the customer: it goes to their address.',
        `Then mark it answered in the console: Live chat → Alerts → Inquiries (#${row.id}).`,
      ].join('\n'),
    });
    if (sent) this.logger.log(`inquiry ${row.id} mailed to the support address`);
  }

  /** The conversation id, only when it is this session's own (SEC-L3). */
  private async ownConversationId(session: Session, raw?: string | null): Promise<number | null> {
    if (!raw || !/^\d+$/.test(raw)) return null;
    const conversation = await this.convRepo.findOne({ where: { id: Number(raw) }, select: { id: true, sessionId: true } });
    if (!conversation || Number(conversation.sessionId) !== Number(session.id)) {
      this.logger.warn(`inquiry: conversation ${raw} is not session ${session.id}'s — not linked`);
      return null;
    }
    return Number(conversation.id);
  }

  private async find(tenantId: number, id: number): Promise<Inquiry> {
    const inquiry = await this.inquiryRepo.findOne({ where: { id, tenantId } });
    if (!inquiry) {
      this.logger.warn(`inquiry ${id} not found for tenant ${tenantId}`);
      throw new BusinessException(ERROR_CODE.INQUIRY_NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    return inquiry;
  }

  private async loadSession(token: string): Promise<Session> {
    const session = await this.sessionRepo.findOne({ where: { sessionToken: token } });
    if (!session) throw new BusinessException(ERROR_CODE.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND);
    return session;
  }
}
