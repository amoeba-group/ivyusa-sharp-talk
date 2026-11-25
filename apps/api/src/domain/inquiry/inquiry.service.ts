import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { buildPagination, normalizePage } from '@sharptalk/common';
import { CONSENT_STATE, INQUIRY_KIND, feedbackProblems, inquiryProblems, normalizeInquiry } from '@sharptalk/types';
import type { InquiryCreatedResponse, InquiryInput } from '@sharptalk/types';
import { Inquiry } from './entity/inquiry.entity';
import { INQUIRY_STATUS, InquiryStatus } from './dto/request/inquiry.request';
import { Session } from '../session/entity/session.entity';
import { Conversation } from '../chat/entity/conversation.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { OrderCache } from '../order/entity/order-cache.entity';
import { Message } from '../chat/entity/message.entity';
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
  /** 'feedback' — the message only, kept for the admin, not mailed (IVY PRD v1 C-01). */
  kind?: string | null;
}

/** How much of the chat the support mail carries (IVY PRD v1 E-01: "recent chat attached"). */
export const INQUIRY_TRANSCRIPT_MESSAGES = 20;
const TRANSCRIPT_LINE_MAX = 500;
const SENDER_LABEL: Record<string, string> = { user: 'Customer', ai: 'AI', agent: 'Staff', system: 'System' };

/** "[14:02 UTC] Customer: Where is my order?" — one line per message, oldest first. */
export function transcriptLines(messages: ReadonlyArray<Pick<Message, 'senderType' | 'body' | 'createdAt'>>): string[] {
  return messages.map((m) => {
    const at = m.createdAt ? new Date(m.createdAt).toISOString().slice(11, 16) : '--:--';
    const who = SENDER_LABEL[m.senderType] ?? m.senderType;
    const text = String(m.body ?? '').replace(/\s+/g, ' ').trim();
    const cut = text.length > TRANSCRIPT_LINE_MAX ? `${text.slice(0, TRANSCRIPT_LINE_MAX).trimEnd()}…` : text;
    return `[${at} UTC] ${who}: ${cut}`;
  });
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
    @Optional() @InjectRepository(OrderCache) private readonly orderRepo?: Repository<OrderCache>,
    @Optional() @InjectRepository(Message) private readonly messageRepo?: Repository<Message>,
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
    const kind = input.kind === INQUIRY_KIND.FEEDBACK ? INQUIRY_KIND.FEEDBACK : INQUIRY_KIND.INQUIRY;
    const feedback = kind === INQUIRY_KIND.FEEDBACK;
    const problems = feedback ? feedbackProblems(input) : inquiryProblems(input);
    if (Object.keys(problems).length) {
      // Which fields, never their content.
      this.logger.warn(`inquiry refused: ${JSON.stringify(problems)} (session ${session.id})`);
      throw new BusinessException(ERROR_CODE.INQUIRY_INVALID, HttpStatus.BAD_REQUEST);
    }
    const form = normalizeInquiry({ name: input.name ?? '', email: input.email ?? '', message: input.message ?? '' });

    const key = inquiryLimitKey(Number(session.id));
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.set(key, '1', LIMIT_WINDOW_SEC);
    if (count > INQUIRY_HOURLY_LIMIT) {
      this.logger.warn(`inquiry refused: ${count} this hour (session ${session.id})`);
      throw new BusinessException(ERROR_CODE.INQUIRY_LIMIT, HttpStatus.TOO_MANY_REQUESTS);
    }

    // An address whose owner asked to be erased is not stored again.
    if (form.email && (await this.suppression.isSuppressed(tenantId, { email: form.email }))) {
      this.logger.warn(`inquiry refused: address erased (session ${session.id})`);
      throw new BusinessException(ERROR_CODE.IDENTITY_ERASED, HttpStatus.CONFLICT);
    }
    // A guest gets a lead customer from the address, so the inquiry is erasable
    // with the person (D3). Email only: a typed name must not overwrite the
    // name an existing customer row already carries.
    // Feedback from a guest may come without an address: then it belongs to no one.
    const customerId =
      session.customerId ??
      (form.email ? (await this.customers.createFromLead(tenantId, { email: form.email })).id : null);
    const conversationId = await this.ownConversationId(session, input.conversationId);
    const orderId = await this.ownOrderId(session, tenantId, input.orderId);

    const row = await this.inquiryRepo.save(
      this.inquiryRepo.create({
        // Stamped from the session (SEC-L6): a public endpoint has no tenant context.
        tenantId,
        customerId,
        conversationId,
        orderId,
        contactName: form.name || null,
        contactEmail: form.email || null,
        message: form.message,
        language: session.language ?? null,
        status: INQUIRY_STATUS.OPEN,
        kind,
      }),
    );
    await this.audit
      .write({
        tenantId,
        actorType: 'system',
        actorId: 0,
        action: feedback ? 'feedback.created' : 'inquiry.created',
        target: `inquiry:${row.id}`,
        // Never the contact or the message — only where it came from.
        metadata: { conversationId: conversationId != null ? String(conversationId) : null, guest: session.customerId == null },
      })
      .catch((e: Error) => this.logger.warn(`inquiry audit failed: ${e.message}`));
    this.logger.log(`${kind} ${row.id} created (tenant ${tenantId}, session ${session.id})`);
    // Feedback is read in the console; only inquiries need an answer by email.
    // The shopper's confirmation never waits on an SMTP round trip.
    if (!feedback) {
      void this.notifyTeam(tenantId, row).catch((e: Error) => this.logger.warn(`inquiry ${row.id} mail failed: ${e.message}`));
    }
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
  async listAll(tenantId: number, status?: string, page?: string, size?: string, kind?: string) {
    const { page: p, size: s } = normalizePage(page, size);
    const [items, total] = await this.inquiryRepo.findAndCount({
      where: {
        tenantId,
        ...(status && status !== 'all' ? { status } : {}),
        ...(kind && kind !== 'all' ? { kind } : {}),
      },
      order: { id: 'DESC' },
      skip: (p - 1) * s,
      take: s,
    });
    const orderNumbers = await this.orderNumbers(tenantId, items.map((i) => i.orderId));
    return new Paginated(InquiryMapper.toAdminViewList(items, orderNumbers), buildPagination(p, s, total));
  }

  /** Order numbers for the orders a page of inquiries names, tenant-scoped. */
  private async orderNumbers(tenantId: number, ids: Array<number | null>): Promise<Map<string, string>> {
    const wanted = [...new Set(ids.filter((v): v is number => v != null))];
    if (!wanted.length || !this.orderRepo) return new Map();
    const rows = await this.orderRepo.find({
      where: { id: In(wanted), tenantId },
      select: { id: true, orderNumber: true },
    });
    return new Map(rows.map((o) => [String(o.id), o.orderNumber]));
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
    const orderNumber =
      inquiry.orderId != null ? (await this.orderNumbers(tenantId, [inquiry.orderId])).get(String(inquiry.orderId)) ?? null : null;
    return InquiryMapper.toAdminDetail(inquiry, orderNumber);
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
    // IVY PRD v1 E-01: the order and the recent chat travel with the inquiry,
    // so the team answers without asking the customer to repeat themselves.
    const orderNumber =
      row.orderId != null ? (await this.orderNumbers(tenantId, [row.orderId])).get(String(row.orderId)) ?? null : null;
    const transcript = await this.recentChat(row.conversationId);
    const base = (process.env.APP_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
    const sent = await this.mailer.send({
      to,
      replyTo: row.contactEmail ?? undefined,
      subject: `[${shop}] New inquiry from ${row.contactName ?? 'a customer'}${orderNumber ? ` — order ${orderNumber}` : ''}`,
      text: [
        'A customer sent this from the chat widget.',
        '',
        `Name: ${row.contactName ?? ''}`,
        `Email: ${row.contactEmail ?? ''}`,
        `Language: ${row.language ?? ''}`,
        ...(orderNumber ? [`Order: ${orderNumber}`] : []),
        `Received: ${new Date(row.createdAt ?? Date.now()).toISOString()}`,
        '',
        'Message:',
        row.message ?? '',
        ...(transcript.length
          ? ['', `— Recent chat (last ${transcript.length} messages) —`, ...transcript]
          : []),
        ...(row.conversationId != null && base ? ['', `Open the chat in the console: ${base}/live-chat?c=${row.conversationId}`] : []),
        '',
        '—',
        'Reply to this email to answer the customer: it goes to their address.',
        `Then mark it answered in the console: Inquiries, in the left menu (#${row.id}).`,
      ].join('\n'),
    });
    if (sent) this.logger.log(`inquiry ${row.id} mailed to the support address`);
  }

  /** The last messages of the conversation the form was sent from, oldest first. Never fatal. */
  private async recentChat(conversationId: number | null): Promise<string[]> {
    if (conversationId == null || !this.messageRepo) return [];
    try {
      const rows = await this.messageRepo.find({
        where: { conversationId },
        order: { id: 'DESC' },
        take: INQUIRY_TRANSCRIPT_MESSAGES,
        select: { id: true, senderType: true, body: true, createdAt: true },
      });
      return transcriptLines(rows.reverse());
    } catch (e) {
      this.logger.warn(`inquiry transcript skipped for conversation ${conversationId}: ${(e as Error).message}`);
      return [];
    }
  }

  /**
   * The order id, only when it is this shopper's own order in this tenant (E-01):
   * the form must not pin someone else's order — or its number in the mail — on
   * an inquiry.
   */
  private async ownOrderId(session: Session, tenantId: number, raw?: string | null): Promise<number | null> {
    if (!raw || !/^\d+$/.test(raw) || !this.orderRepo) return null;
    if (session.customerId == null) {
      this.logger.warn(`inquiry: order ${raw} named by an anonymous session ${session.id} — not linked`);
      return null;
    }
    const order = await this.orderRepo.findOne({
      where: { id: Number(raw), tenantId },
      select: { id: true, customerId: true },
    });
    if (!order || Number(order.customerId) !== Number(session.customerId)) {
      this.logger.warn(`inquiry: order ${raw} is not session ${session.id}'s — not linked`);
      return null;
    }
    return Number(order.id);
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
