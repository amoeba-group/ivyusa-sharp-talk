import { CustomerService } from './customer.service';

/** A chainable query builder double returning fixed raw rows. */
function qbReturning(rows: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['leftJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit']) {
    qb[m] = jest.fn(() => qb);
  }
  qb.getRawMany = jest.fn(async () => rows);
  return qb;
}

function build(customer: Record<string, unknown>, opts: { convRows?: unknown[]; sessionRows?: unknown[] } = {}) {
  const audits: Record<string, unknown>[] = [];
  const convQb = qbReturning(opts.convRows ?? []);
  const sessionQb = qbReturning(opts.sessionRows ?? []);
  const svc = new CustomerService(
    {
      findOne: jest.fn(async () => customer),
      save: jest.fn(async (c: unknown) => c),
    } as never,
    {} as never,
    { isSuppressed: async () => false } as never,
    { write: jest.fn(async (a: Record<string, unknown>) => void audits.push(a)) } as never,
    { createQueryBuilder: () => convQb } as never,
    { createQueryBuilder: () => sessionQb } as never,
    {} as never,
    {} as never,
  );
  return { svc, audits, convQb };
}

describe('CustomerService.update (PLN-261027 D11)', () => {
  it('writes the changed fields, clears on blank, and audits field names only', async () => {
    const c = { id: 9, name: 'Nguyen A', phone: '+84 901', email: 'a@x.vn', memo: null, tier: 'guest' };
    const { svc, audits } = build(c);
    await svc.update(4, 9, { name: 'Nguyen A', phone: '  ', memo: 'VIP — prefers Zalo' }, 7);
    expect(c).toMatchObject({ name: 'Nguyen A', phone: null, memo: 'VIP — prefers Zalo' });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'customer.updated', target: 'customer:9', metadata: { fields: ['phone', 'memo'] } });
    expect(JSON.stringify(audits[0])).not.toContain('Zalo');
  });

  it('writes no audit row when nothing changed', async () => {
    const { svc, audits } = build({ id: 9, name: 'A', phone: null, email: null, memo: null, tier: 'guest' });
    await svc.update(4, 9, { name: 'A' }, 7);
    expect(audits).toHaveLength(0);
  });
});

describe('CustomerService.activity (PLN-261027 D10)', () => {
  it('takes the earlier of first session and first conversation, tenant-scoped', async () => {
    const { svc, convQb } = build(
      {},
      {
        convRows: [{ cid: '9', n: '3', first: '2026-10-02T14:07:00Z' }],
        sessionRows: [{ cid: '9', first: '2026-10-02T14:05:00Z' }],
      },
    );
    const out = await svc.activity(4, [9]);
    expect(out.get('9')).toMatchObject({ conversations: 3 });
    expect(out.get('9')?.firstSeenAt?.toISOString()).toBe('2026-10-02T14:05:00.000Z');
    expect(out.get('9')?.firstConversationAt?.toISOString()).toBe('2026-10-02T14:07:00.000Z');
    expect(convQb.where).toHaveBeenCalledWith('c.tenant_id = :tenantId', { tenantId: 4 });
  });

  it('returns an empty map for no ids without querying', async () => {
    const { svc, convQb } = build({});
    expect((await svc.activity(4, [])).size).toBe(0);
    expect(convQb.getRawMany).not.toHaveBeenCalled();
  });
});
