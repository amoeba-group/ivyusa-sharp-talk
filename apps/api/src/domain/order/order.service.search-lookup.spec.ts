import { OrderService } from './order.service';

// The blind index needs the server's key; what it returns is not under test here.
jest.mock('../../global/util/crypto.util', () => ({
  ...jest.requireActual('../../global/util/crypto.util'),
  blindIndex: (v: string) => `hash:${v.toLowerCase()}`,
}));

/**
 * PLN-261117 — console order-number search (A) and fetching one order from the
 * store when the cache does not hold it (B3): console lookup and guest lookup.
 */
describe('OrderService — order-number search and store lookup', () => {
  const cached = (id: string, orderNumber: string, customerId: number | null = 9) => ({
    id,
    tenantId: 7,
    customerId,
    orderNumber,
    statusInternal: 'paid',
    statusUi: 'Confirmed',
    total: '10.00',
    currency: 'USD',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    orderedAt: null,
  });

  function build(opts: { guestHits?: unknown[]; shopifySync?: unknown } = {}) {
    const guestHits = [...(opts.guestHits ?? [])];
    const guestParams: Record<string, unknown>[] = [];
    const qb: Record<string, unknown> = {
      innerJoin: jest.fn(() => qb),
      where: jest.fn((_c: string, p: Record<string, unknown>) => {
        guestParams.push(p);
        return qb;
      }),
      andWhere: jest.fn((_c: string, p: Record<string, unknown>) => {
        guestParams.push(p);
        return qb;
      }),
      getOne: jest.fn(async () => guestHits.shift() ?? null),
    };
    const orderRepo = {
      findAndCount: jest.fn().mockResolvedValue([[cached('1', '39891')], 1]),
      createQueryBuilder: jest.fn(() => qb),
    };
    const itemRepo = {
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
      find: jest.fn().mockResolvedValue([]),
    };
    const session = { sessionToken: 'tok', tenantId: 7, customerId: null as number | null };
    const sessionRepo = {
      findOne: jest.fn().mockResolvedValue(session),
      save: jest.fn(async (s: unknown) => s),
    };
    const redis = { incr: jest.fn().mockResolvedValue(1), set: jest.fn(), del: jest.fn() };
    const svc = new OrderService(
      orderRepo as never,
      itemRepo as never,
      {} as never, // fulfillRepo
      sessionRepo as never,
      {} as never, // customerRepo
      {} as never, // bus
      redis as never,
      {} as never, // webhookSecretService
      {} as never, // sessionService
      {} as never, // productRepo
      {} as never, // reviewRepo
      opts.shopifySync as never,
    );
    return { svc, orderRepo, sessionRepo, session, guestParams, qb };
  }

  describe('listAll with q', () => {
    const whereOf = (repo: { findAndCount: jest.Mock }) =>
      (repo.findAndCount.mock.calls[0][0] as { where: { tenantId: number; orderNumber?: { _value: string } } }).where;

    it('without q lists every order of the tenant, as before', async () => {
      const { svc, orderRepo } = build();
      await svc.listAll(7, '1', '20');
      expect(whereOf(orderRepo)).toEqual({ tenantId: 7 });
    });

    it('with q searches "contains" inside the tenant, ignoring a leading "#" and spaces', async () => {
      const { svc, orderRepo } = build();
      const res = await svc.listAll(7, '1', '20', '  #3989 ');
      const where = whereOf(orderRepo);
      expect(where.tenantId).toBe(7);
      expect(where.orderNumber?._value).toBe('%3989%');
      expect(res.items).toHaveLength(1);
    });

    it('wildcards typed by the operator match themselves, not everything', async () => {
      const { svc, orderRepo } = build();
      await svc.listAll(7, '1', '20', '%_\\');
      expect(whereOf(orderRepo).orderNumber?._value).toBe('%\\%\\_\\\\%');
    });

    it('a q of only "#" or spaces is no search at all', async () => {
      const { svc, orderRepo } = build();
      await svc.listAll(7, '1', '20', ' # ');
      expect(whereOf(orderRepo)).toEqual({ tenantId: 7 });
    });
  });

  describe('lookupFromStore (console)', () => {
    it('returns the fetched orders as list rows', async () => {
      const shopifySync = { lookupOrderByNumber: jest.fn().mockResolvedValue([cached('5', '39891')]) };
      const { svc } = build({ shopifySync });
      const res = await svc.lookupFromStore(7, '#39891');
      expect(shopifySync.lookupOrderByNumber).toHaveBeenCalledWith(7, '#39891');
      expect(res.found).toBe(1);
      expect(res.items[0]).toMatchObject({ id: '5', orderNumber: '39891' });
    });

    it('reports found: 0 when the store has no such order', async () => {
      const { svc } = build({ shopifySync: { lookupOrderByNumber: jest.fn().mockResolvedValue([]) } });
      await expect(svc.lookupFromStore(7, '1')).resolves.toEqual({ found: 0, items: [] });
    });

    it('a store that cannot be asked is an error the console can show, not "not found"', async () => {
      const { svc } = build({
        shopifySync: { lookupOrderByNumber: jest.fn().mockRejectedValue(new Error('Admin API returned 401')) },
      });
      await expect(svc.lookupFromStore(7, '1')).rejects.toMatchObject({
        errorCode: 'E5164',
      });
    });
  });

  describe('guestLookup falling back to the store', () => {
    it('an order already cached never calls the store', async () => {
      const shopifySync = { lookupOrderByNumber: jest.fn() };
      const { svc, session } = build({ guestHits: [cached('1', '39891')], shopifySync });
      await svc.guestLookup('tok', '39891', 'a@x.com');
      expect(shopifySync.lookupOrderByNumber).not.toHaveBeenCalled();
      expect(session.customerId).toBe(9);
    });

    it('a miss asks the store for that order and that email, then reads it back', async () => {
      const shopifySync = { lookupOrderByNumber: jest.fn().mockResolvedValue([cached('2', '39891')]) };
      const { svc, session, guestParams } = build({ guestHits: [null, cached('2', '39891')], shopifySync });
      const res = await svc.guestLookup('tok', '#39891', 'a@x.com');
      expect(shopifySync.lookupOrderByNumber).toHaveBeenCalledWith(7, '#39891', { email: 'a@x.com' });
      expect(session.customerId).toBe(9);
      expect(res).toMatchObject({ orderNumber: '39891' });
      // The "#" the shopper typed is not part of the stored number.
      expect(guestParams.find((p) => 'orderNumber' in p)).toEqual({ orderNumber: '39891' });
    });

    it('still "not found" when the store has nothing for that email', async () => {
      const shopifySync = { lookupOrderByNumber: jest.fn().mockResolvedValue([]) };
      const { svc, session } = build({ shopifySync });
      await expect(svc.guestLookup('tok', '1', 'a@x.com')).rejects.toMatchObject({
        errorCode: 'E5001',
      });
      expect(session.customerId).toBeNull();
    });

    it('a store failure is "not found" too — the guest learns nothing from it', async () => {
      const shopifySync = { lookupOrderByNumber: jest.fn().mockRejectedValue(new Error('boom')) };
      const { svc } = build({ shopifySync });
      await expect(svc.guestLookup('tok', '1', 'a@x.com')).rejects.toMatchObject({
        errorCode: 'E5001',
      });
    });
  });
});
