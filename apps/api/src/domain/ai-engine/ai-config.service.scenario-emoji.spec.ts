import { AiConfigService } from './ai-config.service';

/**
 * Scenario buttons on save (ivy-docs T08 D1 + BUG-022): the rebuild in
 * `sanitize()` keeps only the fields it lists, so a field it forgets is
 * silently dropped on every console save — which is what happened to
 * `message`. `emoji` is new and must survive the same way.
 */
describe('AiConfigService — scenario button emoji + message survive a save', () => {
  function build() {
    let row: Record<string, unknown> | null = null;
    const configRepo = {
      findOne: jest.fn(async () => row),
      create: jest.fn((v: Record<string, unknown>) => ({ ...v })),
      save: jest.fn(async (v: Record<string, unknown>) => (row = v)),
    };
    const svc = new AiConfigService(
      configRepo as never,
      { findOne: jest.fn(async () => null) } as never,
      { findOne: jest.fn(async () => null) } as never,
      { findOne: jest.fn(async () => ({ id: 1 })) } as never,
      { available: () => false, get: jest.fn(), set: jest.fn(), del: jest.fn() } as never,
      { record: jest.fn() } as never,
      {} as never,
    );
    return { svc, saved: () => row?.scenarioButtons as Array<Record<string, unknown>> };
  }

  it('keeps a trimmed emoji and the button question', async () => {
    const { svc, saved } = build();
    await svc.upsertConfig(1, {
      scenarioButtons: [
        {
          id: 'payment_check',
          label: { EN: 'Payment check', KO: '결제 확인' },
          action: 'message',
          enabled: true,
          emoji: ' 💰 ',
          message: { EN: ' Can you check my payment? ' },
        },
      ],
    });
    expect(saved()[0]).toMatchObject({ emoji: '💰', message: { EN: 'Can you check my payment?' } });
  });

  it('a question longer than a label (60) is kept up to 300', async () => {
    const { svc, saved } = build();
    const long = 'Q'.repeat(120);
    await svc.upsertConfig(1, {
      scenarioButtons: [{ id: 'q', label: 'Ask', action: 'message', enabled: true, message: long }],
    });
    expect(saved()[0].message).toBe(long);
  });

  it('a blank emoji or question is not stored; a long emoji string is capped on whole characters', async () => {
    const { svc, saved } = build();
    await svc.upsertConfig(1, {
      scenarioButtons: [
        { id: 'a', label: 'A', action: 'message', enabled: true, emoji: '   ', message: { EN: '  ' } },
        { id: 'b', label: 'B', action: 'message', enabled: true, emoji: '🤝🏻'.repeat(10) },
        { id: 'c', label: 'C', action: 'message', enabled: true, emoji: 'a' + '💰'.repeat(10) },
      ],
    });
    expect(saved()[0]).not.toHaveProperty('emoji');
    expect(saved()[0]).not.toHaveProperty('message');
    const capped = saved()[1].emoji as string;
    expect(capped.length).toBeLessThanOrEqual(16);
    expect(capped).toBe('🤝🏻'.repeat(4));
    // An odd offset: 'a' + 7 × 💰 = 15 units; an 8th would make 17, and a
    // plain slice(0, 16) would leave half of it behind.
    const odd = saved()[2].emoji as string;
    expect(odd).toBe('a' + '💰'.repeat(7));
    expect(/[\uD800-\uDBFF]$/.test(odd)).toBe(false);
  });

  it('a skin-tone emoji (a surrogate pair + modifier) survives whole', async () => {
    const { svc, saved } = build();
    await svc.upsertConfig(1, {
      scenarioButtons: [{ id: 'c', label: 'Contact Support', action: 'contact_support', enabled: true, emoji: '🤝🏻' }],
    });
    expect(saved()[0].emoji).toBe('🤝🏻');
  });
});
