import { CustomerPlatformLinkService, PLATFORM } from './customer-platform-link.service';

function build(existing: Record<string, unknown> | null, insertError?: unknown) {
  const repo = {
    findOne: jest.fn(async () => existing),
    save: jest.fn(async (r: unknown) => r),
    create: jest.fn((r: unknown) => r),
    insert: jest.fn(async () => {
      if (insertError) throw insertError;
    }),
    update: jest.fn(async () => undefined),
  };
  return { svc: new CustomerPlatformLinkService(repo as never), repo };
}

describe('CustomerPlatformLinkService.link (PLN-261027 D12)', () => {
  it('inserts a first sighting with first = last seen', async () => {
    const { svc, repo } = build(null);
    await svc.link(4, 9, PLATFORM.SHOPIFY, 7741, ' Nguyen A ');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { tenantId: 4, provider: 'shopify', externalId: '7741' } });
    const row = (repo.insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row).toMatchObject({ tenantId: 4, customerId: 9, provider: 'shopify', externalId: '7741', displayName: 'Nguyen A' });
    expect(row.firstSeenAt).toEqual(row.lastSeenAt);
  });

  it('keeps first seen on a repeat, follows a merge to another customer, keeps the old name on blank', async () => {
    const first = new Date('2026-09-30T00:00:00Z');
    const row = { id: 1, tenantId: 4, customerId: 3, displayName: 'Old', firstSeenAt: first, lastSeenAt: first };
    const { svc, repo } = build(row);
    await svc.link(4, 9, PLATFORM.IDENTIFY, '88123', '');
    expect(repo.save).toHaveBeenCalled();
    expect(row).toMatchObject({ customerId: 9, displayName: 'Old', firstSeenAt: first });
    expect(row.lastSeenAt.getTime()).toBeGreaterThan(first.getTime());
  });

  it('treats a lost insert race as a sighting, and skips an empty id', async () => {
    const { svc, repo } = build(null, { code: 'ER_DUP_ENTRY' });
    await svc.link(4, 9, PLATFORM.CAFE24, 'member1');
    expect(repo.update).toHaveBeenCalledWith(
      { tenantId: 4, provider: 'cafe24', externalId: 'member1' },
      expect.objectContaining({ customerId: 9 }),
    );
    await svc.link(4, 9, PLATFORM.ODOO, null);
    expect(repo.findOne).toHaveBeenCalledTimes(1);
  });

  it('never throws into the sync that called it', async () => {
    const { svc } = build(null, new Error('db down'));
    await expect(svc.link(4, 9, PLATFORM.HARAVAN, 5)).resolves.toBeUndefined();
  });
});
