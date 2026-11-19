import { TENANT_PROVIDERS, TenantAiEngineService, runEngineTest } from './tenant-ai-engine.service';
import { AiEngine } from './entity/ai-engine.entity';

/**
 * A Bedrock engine signs in with the server's IAM role (PLN-261119): no key is
 * its normal state, so it is created enabled and its connection test really
 * calls Bedrock instead of stopping at "no API key".
 */
describe('tenant AI engines — Bedrock needs no key', () => {
  it('is offered to tenants', () => {
    expect(TENANT_PROVIDERS).toContain('bedrock');
  });

  it('is created enabled without a key; Anthropic without one is still parked', async () => {
    const repo = { create: (e: Partial<AiEngine>) => e, save: jest.fn(async (e: AiEngine) => e) };
    const svc = new TenantAiEngineService(repo as never, {} as never, {} as never);
    const bedrock = await svc.create(7, { provider: 'bedrock', name: 'Claude Sonnet 5.5 · Bedrock', model: 'sonnet' });
    expect(bedrock).toMatchObject({ provider: 'bedrock', status: 'enabled', apiKeyEncrypted: null, tenantId: 7 });
    const anthropic = await svc.create(7, { provider: 'anthropic', name: 'Claude', model: 'claude-opus-5-5' });
    expect(anthropic.status).toBe('disabled');
  });

  it('stays enabled when edited without a key', async () => {
    const engine = { id: 3, tenantId: 7, provider: 'bedrock', model: 'sonnet', apiKeyEncrypted: null, status: 'enabled' } as unknown as AiEngine;
    const repo = { findOne: jest.fn(async () => engine), save: jest.fn(async (e: AiEngine) => e) };
    const svc = new TenantAiEngineService(repo as never, {} as never, {} as never);
    const saved = await svc.update(7, 3, { model: 'haiku' });
    expect(saved).toMatchObject({ model: 'haiku', status: 'enabled' });
  });

  it('the connection test calls Bedrock with no key', async () => {
    const complete = jest.fn(async () => ({ text: 'pong', tokensIn: 1, tokensOut: 1, provider: 'bedrock', model: 'sonnet' }));
    const gateway = { adapterFor: () => ({ provider: 'bedrock', complete }), recordHealth: jest.fn() };
    const engine = { id: 3, provider: 'bedrock', model: 'sonnet', endpoint: null, apiKeyEncrypted: null } as unknown as AiEngine;
    const res = await runEngineTest(gateway as never, engine);
    expect(res.ok).toBe(true);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ model: 'sonnet', apiKey: undefined }));
  });

  it('an Anthropic engine without a key is still refused before any call', async () => {
    const complete = jest.fn();
    const gateway = { adapterFor: () => ({ provider: 'anthropic', complete }), recordHealth: jest.fn() };
    const engine = { id: 4, provider: 'anthropic', model: 'claude-opus-5-5', endpoint: null, apiKeyEncrypted: null } as unknown as AiEngine;
    const res = await runEngineTest(gateway as never, engine);
    expect(res).toMatchObject({ ok: false, reason: 'auth', detail: 'no API key' });
    expect(complete).not.toHaveBeenCalled();
  });
});
