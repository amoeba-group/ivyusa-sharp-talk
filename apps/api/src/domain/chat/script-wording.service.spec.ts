import { ScriptWordingService, withTimeout } from './script-wording.service';

/** AI wording of scripted answers (IVY PRD v1 C-02, PLN-261125-Phase5 §1.1). */
describe('ScriptWordingService', () => {
  const SCRIPT = 'Orders can be cancelled within 1 hour. Email hello@ivyusa.com for help.';
  const GOOD = 'You can cancel an order within 1 hour of placing it. For help, email hello@ivyusa.com.';

  function build(opts: { provider?: string | null; text?: string; degraded?: boolean; cached?: string | null; hang?: boolean }) {
    const store = new Map<string, string>();
    if (opts.cached !== undefined && opts.cached !== null) store.set('preset', opts.cached);
    const redis = {
      get: jest.fn(async (k: string) => (opts.cached !== undefined ? opts.cached : (store.get(k) ?? null))),
      set: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    };
    const ai = {
      resolveRouting: jest.fn(async () => ({ engine: opts.provider === null ? null : { provider: opts.provider ?? 'bedrock' } })),
      complete: jest.fn(async () => {
        if (opts.hang) return new Promise(() => undefined);
        return { text: opts.text ?? GOOD, provider: opts.provider ?? 'bedrock', degraded: opts.degraded, tokensIn: 1, tokensOut: 1, model: 'haiku' };
      }),
    };
    const svc = new ScriptWordingService(ai as never, redis as never);
    return { svc, ai, redis };
  }

  it('sends the script as written when the chat function is on the Stub, without calling the model', async () => {
    const h = build({ provider: 'stub' });
    expect(await h.svc.word(7, 'EN', 'cancel_order', SCRIPT)).toBe(SCRIPT);
    expect(h.ai.complete).not.toHaveBeenCalled();
    const none = build({ provider: null });
    expect(await none.svc.word(7, 'EN', 'cancel_order', SCRIPT)).toBe(SCRIPT);
  });

  it('uses the model’s wording when it keeps every fact, and caches it', async () => {
    const h = build({});
    expect(await h.svc.word(7, 'KO', 'cancel_order', SCRIPT)).toBe(GOOD);
    const call = h.ai.complete.mock.calls[0][0] as unknown as { function: string; feature: string; system: string; messages: Array<{ content: string }> };
    expect(call.function).toBe('chat');
    expect(call.feature).toBe('script_wording');
    expect(call.system).toMatch(/Korean/);
    // Only the script reaches the model.
    expect(call.messages).toEqual([{ role: 'user', content: SCRIPT }]);
    expect(h.redis.set).toHaveBeenCalledWith(expect.stringMatching(/^aiw:script:7:KO:/), GOOD, 43200);
  });

  it('keeps the script when the wording changes a fact, and remembers that for an hour', async () => {
    const h = build({ text: 'You can cancel an order within 2 hours. Email hello@ivyusa.com.' });
    expect(await h.svc.word(7, 'EN', 'cancel_order', SCRIPT)).toBe(SCRIPT);
    expect(h.redis.set).toHaveBeenCalledWith(expect.any(String), '\u0000', 3600);
  });

  it('keeps the script when the engine fell back to the stub or did not answer in time', async () => {
    expect(await build({ degraded: true }).svc.word(7, 'EN', 'x', SCRIPT)).toBe(SCRIPT);
    jest.useFakeTimers();
    const slow = build({ hang: true });
    const pending = slow.svc.word(7, 'EN', 'x', SCRIPT);
    await jest.advanceTimersByTimeAsync(5001);
    expect(await pending).toBe(SCRIPT);
    jest.useRealTimers();
  });

  it('answers from the cache without calling the model', async () => {
    const h = build({ cached: GOOD });
    expect(await h.svc.word(7, 'EN', 'x', SCRIPT)).toBe(GOOD);
    expect(h.ai.complete).not.toHaveBeenCalled();
    const refused = build({ cached: '\u0000' });
    expect(await refused.svc.word(7, 'EN', 'x', SCRIPT)).toBe(SCRIPT);
    expect(refused.ai.complete).not.toHaveBeenCalled();
  });

  it('never throws: a failing gateway leaves the script', async () => {
    const h = build({});
    h.ai.resolveRouting.mockRejectedValueOnce(new Error('db down'));
    expect(await h.svc.word(7, 'EN', 'x', SCRIPT)).toBe(SCRIPT);
  });

  it('withTimeout resolves null after the deadline', async () => {
    jest.useFakeTimers();
    const p = withTimeout(new Promise<string>(() => undefined), 100);
    await jest.advanceTimersByTimeAsync(101);
    expect(await p).toBeNull();
    jest.useRealTimers();
  });
});
