import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { AI_FUNCTION } from '@sharptalk/types';
import { AiGatewayService } from '../../infrastructure/external/ai/ai-gateway.service';
import { RedisService } from '../../infrastructure/infrastructure.module';
import { replyLanguageRule } from './rag.service';
import { cleanModelText, keepsFacts } from './ai-wording';

/** A slow engine must not hold a tapped button: past this, the script is sent as written. */
export const WORDING_TIMEOUT_MS = 5000;
/** A wording is reused this long for the same script and language. */
const CACHE_SEC = 12 * 3600;
/** A refused or failed rewrite is not retried at once — the script stands for a while. */
const MISS_CACHE_SEC = 3600;
const MISS = '\u0000';

const SYSTEM =
  'You rewrite one customer-support message for the chat widget of an online beauty store.\n' +
  'Rules:\n' +
  '- Natural, warm and concise, like a helpful store assistant. Not salesy.\n' +
  '- Keep the meaning and every fact. Copy numbers, prices, percentages, dates, durations, email ' +
  'addresses, URLs and markdown links [text](url) exactly as written (the link text may be translated).\n' +
  '- Keep numbered steps as numbered lines (1., 2., 3.) in the same order, and keep **bold** text bold.\n' +
  '- Do not add facts, promises, greetings, sign-offs or questions that are not in the message. ' +
  'Keep emojis that are there; add none.\n' +
  '- Output only the rewritten message.';

/**
 * AI wording for scripted answers (IVY PRD v1 C-02, PLN-261125-IVY-PRD-v1-Phase5 §1.1).
 *
 * The quick menu's answers are the tenant's script; the AI writes them in its
 * own words while the facts stay the script's (`keepsFacts`). Only the script
 * text and the language reach the model — never the shopper's data. With no
 * real engine on the tenant's chat function (the Stub), nothing is called and
 * the script is sent as it is, exactly as before this existed.
 */
@Injectable()
export class ScriptWordingService {
  private readonly logger = new Logger(ScriptWordingService.name);

  constructor(
    private readonly ai: AiGatewayService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  /** The text to send: the AI's wording when it keeps every fact, otherwise `script`. */
  async word(tenantId: number | null, language: string, action: string, script: string): Promise<string> {
    const text = script?.trim();
    if (!text || tenantId == null) return script;
    try {
      const routing = await this.ai.resolveRouting(tenantId, AI_FUNCTION.CHAT);
      const provider = routing.engine?.provider;
      if (!provider || provider === 'stub') return script;

      const key = `aiw:script:${tenantId}:${language}:${createHash('sha1').update(text).digest('hex')}`;
      const cached = await this.redis?.get(key).catch(() => null);
      if (cached === MISS) return script;
      if (cached) return cached;

      const res = await withTimeout(
        this.ai.complete({
          tenantId,
          function: AI_FUNCTION.CHAT,
          feature: 'script_wording',
          system: `${SYSTEM}\n${replyLanguageRule(language.toLowerCase())}`,
          messages: [{ role: 'user', content: text }],
          temperature: 0.4,
          maxTokens: 800,
        }),
        WORDING_TIMEOUT_MS,
      );
      if (!res || res.degraded || res.provider === 'stub') {
        this.logger.warn(`script wording skipped (${action}, tenant ${tenantId}): ${res ? 'engine fell back to stub' : 'timed out'}`);
        await this.redis?.set(key, MISS, MISS_CACHE_SEC).catch(() => undefined);
        return script;
      }
      const rewrite = cleanModelText(res.text);
      const guard = keepsFacts(text, rewrite);
      if (!guard.ok) {
        this.logger.warn(`script wording refused (${action}, ${language}, tenant ${tenantId}): ${guard.reason}`);
        await this.redis?.set(key, MISS, MISS_CACHE_SEC).catch(() => undefined);
        return script;
      }
      await this.redis?.set(key, rewrite, CACHE_SEC).catch(() => undefined);
      return rewrite;
    } catch (e) {
      this.logger.warn(`script wording failed (${action}, tenant ${tenantId}): ${(e as Error).message}`);
      return script;
    }
  }
}

/** Resolve with the promise's value, or null once `ms` have passed. */
export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
