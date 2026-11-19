import { AiGatewayService } from './ai-gateway.service';
import type { AiEngine } from '../../../domain/ai-engine/entity/ai-engine.entity';

/**
 * A tenant routes a function to a Bedrock engine (PLN-261119): the gateway
 * hands it to the Bedrock adapter with no key, carries the function's effort
 * setting, and still falls back to the stub — marked degraded — when Bedrock
 * fails, so the chat hands off instead of inventing an answer.
 */
describe('AiGatewayService — Bedrock engines', () => {
  const ENGINE = { id: 9, provider: 'bedrock', name: 'Claude Sonnet 5.5 · Bedrock', model: 'sonnet', status: 'enabled', isDefault: 0, apiKeyEncrypted: null, endpoint: null } as unknown as AiEngine;

  function build(bedrockComplete: jest.Mock) {
    const settingRepo = { findOne: async () => ({ tenantId: 1, func: 'rag', engineId: 9, paramsJson: { effort: 'low', max_tokens: 900 } }) };
    const engineRepo = { findOne: async () => ENGINE, update: jest.fn(async () => undefined) };
    const stub = { provider: 'stub', complete: jest.fn(async () => ({ text: 'canned', tokensIn: 0, tokensOut: 0, provider: 'stub', model: 'stub-1' })) };
    const other = { provider: 'unused', complete: jest.fn() };
    const usage = { record: jest.fn(async () => undefined) };
    const bedrock = { provider: 'bedrock', complete: bedrockComplete };
    const gateway = new AiGatewayService(
      engineRepo as never,
      settingRepo as never,
      stub as never,
      other as never,
      other as never,
      other as never,
      usage as never,
      undefined,
      bedrock as never,
    );
    return { gateway, stub };
  }

  it('sends the function to Bedrock with the effort set for it and no key', async () => {
    const complete = jest.fn(async () => ({ text: 'Orders ship in 1–2 days.', tokensIn: 10, tokensOut: 5, provider: 'bedrock', model: 'sonnet' }));
    const { gateway } = build(complete);
    const res = await gateway.complete({ tenantId: 1, function: 'rag', messages: [{ role: 'user', content: 'When will it ship?' }] });
    expect(res.text).toBe('Orders ship in 1–2 days.');
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ model: 'sonnet', effort: 'low', maxTokens: 900, apiKey: undefined }));
  });

  it('falls back to the stub, marked degraded, when Bedrock fails', async () => {
    const complete = jest.fn(async () => {
      throw new Error('Bedrock API error 403 AccessDeniedException: not authorized');
    });
    const { gateway, stub } = build(complete);
    const res = await gateway.complete({ tenantId: 1, function: 'rag', messages: [{ role: 'user', content: 'hi' }] });
    expect(stub.complete).toHaveBeenCalled();
    expect(res.degraded).toBe(true);
  });
});
