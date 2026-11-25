import { Repository } from 'typeorm';
import { CONSENT_STATE, CONVERSATION_STATUS, MODERATION_DECISION } from '@sharptalk/types';
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
 * A free-text recommendation question goes to the selector, not the knowledge
 * base (IVY PRD v1 slides 16–17, PLN-261125-Phase5).
 */
describe('ChatService — recommendation questions', () => {
  const CATEGORIES = [
    { id: 'hair', label: { EN: 'Hair', KO: '헤어' } },
    { id: 'nails', label: { EN: 'Nails', KO: '네일' } },
  ];

  const build = (opts: { intent?: string; fallback?: boolean; categories?: unknown[]; status?: string; wording?: boolean }) => {
    const conversation = {
      id: 91,
      sessionId: 7,
      tenantId: 4,
      status: opts.status ?? CONVERSATION_STATUS.AI_ACTIVE,
    } as Conversation;
    const session = {
      id: 7,
      sessionToken: 'tok-7',
      tenantId: 4,
      customerId: null,
      identityLevel: 'guest',
      language: 'KO',
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
      answerWithoutKnowledge: jest.fn(async () => '안녕하세요!'),
      answer: jest.fn(async () => ({ text: '지식 기반 답변', confidence: 0.9, citations: [] })),
      effectiveAgentId: jest.fn(async () => 21),
    } as unknown as RagService;
    const moderate = jest.fn(async (req: { text: string }) => ({ decision: MODERATION_DECISION.DELIVERED, text: req.text }));
    const aiConfig = { getProductCategories: jest.fn(async () => opts.categories ?? CATEGORIES) };
    const word = jest.fn(async (_t: number, _l: string, _a: string, s: string) => (opts.wording ? 'AI가 쓴 문장' : s));
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
      undefined, // answerReuse
      undefined, // issueService
      undefined, // statRepo
      undefined, // attachments
      undefined, // threads
      undefined, // mergedRooms
      undefined, // consultCategories
      aiConfig,
      { word },
    );
    return { svc, session, saved, rag, moderate, aiConfig, word };
  };

  it('answers with the store categories as chips — the named one first — without the knowledge base', async () => {
    const b = build({});
    const res = await b.svc.handleUserMessage(b.session, '네일 인기 상품 추천해 주세요');
    expect(res.reply?.senderType).toBe('ai');
    expect(res.reply?.body).toBe('가장 인기 있는 상품을 보여드릴게요. 어떤 카테고리를 보시겠어요?');
    expect(res.reply?.quickReplies).toEqual([
      { id: 'popular_category:nails', label: '네일' },
      { id: 'popular_category:hair', label: '헤어' },
    ]);
    expect(b.rag.answer).not.toHaveBeenCalled();
    // Moderated, and stored with its chips so a reload keeps them.
    expect(b.moderate).toHaveBeenCalledWith(expect.objectContaining({ scope: 'ai' }));
    const aiTurn = b.saved.find((m) => m.senderType === 'ai');
    expect(aiTurn?.retrievalTrace).toMatchObject({ answeredFrom: 'recommendation', followUps: res.reply?.quickReplies });
  });

  it('the line is the AI’s wording when there is one (C-02)', async () => {
    const b = build({ wording: true });
    const res = await b.svc.handleUserMessage(b.session, '인기 상품 추천해 주세요');
    expect(res.reply?.body).toBe('AI가 쓴 문장');
    expect(b.word).toHaveBeenCalledWith(4, 'KO', 'recommend_ask', expect.any(String));
  });

  it.each([
    ['another intent', { intent: 'order_status' }],
    ['a classifier fallback', { fallback: true }],
    ['a tenant with no Product Help categories', { categories: [] }],
  ])('leaves %s to the usual answer', async (_name, opts) => {
    const b = build(opts);
    await b.svc.handleUserMessage(b.session, '인기 상품 추천해 주세요');
    expect(b.rag.answer).toHaveBeenCalled();
  });

  it('a product question that asks for no picks is answered as before', async () => {
    const b = build({});
    await b.svc.handleUserMessage(b.session, '젤 네일 지우는 방법 알려주세요');
    expect(b.aiConfig.getProductCategories).not.toHaveBeenCalled();
    expect(b.rag.answer).toHaveBeenCalled();
  });
});
