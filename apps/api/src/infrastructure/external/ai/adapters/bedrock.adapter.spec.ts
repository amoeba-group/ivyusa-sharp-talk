const mockSend = jest.fn();
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation((config: unknown) => ({ config, send: mockSend })),
  ConverseCommand: jest.fn().mockImplementation((input: unknown) => ({ input })),
}));

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import {
  BEDROCK_MIN_MAX_TOKENS,
  BedrockAdapter,
  describeBedrockError,
  resolveBedrockModel,
  toConverseMessages,
} from './bedrock.adapter';
import { classifyEngineFailure } from '../engine-health';

/**
 * Claude on IVY's Bedrock through Converse (PLN-261119). The SDK is replaced:
 * these tests pin what is sent and how answers and errors come back, and never
 * reach AWS.
 */
const SONNET_ARN = 'arn:aws:bedrock:us-east-1:000000000000:application-inference-profile/sonnet-test';
const HAIKU_ARN = 'arn:aws:bedrock:us-east-1:000000000000:application-inference-profile/haiku-test';
const ENV_KEYS = [
  'AWS_REGION',
  'BEDROCK_SONNET_MODEL_ARN',
  'BEDROCK_HAIKU_MODEL_ARN',
  'BEDROCK_GUARDRAIL_ID',
  'BEDROCK_GUARDRAIL_VERSION',
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.BEDROCK_SONNET_MODEL_ARN = SONNET_ARN;
  process.env.BEDROCK_HAIKU_MODEL_ARN = HAIKU_ARN;
  mockSend.mockReset();
  (BedrockRuntimeClient as unknown as jest.Mock).mockClear();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const reply = (over: Record<string, unknown> = {}) => ({
  output: { message: { role: 'assistant', content: [{ text: 'Orders ship in 1–2 days.' }] } },
  stopReason: 'end_turn',
  usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
  ...over,
});
const sentInput = () => (mockSend.mock.calls[0][0] as { input: Record<string, any> }).input;

describe('BedrockAdapter.complete', () => {
  it('calls the Sonnet inference profile from the env, with no temperature and room to think', async () => {
    mockSend.mockResolvedValue(reply());
    const res = await new BedrockAdapter().complete({
      model: 'sonnet',
      system: 'You are IVY support.',
      messages: [{ role: 'user', content: 'When will my order ship?' }],
      temperature: 0.3,
      maxTokens: 600,
    });
    const input = sentInput();
    expect(input.modelId).toBe(SONNET_ARN);
    expect(input.system).toEqual([{ text: 'You are IVY support.' }]);
    expect(input.messages).toEqual([{ role: 'user', content: [{ text: 'When will my order ship?' }] }]);
    // Sonnet 5.5 / Haiku 5.5 reject a non-default temperature: never sent.
    expect(input.inferenceConfig).toEqual({ maxTokens: BEDROCK_MIN_MAX_TOKENS });
    expect(input).not.toHaveProperty('additionalModelRequestFields');
    expect(input).not.toHaveProperty('guardrailConfig');
    expect(res).toEqual({ text: 'Orders ship in 1–2 days.', tokensIn: 120, tokensOut: 30, provider: 'bedrock', model: 'sonnet' });
  });

  it('keeps a cap above the minimum as asked', async () => {
    mockSend.mockResolvedValue(reply());
    await new BedrockAdapter().complete({ model: 'haiku', messages: [{ role: 'user', content: 'hi' }], maxTokens: 8000 });
    expect(sentInput().modelId).toBe(HAIKU_ARN);
    expect(sentInput().inferenceConfig).toEqual({ maxTokens: 8000 });
  });

  it('passes a known effort level to Claude, and drops anything else', async () => {
    mockSend.mockResolvedValue(reply());
    const adapter = new BedrockAdapter();
    await adapter.complete({ model: 'sonnet', messages: [{ role: 'user', content: 'hi' }], effort: 'low' });
    expect(sentInput().additionalModelRequestFields).toEqual({ output_config: { effort: 'low' } });
    mockSend.mockClear();
    await adapter.complete({ model: 'sonnet', messages: [{ role: 'user', content: 'hi' }], effort: 'turbo' });
    expect(sentInput()).not.toHaveProperty('additionalModelRequestFields');
  });

  it('sends the guardrail only once IVY has set one', async () => {
    mockSend.mockResolvedValue(reply());
    process.env.BEDROCK_GUARDRAIL_ID = 'gr-123';
    process.env.BEDROCK_GUARDRAIL_VERSION = '2';
    await new BedrockAdapter().complete({ model: 'sonnet', messages: [{ role: 'user', content: 'hi' }] });
    expect(sentInput().guardrailConfig).toEqual({ guardrailIdentifier: 'gr-123', guardrailVersion: '2' });
  });

  it('returns the text blocks only — thinking is not the answer', async () => {
    mockSend.mockResolvedValue(
      reply({
        output: {
          message: {
            role: 'assistant',
            content: [{ reasoningContent: { reasoningText: { text: 'let me think' } } }, { text: 'Hello' }, { text: ' there' }],
          },
        },
      }),
    );
    const res = await new BedrockAdapter().complete({ model: 'sonnet', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.text).toBe('Hello there');
  });

  it('uses the region from the env, us-east-1 when unset', async () => {
    mockSend.mockResolvedValue(reply());
    await new BedrockAdapter().complete({ model: 'sonnet', messages: [{ role: 'user', content: 'hi' }] });
    expect((BedrockRuntimeClient as unknown as jest.Mock).mock.calls[0][0]).toEqual({ region: 'us-east-1' });
    process.env.AWS_REGION = 'us-west-2';
    await new BedrockAdapter().complete({ model: 'sonnet', messages: [{ role: 'user', content: 'hi' }] });
    expect((BedrockRuntimeClient as unknown as jest.Mock).mock.calls[1][0]).toEqual({ region: 'us-west-2' });
  });

  it('turns an AWS error into a line the engine health reads correctly', async () => {
    const awsError = (name: string, message: string, status?: number) =>
      Object.assign(new Error(message), { name, ...(status ? { $metadata: { httpStatusCode: status } } : {}) });
    const cases: Array<[Error, string]> = [
      [awsError('AccessDeniedException', 'not authorized to perform: bedrock:InvokeModel', 403), 'auth'],
      [awsError('ThrottlingException', 'Too many requests, please wait', 429), 'rate_limit'],
      [awsError('ValidationException', 'The provided model identifier is invalid.', 400), 'model'],
      [awsError('ResourceNotFoundException', 'Model not found'), 'model'],
      [awsError('CredentialsProviderError', 'Could not load credentials from any providers'), 'auth'],
    ];
    for (const [error, reason] of cases) {
      mockSend.mockRejectedValueOnce(error);
      const thrown = await new BedrockAdapter()
        .complete({ model: 'sonnet', messages: [{ role: 'user', content: 'hi' }] })
        .catch((e: Error) => e);
      expect(thrown).toBeInstanceOf(Error);
      expect(classifyEngineFailure((thrown as Error).message)).toBe(reason);
    }
  });
});

describe('resolveBedrockModel', () => {
  it('maps the aliases to the env ARNs and takes anything else as given', () => {
    expect(resolveBedrockModel('sonnet')).toBe(SONNET_ARN);
    expect(resolveBedrockModel(' Haiku ')).toBe(HAIKU_ARN);
    expect(resolveBedrockModel(SONNET_ARN)).toBe(SONNET_ARN);
  });

  it('names the missing env line, as a model problem', () => {
    delete process.env.BEDROCK_SONNET_MODEL_ARN;
    expect(() => resolveBedrockModel('sonnet')).toThrow('BEDROCK_SONNET_MODEL_ARN is not set on the server');
    try {
      resolveBedrockModel('sonnet');
    } catch (e) {
      expect(classifyEngineFailure((e as Error).message)).toBe('model');
    }
  });
});

describe('toConverseMessages', () => {
  it('merges same-role neighbours, drops system rows and a leading assistant turn', () => {
    expect(
      toConverseMessages([
        { role: 'assistant', content: 'Welcome!' },
        { role: 'system', content: 'ignored here' },
        { role: 'user', content: 'Hi' },
        { role: 'user', content: 'Are you there?' },
        { role: 'assistant', content: 'Yes.' },
        { role: 'user', content: '' },
      ]),
    ).toEqual([
      { role: 'user', content: [{ text: 'Hi' }, { text: 'Are you there?' }] },
      { role: 'assistant', content: [{ text: 'Yes.' }] },
    ]);
  });

  it('refuses a request with nothing from the user', () => {
    expect(() => toConverseMessages([{ role: 'assistant', content: 'hello' }])).toThrow('no user message');
  });
});

describe('describeBedrockError', () => {
  it('carries no more than a 200-character message on one line', () => {
    const line = describeBedrockError(Object.assign(new Error(`a\nb ${'x'.repeat(400)}`), { name: 'ValidationException' }));
    expect(line).not.toContain('\n');
    expect(line.startsWith('Bedrock API error 400 ValidationException: a b')).toBe(true);
    expect(line.length).toBeLessThan(260);
  });
});
