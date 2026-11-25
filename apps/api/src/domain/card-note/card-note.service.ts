import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import {
  AI_FUNCTION,
  CONSENT_STATE,
  MODERATION_DECISION,
  isOrderDelivered,
  isOrderInTransit,
} from '@sharptalk/types';
import { OrderCache } from '../order/entity/order-cache.entity';
import { OrderItem } from '../order/entity/order-item.entity';
import { Fulfillment } from '../order/entity/fulfillment.entity';
import { Session } from '../session/entity/session.entity';
import { SessionService } from '../session/session.service';
import { ModerationService } from '../moderation/moderation.service';
import { ProductRecommendationService } from '../product/product-recommendation.service';
import { AiGatewayService } from '../../infrastructure/external/ai/ai-gateway.service';
import { RedisService } from '../../infrastructure/infrastructure.module';
import { replyLanguageRule } from '../chat/rag.service';
import { cleanModelText, onlyKnownNumbers } from '../chat/ai-wording';
import { withTimeout, WORDING_TIMEOUT_MS } from '../chat/script-wording.service';
import type { CardNoteKind, CardNoteRequest } from './dto/request/card-note.request';

/** A note is reused this long while the card's facts stay the same. */
const CACHE_SEC = 600;
const MAX_CHARS = 300;
const NONE = { text: null } as const;

const SYSTEM =
  'You write one or two short sentences for a shopper in the chat widget of an online beauty store. ' +
  'They sit next to a card that already shows the details below.\n' +
  'Rules:\n' +
  '- Use only these facts. Never invent dates, amounts, times, carriers or promises.\n' +
  '- Say what the status means for the shopper and, when it helps, the next step they can take ' +
  '(follow the delivery, or contact support).\n' +
  '- No greeting, no question, no sign-off. Output only the sentences.';

export interface CardNote {
  text: string | null;
}

/**
 * The AI line next to a data card (IVY PRD v1 C-02, PLN-261125-IVY-PRD-v1-Phase5 §1.2):
 * Payment check, Delivery inquiry and Stock inquiry.
 *
 * The facts are built here from our own data — never taken from the widget —
 * and an order must be the session customer's. No note (`text: null`, the
 * widget keeps its own sentence) when: the shopper has not consented to chat
 * and AI (withdrawing stops AI at once, PRD slide 21), the tenant's chat
 * function has no real engine, the engine is slow or fails, the text names a
 * number the facts do not have, or moderation stops it.
 */
@Injectable()
export class CardNoteService {
  private readonly logger = new Logger(CardNoteService.name);

  constructor(
    @InjectRepository(OrderCache) private readonly orderRepo: Repository<OrderCache>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Fulfillment) private readonly fulfillRepo: Repository<Fulfillment>,
    private readonly sessionService: SessionService,
    private readonly moderation: ModerationService,
    private readonly products: ProductRecommendationService,
    private readonly ai: AiGatewayService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  async note(dto: CardNoteRequest): Promise<CardNote> {
    const session = await this.sessionService.findByToken(dto.session_token);
    const tenantId = session.tenantId;
    if (tenantId == null) return NONE;
    const consent =
      session.channel === 'preview'
        ? CONSENT_STATE.GRANTED
        : await this.sessionService.effectiveConsentFor(session.id, tenantId);
    if (consent !== CONSENT_STATE.GRANTED) return NONE;

    const routing = await this.ai.resolveRouting(tenantId, AI_FUNCTION.CHAT);
    const provider = routing.engine?.provider;
    if (!provider || provider === 'stub') return NONE;

    const facts = dto.kind === 'stock' ? await this.stockFacts(tenantId, dto) : await this.orderFacts(session, dto.kind, dto.order_id);
    if (!facts) return NONE;

    const language = String(session.language || 'EN');
    const key = `aiw:card:${tenantId}:${language}:${createHash('sha1').update(facts).digest('hex')}`;
    const cached = await this.redis?.get(key).catch(() => null);
    if (cached) return { text: cached };

    try {
      const res = await withTimeout(
        this.ai.complete({
          tenantId,
          function: AI_FUNCTION.CHAT,
          feature: 'card_note',
          system: `${SYSTEM}\n${replyLanguageRule(language.toLowerCase())}`,
          messages: [{ role: 'user', content: facts }],
          temperature: 0.4,
          maxTokens: 200,
        }),
        WORDING_TIMEOUT_MS,
      );
      if (!res || res.degraded || res.provider === 'stub') return NONE;
      const text = cleanModelText(res.text);
      if (!text || text.length > MAX_CHARS) return NONE;
      const guard = onlyKnownNumbers(text, facts);
      if (!guard.ok) {
        this.logger.warn(`card note refused (${dto.kind}, tenant ${tenantId}): ${guard.reason}`);
        return NONE;
      }
      // Every AI line to a shopper passes the gate (FR-069); a block means no note.
      const moderated = await this.moderation.moderate({ tenantId, scope: 'ai', authorType: 'ai', text });
      if (moderated.decision === MODERATION_DECISION.BLOCKED) return NONE;
      await this.redis?.set(key, moderated.text, CACHE_SEC).catch(() => undefined);
      return { text: moderated.text };
    } catch (e) {
      this.logger.warn(`card note failed (${dto.kind}, tenant ${tenantId}): ${(e as Error).message}`);
      return NONE;
    }
  }

  /** Payment / delivery facts of an order the session's customer placed. */
  private async orderFacts(session: Session, kind: CardNoteKind, orderId?: string): Promise<string | null> {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0 || session.customerId == null) return null;
    const order = await this.orderRepo.findOne({ where: { id, tenantId: session.tenantId! } });
    if (!order || order.customerId == null || Number(order.customerId) !== Number(session.customerId)) {
      // 4xx-like refusals are not logged by default; this one is worth seeing.
      this.logger.warn(`card note refused: order ${id} is not the session customer's (session ${session.id})`);
      return null;
    }
    const items = await this.itemRepo.find({ where: { orderId: order.id }, select: { id: true, title: true }, order: { id: 'ASC' }, take: 50 });
    const first = items[0]?.title?.trim();
    const more = items.length - 1;
    const itemsLine = first ? (more > 0 ? `${first} and ${more} more item${more > 1 ? 's' : ''}` : first) : null;
    const stage = isOrderDelivered(order) ? 'delivered' : isOrderInTransit(order) ? 'on the way' : 'being prepared';
    const lines = [`Order: ${order.orderNumber}`, ...(itemsLine ? [`Items: ${itemsLine}`] : [])];
    if (kind === 'payment') {
      lines.unshift("Card: payment status of the shopper's latest order");
      if (order.total != null) lines.push(`Total: ${Number(order.total).toFixed(2)} ${order.currency ?? ''}`.trim());
      lines.push(`Payment: ${paymentWord(order.statusInternal)}`);
      lines.push(`Delivery: ${stage}`);
    } else {
      lines.unshift("Card: delivery tracker of the shopper's order");
      lines.push(`Delivery: ${stage}`);
      const f = await this.fulfillRepo.findOne({ where: { orderId: order.id } });
      if (f?.carrier) lines.push(`Carrier: ${f.carrier}`);
      lines.push(`Tracking link: ${f?.trackingNumber || f?.trackingUrl ? 'available on the card' : 'not yet'}`);
    }
    return lines.join('\n');
  }

  /** Stock facts of a product the shopper picked from their own search. */
  private async stockFacts(tenantId: number, dto: CardNoteRequest): Promise<string | null> {
    const handle = dto.product_handle?.trim();
    const q = dto.q?.trim();
    if (!handle || !q) return null;
    // The same search the widget just ran — served from its 2-minute cache.
    const res = await this.products.stockSearch(tenantId, q);
    const p = res.products.find((x) => x.handle === handle);
    if (!p) return null;
    const lines = [
      'Card: stock of a product the shopper picked',
      `Product: ${p.title}${p.vendor ? ` (${p.vendor})` : ''}`,
      ...(p.price != null ? [`Price: ${Number(p.price).toFixed(2)} ${p.currency ?? ''}`.trim()] : []),
      `Stock: ${p.available === false ? 'out of stock' : 'in stock'}`,
    ];
    return lines.join('\n');
  }
}

/** The widget's payment pill, in words — same reading of `status_internal` (order-answers.ts). */
function paymentWord(statusInternal: string | null): string {
  switch ((statusInternal ?? '').toLowerCase().trim()) {
    case 'pending_payment':
      return 'pending (not paid yet)';
    case 'cancelled':
    case 'canceled':
      return 'order cancelled';
    case 'refunded':
      return 'refunded';
    default:
      return 'paid';
  }
}
