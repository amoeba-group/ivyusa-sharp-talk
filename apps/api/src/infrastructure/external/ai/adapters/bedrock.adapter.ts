import { Injectable, Logger } from '@nestjs/common';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type ConverseCommandInput,
  type Message,
} from '@aws-sdk/client-bedrock-runtime';
import { AiAdapter, AiCompletionRequest, AiCompletionResult, AiMessage } from '../ai-adapter.interface';

/**
 * Engine `model` values that stand for the inference profiles IVY's IT set up,
 * and the env var holding each ARN. ARNs live in the server's env, never in
 * code or the database: IVY asks to be consulted before any model or region
 * change, and an env edit is the whole change.
 */
export const BEDROCK_MODEL_ALIASES: Record<string, string> = {
  sonnet: 'BEDROCK_SONNET_MODEL_ARN',
  haiku: 'BEDROCK_HAIKU_MODEL_ARN',
};

/** The effort levels Claude accepts (`output_config.effort`). Anything else is not sent. */
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

/**
 * Current Claude models think before they answer, and the thinking counts
 * against `maxTokens`. A low cap ends an answer mid-sentence or leaves it
 * empty; a higher cap costs nothing unless the model uses it.
 */
export const BEDROCK_MIN_MAX_TOKENS = 4096;

/** IVY's account runs in us-east-1 (their mail, 2026-11-19); `AWS_REGION` overrides. */
const DEFAULT_REGION = 'us-east-1';

/** HTTP status for an AWS error name, when the SDK did not report one. */
const STATUS_BY_NAME: Record<string, number> = {
  AccessDeniedException: 403,
  ResourceNotFoundException: 404,
  ThrottlingException: 429,
  ServiceQuotaExceededException: 429,
  ValidationException: 400,
};

/**
 * Claude on Amazon Bedrock through the Converse API (PLN-261119-IVY-AWS-Bedrock-Claude).
 *
 * No key: the AWS SDK signs with the server's IAM role — the EC2 instance
 * profile, which the API container reaches through IMDS (checked 2026-11-19:
 * role `talk-ivyusa-bedrock`). IVY's IT asked that no AWS credentials be put
 * in code or env. The model is an application inference profile ARN, because
 * IVY tracks usage per profile and blocks direct model IDs.
 */
@Injectable()
export class BedrockAdapter implements AiAdapter {
  readonly provider = 'bedrock';
  private readonly logger = new Logger(BedrockAdapter.name);
  private readonly clients = new Map<string, BedrockRuntimeClient>();

  async complete(req: AiCompletionRequest): Promise<AiCompletionResult> {
    const input: ConverseCommandInput = {
      modelId: resolveBedrockModel(req.model),
      messages: toConverseMessages(req.messages),
      ...(req.system?.trim() ? { system: [{ text: req.system }] } : {}),
      // maxTokens only. Claude Sonnet 5.5 and Haiku 5.5 reject a non-default
      // temperature with a 400 — the sample in IVY's mail sends 0.3 — so the
      // gateway's temperature is not passed on, as in AnthropicAdapter.
      inferenceConfig: { maxTokens: Math.max(req.maxTokens ?? 0, BEDROCK_MIN_MAX_TOKENS) },
      ...(req.effort && EFFORTS.has(req.effort)
        ? { additionalModelRequestFields: { output_config: { effort: req.effort } } }
        : {}),
      ...guardrailConfig(),
    };

    let res;
    try {
      res = await this.client().send(new ConverseCommand(input));
    } catch (e) {
      // Shape only: the error carries the request's model ARN at most, never the
      // conversation, and the summary is what the console's health row shows.
      throw new Error(describeBedrockError(e));
    }

    const blocks: ContentBlock[] = res.output?.message?.content ?? [];
    // Text blocks only: thinking comes back as its own blocks and is not the answer.
    const text = blocks.map((b) => (typeof b.text === 'string' ? b.text : '')).join('');
    if (res.stopReason && res.stopReason !== 'end_turn') {
      // max_tokens → the cap above is too low for this function; guardrail_intervened
      // → IVY's guardrail answered instead. Neither carries the customer's words.
      this.logger.warn(
        `Bedrock stopReason=${res.stopReason} model=${req.model} output_tokens=${res.usage?.outputTokens ?? 0}`,
      );
    }
    if (!text.trim()) {
      this.logger.warn(
        `Bedrock empty text: model=${req.model} blocks=${blocks.map((b) => Object.keys(b)[0]).join(',') || '-'}`,
      );
    }
    return {
      text,
      tokensIn: res.usage?.inputTokens ?? 0,
      tokensOut: res.usage?.outputTokens ?? 0,
      provider: this.provider,
      // The alias, not the ARN: usage rows and logs read "sonnet", and the ARN
      // carries IVY's AWS account number.
      model: req.model,
    };
  }

  private client(): BedrockRuntimeClient {
    const region = process.env.AWS_REGION?.trim() || DEFAULT_REGION;
    let client = this.clients.get(region);
    if (!client) {
      client = new BedrockRuntimeClient({ region });
      this.clients.set(region, client);
    }
    return client;
  }
}

/**
 * `sonnet` / `haiku` → the ARN in the server's env; anything else is taken as
 * a full ARN or model id. A missing env var is a named error the console shows
 * as "model", the fix being an env line rather than a key.
 */
export function resolveBedrockModel(model: string): string {
  const value = (model ?? '').trim();
  const envName = BEDROCK_MODEL_ALIASES[value.toLowerCase()];
  if (envName) {
    const arn = process.env[envName]?.trim();
    if (!arn) throw new Error(`Unknown model "${value}": ${envName} is not set on the server`);
    return arn;
  }
  if (!value) throw new Error('Unknown model: no Bedrock model or inference profile given');
  return value;
}

/**
 * Our history can hold two customer turns in a row (a retry, an unanswered
 * question) and starts wherever its window cut it. Converse takes turns that
 * alternate and open with the user: same-role neighbours become one turn with
 * several text blocks, a leading assistant turn is dropped, and system rows
 * travel in `system`, not as messages.
 */
export function toConverseMessages(messages: AiMessage[]): Message[] {
  const out: Message[] = [];
  for (const m of messages) {
    if (m.role === 'system' || !m.content?.trim()) continue;
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const last = out[out.length - 1];
    if (last && last.role === role) last.content = [...(last.content ?? []), { text: m.content }];
    else out.push({ role, content: [{ text: m.content }] });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length) throw new Error('Bedrock request has no user message');
  return out;
}

/**
 * IVY will put Bedrock Guardrails in front of the model before launch. Set
 * `BEDROCK_GUARDRAIL_ID` (and a published `BEDROCK_GUARDRAIL_VERSION`) and
 * every call carries it; unset, nothing is sent. The project's own
 * moderation runs either way.
 */
function guardrailConfig(): Pick<ConverseCommandInput, 'guardrailConfig'> {
  const id = process.env.BEDROCK_GUARDRAIL_ID?.trim();
  if (!id) return {};
  return {
    guardrailConfig: {
      guardrailIdentifier: id,
      guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION?.trim() || 'DRAFT',
    },
  };
}

/**
 * One line the engine-health classifier understands: the HTTP status picks the
 * reason (403 auth, 404 model, 429 rate limit), and a missing IAM role reads
 * "not configured" (auth). No request content.
 */
export function describeBedrockError(e: unknown): string {
  const err = (e ?? {}) as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const name = err.name || 'Error';
  const message = String(err.message ?? '').replace(/\s+/g, ' ').slice(0, 200);
  // The SDK found no credentials at all: no IAM role reachable from the container.
  if (name === 'CredentialsProviderError') return `Bedrock credentials not configured: ${message}`;
  const status = err.$metadata?.httpStatusCode ?? STATUS_BY_NAME[name];
  return `Bedrock API error ${status ?? ''} ${name}: ${message}`.replace(/\s+/g, ' ').trim();
}
