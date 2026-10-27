import type { LocalizedText } from './language';

/**
 * When a conversation ends on its own, and what a waiting shopper is told
 * (PLN-261026-Chat-Auto-Close).
 *
 * Two independent settings live here because the widget, the console and the
 * API all read them:
 * - `ChatClosePolicy` — `tenants.chat_close_policy`. After the AI or an agent
 *   answered and the shopper went quiet, ask for a rating; after a further
 *   wait, end the conversation. NULL = the old platform rule (30 min of
 *   silence → "anything else?" → close, agent threads only).
 * - the queue timeout and the callback request — keys of `handoff_config`,
 *   owned by the handoff form, so they are typed in the API next to it.
 *
 * Copy is per language and exact: a tenant who wrote only the Korean line has
 * not written a Vietnamese one, so a Vietnamese shopper gets the built-in
 * Vietnamese text rather than the tenant's Korean (or English) sentence.
 */
export interface ChatClosePolicy {
  /** Minutes after the last AI/agent reply before the rating request (A1). */
  csatAfterMin: number;
  /** Minutes after the rating request before the conversation ends (A2). */
  closeAfterMin: number;
  /** Rating request line (A4). */
  csatPrompt?: LocalizedText;
  /** Closing line when nobody rated (A2/A4). */
  closingNotice?: LocalizedText;
  /** Thank-you line after a rating, right before the end (A3/A4). */
  thanksNotice?: LocalizedText;
  /**
   * When the policy was first switched on (ISO). Conversations that went quiet
   * before this are closed silently — switching it on must not send a rating
   * request into every abandoned thread at once (go2joy staging had 231).
   */
  since?: string;
}

export const CHAT_CLOSE_MIN = 1;
export const CHAT_CLOSE_MAX = 60;
export const CHAT_CLOSE_DEFAULTS = { csatAfterMin: 3, closeAfterMin: 3 } as const;
/** Upper bound on one tenant-written line. */
export const CHAT_CLOSE_COPY_MAX = 500;

/** Queue timeout bounds (minutes) — `handoff_config.queueTimeout.afterMinutes`. */
export const QUEUE_TIMEOUT_MIN = 1;
export const QUEUE_TIMEOUT_MAX = 30;
export const QUEUE_TIMEOUT_DEFAULT = 3;

/**
 * Quick-reply id of the "request a callback" chip. The widget opens its
 * callback card for this id instead of sending it as a scenario action.
 */
export const CALLBACK_CHIP_ID = 'callback_request';

export const CALLBACK_CHANNEL = { EMAIL: 'email', PHONE: 'phone' } as const;
export type CallbackChannel = (typeof CALLBACK_CHANNEL)[keyof typeof CALLBACK_CHANNEL];
export const CALLBACK_CHANNEL_VALUES = Object.values(CALLBACK_CHANNEL) as CallbackChannel[];

export const CALLBACK_STATUS = { REQUESTED: 'requested', DONE: 'done', CANCELED: 'canceled' } as const;
export type CallbackStatus = (typeof CALLBACK_STATUS)[keyof typeof CALLBACK_STATUS];
export const CALLBACK_STATUS_VALUES = Object.values(CALLBACK_STATUS) as CallbackStatus[];

/** Where the stored contact came from: the member profile, or typed in the widget. */
export const CALLBACK_SOURCE = { MEMBER: 'member', ENTERED: 'entered' } as const;
export type CallbackSource = (typeof CALLBACK_SOURCE)[keyof typeof CALLBACK_SOURCE];

/** Built-in copy; a tenant line for the same language replaces it. */
export const CHAT_CLOSE_DEFAULT_COPY = {
  csatPrompt: {
    EN: 'Was this conversation helpful? Please rate your experience.',
    ES: '¿Te resultó útil esta conversación? Valora tu experiencia, por favor.',
    KO: '상담이 도움이 되셨나요? 만족도를 평가해 주세요.',
    VI: 'Cuộc trò chuyện này có hữu ích với bạn không? Vui lòng đánh giá trải nghiệm của bạn.',
    JA: '今回の対応はお役に立ちましたか。満足度の評価をお願いいたします。',
    ZH: '本次对话对您有帮助吗？请为您的体验评分。',
  },
  closingNotice: {
    EN: 'This chat is now closed. Thank you for contacting us.',
    ES: 'Esta conversación ha finalizado. Gracias por contactarnos.',
    KO: '상담을 종료합니다. 이용해 주셔서 감사합니다.',
    VI: 'Cuộc trò chuyện đã kết thúc. Cảm ơn bạn đã liên hệ với chúng tôi.',
    JA: 'チャットを終了いたします。ご利用いただきありがとうございました。',
    ZH: '本次对话已结束，感谢您的联系。',
  },
  thanksNotice: {
    EN: 'Thank you for your feedback. This chat is now closed.',
    ES: 'Gracias por tu opinión. Esta conversación ha finalizado.',
    KO: '소중한 의견 감사합니다. 상담을 종료합니다.',
    VI: 'Cảm ơn bạn đã góp ý. Cuộc trò chuyện đã kết thúc.',
    JA: '貴重なご意見をありがとうございました。チャットを終了いたします。',
    ZH: '感谢您的反馈，本次对话已结束。',
  },
  queueDelay: {
    EN: "Our agents are busy, so connecting you is taking longer than usual. Please wait a moment, or ask me again and I'll keep helping you.",
    ES: 'Nuestros agentes están ocupados y la conexión está tardando más de lo habitual. Espera un momento o vuelve a preguntarme y seguiré ayudándote.',
    KO: '대기인이 많아 상담원 연결이 지연되고 있습니다. 잠시 대기 또는 저에게 다시 요청해주시면 상담을 이어서 진행하겠습니다.',
    VI: 'Hiện có nhiều người đang chờ nên việc kết nối nhân viên đang bị chậm. Vui lòng chờ trong giây lát, hoặc hỏi lại tôi để tôi tiếp tục hỗ trợ bạn.',
    JA: 'ただいま混み合っており、担当者へのおつなぎが遅れております。少々お待ちいただくか、もう一度私にお尋ねいただければ引き続き対応いたします。',
    ZH: '当前排队人数较多，转接客服有所延迟。请稍候，或再次向我提问，我会继续为您服务。',
  },
  callbackChip: {
    EN: 'Request a callback',
    ES: 'Solicitar que me contacten',
    KO: '상담원 콜백 요청',
    VI: 'Yêu cầu gọi lại',
    JA: '折り返し連絡を依頼',
    ZH: '请求回电',
  },
  /** `{contact}` = the masked contact. */
  callbackSaved: {
    EN: 'Got it — an agent will contact you at {contact}.',
    ES: 'Entendido: un agente te contactará en {contact}.',
    KO: '접수했어요. 상담원이 {contact}(으)로 연락드릴게요.',
    VI: 'Đã ghi nhận — nhân viên sẽ liên hệ với bạn qua {contact}.',
    JA: '承りました。担当者より {contact} へご連絡いたします。',
    ZH: '已收到，客服人员将通过 {contact} 与您联系。',
  },
} satisfies Record<string, LocalizedText>;

/** Tenant line for exactly this language, else the built-in one. */
export function chatCopy(custom: LocalizedText | undefined | null, fallback: LocalizedText, lang: string | null | undefined): string {
  const key = String(lang ?? '').toUpperCase() as keyof LocalizedText;
  const own = custom?.[key]?.trim();
  if (own) return own;
  return fallback[key] ?? fallback.EN ?? '';
}

function minutes(value: unknown, fallback: number, max = CHAT_CLOSE_MAX): number | null {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < CHAT_CLOSE_MIN || n > max) return null;
  return n;
}

/** Keep only non-empty, length-bounded lines keyed by a session language code. */
export function normalizeLocalizedCopy(raw: unknown, max = CHAT_CLOSE_COPY_MAX): LocalizedText | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Z]{2}$/.test(k) || typeof v !== 'string') continue;
    const line = v.trim().slice(0, max);
    if (line) out[k] = line;
  }
  return Object.keys(out).length ? (out as LocalizedText) : undefined;
}

/**
 * Validate a policy from the console. Returns null when a minute value is out
 * of range (the caller answers 400); copy is trimmed, empty lines dropped.
 */
export function normalizeChatClosePolicy(raw: unknown): ChatClosePolicy | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const csatAfterMin = minutes(r.csatAfterMin, CHAT_CLOSE_DEFAULTS.csatAfterMin);
  const closeAfterMin = minutes(r.closeAfterMin, CHAT_CLOSE_DEFAULTS.closeAfterMin);
  if (csatAfterMin == null || closeAfterMin == null) return null;
  const policy: ChatClosePolicy = { csatAfterMin, closeAfterMin };
  for (const key of ['csatPrompt', 'closingNotice', 'thanksNotice'] as const) {
    const copy = normalizeLocalizedCopy(r[key]);
    if (copy) policy[key] = copy;
  }
  if (typeof r.since === 'string' && !Number.isNaN(Date.parse(r.since))) policy.since = r.since;
  return policy;
}

/** Read side: a stored row that no longer validates counts as "not configured". */
export function readChatClosePolicy(raw: unknown): ChatClosePolicy | null {
  return raw ? normalizeChatClosePolicy(raw) : null;
}

/** `ng***@gmail.com` — first two characters of the local part, the domain kept. */
export function maskEmail(email: string): string {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

/** `+84 90*****21` — country/prefix and the last two digits kept. */
export function maskPhone(phone: string): string {
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.length <= 4) return '***';
  const plus = digits.startsWith('+');
  const body = plus ? digits.slice(1) : digits;
  const head = plus ? `+${body.slice(0, 2)} ${body.slice(2, 4)}` : body.slice(0, 3);
  const used = plus ? 4 : 3;
  const hidden = Math.max(body.length - used - 2, 1);
  return `${head}${'*'.repeat(hidden)}${body.slice(-2)}`;
}

export function maskContact(channel: string, contact: string): string {
  return channel === CALLBACK_CHANNEL.PHONE ? maskPhone(contact) : maskEmail(contact);
}

/**
 * Phone as typed → `+<digits>` (E.164-ish) or null. A leading 0 is a national
 * number and is kept as typed digits — the agent dials it, we do not guess the
 * country.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!/^\+?[\d\s().-]{6,24}$/.test(trimmed)) return null;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 6 || digits.length > 15) return null;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}
