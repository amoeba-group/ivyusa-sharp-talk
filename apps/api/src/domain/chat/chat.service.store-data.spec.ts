import { Repository } from 'typeorm';
import { CONSENT_STATE, CONVERSATION_STATUS, MODERATION_DECISION } from '@sharptalk/types';
import type { ChatProductCard } from '@sharptalk/types';
import { ChatService } from './chat.service';
import { Conversation } from './entity/conversation.entity';
import { Message } from './entity/message.entity';
import { Session } from '../session/entity/session.entity';
import { Tenant } from '../tenant/entity/tenant.entity';
import { User } from '../user/entity/user.entity';
import { RagService } from './rag.service';
import { ModerationService } from '../moderation/moderation.service';
import { CONSENT_NOTICE_VERSION, SessionService } from '../session/session.service';
import { EventBusService } from '../../infrastructure/infrastructure.module';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { HandoffRouterService } from '../ai-engine/handoff-router.service';

/**
 * A typed product question reads the store, never replays a stored answer, and
 * carries its product cards to the widget and onto the stored turn (PLN-261126).
 */
describe('ChatService — store data for a typed product question', () => {
  const CARD: ChatProductCard = {
    handle: 'kiss-gel-fantasy',
    title: 'KISS Gel Fantasy Nails',
    imageUrl: 'https://cdn.shopify.com/k.jpg',
    price: 9.99,
    currency: 'USD',
    productUrl: 'https://ivyusa.com/products/kiss-gel-fantasy',
    inStock: true,
  };

  const build = (opts: { intent?: string; fallback?: boolean; productLive?: boolean } = {}) => {
    const conversation = { id: 91, sessionId: 7, tenantId: 4, status: CONVERSATION_STATUS.AI_ACTIVE } as Conversation;
    const session = {
      id: 7,
      sessionToken: 'tok-7',
      tenantId: 4,
      customerId: null,
      identityLevel: 'guest',
      language: 'EN',
      consentState: CONSENT_STATE.GRANTED,
      consentAt: new Date(),
      consentVersion: CONSENT_NOTICE_VERSION,
    } as Session;
    const saved: Array<Partial<Message>> = [];
    let nextId = 100;
    const msgRepo = {
      save: jest.fn(async (m: Partial<Message>) => {
        const row = { ...m, id: nextId++ };
        saved.push(row);
        return row;
      }),
      create: (m: Partial<Message>) => m,
      update: jest.fn(),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    } as unknown as Repository<Message>;
    const convRepo = {
      findOne: jest.fn(async () => conversation),
      save: jest.fn(async (c: Conversation) => c),
      create: (c: Partial<Conversation>) => c,
      update: jest.fn(),
      findOneOrFail: jest.fn(async () => conversation),
    } as unknown as Repository<Conversation>;
    const sessionRepo = {
      findOne: jest.fn(async () => session),
      save: jest.fn(async (s: Session) => s),
    } as unknown as Repository<Session>;
    const tenantRepo = {
      findOne: jest.fn(async () => ({ id: 4, privacyPolicyUrl: null, consentNoticeVersion: null, commerceEnabled: 1 }) as unknown as Tenant),
    } as unknown as Repository<Tenant>;
    const redis = { available: () => false, get: jest.fn(), set: jest.fn(), del: jest.fn() } as unknown as RedisService;
    const bus = { publish: jest.fn() } as unknown as EventBusService;
    const rag = {
      classifyIntent: jest.fn(async () => ({
        intent: opts.intent ?? 'product_inquiry',
        needsOrderData: false,
        confidence: 0.9,
        fallback: opts.fallback,
      })),
      answerWithoutKnowledge: jest.fn(async () => 'Hello!'),
      answer: jest.fn(async () => ({
        text: 'Yes, it is in stock at $9.99.',
        confidence: 0.9,
        citations: [],
        products: [CARD],
        storeData: 1,
      })),
      effectiveAgentId: jest.fn(async () => 21),
    } as unknown as RagService & { answer: jest.Mock };
    const moderate = jest.fn(async (req: { text: string }) => ({ decision: MODERATION_DECISION.DELIVERED, text: req.text }));
    const answerReuse = {
      lookup: jest.fn(async () => null),
      recordAiAnswer: jest.fn(),
      recordHit: jest.fn(),
      deactivate: jest.fn(),
    };
    const productLive = { lookup: jest.fn(async () => null), catalogue: jest.fn(async () => []) };
    const svc = new (ChatService as unknown as new (...args: unknown[]) => ChatService)(
      convRepo,
      msgRepo,
      sessionRepo,
      tenantRepo,
      { find: jest.fn(async () => []) } as unknown as Repository<User>,
      { update: jest.fn() },
      rag,
      { moderate } as unknown as ModerationService,
      { recentForCustomer: jest.fn(async () => []) },
      new SessionService(sessionRepo, tenantRepo, bus, redis),
      {
        route: jest.fn(async () => ({ mode: 'agents', targetUserIds: [] })),
        denyMatch: jest.fn(async () => null),
      } as unknown as HandoffRouterService,
      bus,
      undefined, // customerService
      redis,
      answerReuse,
      undefined, // issueService
      undefined, // statRepo
      undefined, // attachments
      undefined, // threads
      undefined, // mergedRooms
      undefined, // consultCategories
      { getProductCategories: jest.fn(async () => []) }, // aiConfig
      undefined, // wording
      opts.productLive === false ? undefined : productLive,
    );
    return { svc, session, saved, rag: rag as unknown as { answer: jest.Mock }, answerReuse, productLive };
  };

  /** The 12th argument of rag.answer — the store lookup. */
  const lookupArg = (rag: { answer: jest.Mock }) => rag.answer.mock.calls[0][11] as ((h: string[]) => Promise<unknown>) | undefined;
  /** The 13th — the catalogue names (PLN-261127). */
  const catalogueArg = (rag: { answer: jest.Mock }) => rag.answer.mock.calls[0][12] as (() => Promise<unknown>) | undefined;

  it('a product question hands RAG a store lookup for this tenant', async () => {
    const b = build();
    await b.svc.handleUserMessage(b.session, 'Is KISS Gel Fantasy Nails in stock?');
    const lookup = lookupArg(b.rag);
    expect(lookup).toEqual(expect.any(Function));
    await lookup!(['kiss-gel-fantasy']);
    expect(b.productLive.lookup).toHaveBeenCalledWith(4, ['kiss-gel-fantasy']);
  });

  it('and the catalogue names of this tenant, so a colour the shopper names is read (PLN-261127)', async () => {
    const b = build();
    await b.svc.handleUserMessage(b.session, 'Is KISS imPRESS Color Press On Nails - Cosmic in stock?');
    const catalogue = catalogueArg(b.rag);
    expect(catalogue).toEqual(expect.any(Function));
    await catalogue!();
    expect(b.productLive.catalogue).toHaveBeenCalledWith(4);
  });

  it('is never answered from the reuse store, nor stored in it (D6)', async () => {
    const b = build();
    await b.svc.handleUserMessage(b.session, 'Is KISS Gel Fantasy Nails in stock?');
    expect(b.answerReuse.lookup).not.toHaveBeenCalled();
    expect(b.answerReuse.recordAiAnswer).not.toHaveBeenCalled();
  });

  it('the cards go out with the reply and onto the stored turn', async () => {
    const b = build();
    const res = await b.svc.handleUserMessage(b.session, 'Is KISS Gel Fantasy Nails in stock?');
    expect(res.reply?.products).toEqual([CARD]);
    const aiTurn = b.saved.find((m) => m.senderType === 'ai');
    expect(aiTurn?.retrievalTrace).toMatchObject({ products: [CARD], storeData: 1 });
  });

  it.each([
    ['another intent', { intent: 'cancel_refund' }],
    ['a classifier fallback', { fallback: true }],
    ['no product service wired', { productLive: false }],
  ])('%s: no store lookup, and the reuse store works as before', async (_name, opts) => {
    const b = build(opts);
    await b.svc.handleUserMessage(b.session, 'How long does a refund take?');
    expect(lookupArg(b.rag)).toBeUndefined();
    expect(catalogueArg(b.rag)).toBeUndefined();
    expect(b.answerReuse.lookup).toHaveBeenCalled();
  });
});
