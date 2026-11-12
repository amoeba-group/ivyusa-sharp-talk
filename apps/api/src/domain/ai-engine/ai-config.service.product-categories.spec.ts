import { AiConfigService } from './ai-config.service';
import type { ScenarioButton } from './entity/tenant-ai-config.entity';

/**
 * Product Help categories (ivy-docs T10 D2) ride on the Product Help scenario
 * button. `sanitize()` rebuilds every button from the fields it lists, so a
 * field it forgets vanishes on every console save (BUG-022) — these must not.
 */
describe('AiConfigService — Product Help categories', () => {
  function build(stored?: ScenarioButton[], sessionLanguage = 'KO') {
    let row: Record<string, unknown> | null = stored ? { tenantId: 1, scenarioButtons: stored } : null;
    const session = { id: 9, tenantId: 1, aiAgentId: null, language: sessionLanguage, sessionToken: 'tok' };
    const configRepo = {
      findOne: jest.fn(async () => row),
      create: jest.fn((v: Record<string, unknown>) => ({ ...v })),
      save: jest.fn(async (v: Record<string, unknown>) => (row = v)),
    };
    const svc = new AiConfigService(
      configRepo as never,
      { findOne: jest.fn(async () => null) } as never,
      { findOne: jest.fn(async () => session) } as never,
      { findOne: jest.fn(async () => ({ id: 1 })) } as never,
      { available: () => false, get: jest.fn(), set: jest.fn(), del: jest.fn() } as never,
      { record: jest.fn() } as never,
      {} as never,
    );
    return { svc, saved: () => row?.scenarioButtons as Array<Record<string, unknown>> };
  }

  const helpButton = (categories: unknown, action = 'product_help') =>
    ({ id: 'product_inquiry', label: 'Product inquiry', action, enabled: true, categories }) as unknown as ScenarioButton;

  it('keeps categories on a save, handles normalised from a bare handle or a store URL', async () => {
    const { svc, saved } = build();
    await svc.upsertConfig(1, {
      scenarioButtons: [
        helpButton([
          { id: ' Nails ', label: { EN: ' Nails ', KO: '네일' } },
          { id: 'https://ivyusa.com/collections/k-beauty?sort_by=best-selling', label: 'K-Beauty' },
        ]),
      ],
    });
    expect(saved()[0].categories).toEqual([
      { id: 'nails', label: { EN: 'Nails', KO: '네일' } },
      { id: 'k-beauty', label: 'K-Beauty' },
    ]);
  });

  it('drops rows without a usable handle or name, repeats, and anything past 20', async () => {
    const { svc, saved } = build();
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `c-${i}`, label: `C${i}` }));
    await svc.upsertConfig(1, {
      scenarioButtons: [
        helpButton([
          { id: 'nails', label: 'Nails' },
          { id: 'NAILS', label: 'Again' },
          { id: 'two words', label: 'Bad handle' },
          { id: 'hair', label: { EN: '  ' } },
          { id: 'lashes', label: { EN: 7, KO: '속눈썹' } },
          null,
          ...many,
        ]),
      ],
    });
    const cats = saved()[0].categories as Array<{ id: string }>;
    expect(cats.slice(0, 2)).toEqual([
      { id: 'nails', label: 'Nails' },
      { id: 'lashes', label: { KO: '속눈썹' } },
    ]);
    expect(cats).toHaveLength(20);
  });

  it('stores nothing for an empty list, and never on a button that is not Product Help', async () => {
    const { svc, saved } = build();
    await svc.upsertConfig(1, {
      scenarioButtons: [helpButton([]), { ...helpButton([{ id: 'nails', label: 'Nails' }], 'message'), id: 'msg' }],
    });
    expect(saved()[0]).not.toHaveProperty('categories');
    expect(saved()[1]).not.toHaveProperty('categories');
  });

  it('serves the names in the session language, a nameless one left out', async () => {
    const { svc } = build([
      helpButton([
        { id: 'nails', label: { EN: 'Nails', KO: '네일' } },
        { id: 'hair', label: 'Hair' },
      ]),
      { id: 'faq', label: 'FAQ', action: 'message', enabled: true },
    ]);
    const res = await svc.getScenarioForSession('tok');
    expect(res.scenarioButtons[0].categories).toEqual([
      { id: 'nails', label: '네일' },
      { id: 'hair', label: 'Hair' },
    ]);
    expect(res.scenarioButtons[1].categories).toBeUndefined();
  });
});
