import { UserProfileService } from './user-profile.service';
import { UserProfileMapper } from './user-profile.mapper';
import { staffAvatars } from './staff-avatar.util';
import { User } from './entity/user.entity';

/** A staff member's own display name and icon (PLN-261028-Agent-Profile-Avatar). */
describe('UserProfileService', () => {
  let user: User;
  let userRepo: { findOne: jest.Mock; update: jest.Mock; find: jest.Mock };
  let assets: { store: jest.Mock; remove: jest.Mock };
  let audit: { write: jest.Mock };
  let svc: UserProfileService;

  beforeEach(() => {
    user = { id: 5, tenantId: 2, email: 'anh@go2joy.vn', name: null, avatarAssetUuid: null } as User;
    userRepo = {
      findOne: jest.fn(async ({ where }) => (where.id === 5 && where.tenantId === 2 ? { ...user } : null)),
      update: jest.fn(async (_w, patch) => Object.assign(user, patch)),
      find: jest.fn(),
    };
    assets = {
      store: jest.fn(async () => ({ uuid: 'new-uuid' })),
      remove: jest.fn(async () => undefined),
    };
    audit = { write: jest.fn() };
    svc = new UserProfileService(userRepo as never, assets as never, audit as never);
  });

  const file = { originalname: 'me.jpg', mimetype: 'image/jpeg', size: 3, buffer: Buffer.from([0xff, 0xd8, 0xff]) };

  it('stores the icon in the profile area and points the user at it', async () => {
    const saved = await svc.setAvatar(2, 5, file);
    expect(assets.store).toHaveBeenCalledWith(
      2,
      { area: 'profile', kind: 'avatar', label: 'user:5' },
      file,
      { userId: 5 },
    );
    expect(userRepo.update).toHaveBeenCalledWith({ id: 5, tenantId: 2 }, { avatarAssetUuid: 'new-uuid' });
    expect(UserProfileMapper.toMyProfile(saved, { unit: null, labels: [] }).avatar).toEqual({ uuid: 'new-uuid', version: 1 });
    expect(assets.remove).not.toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.profile_updated', target: 'user:5', metadata: expect.objectContaining({ field: 'avatar' }) }),
    );
  });

  it('removes the replaced icon, and a failed removal does not fail the upload', async () => {
    user.avatarAssetUuid = 'old-uuid';
    assets.remove.mockRejectedValueOnce(new Error('gone'));
    await svc.setAvatar(2, 5, file);
    expect(assets.remove).toHaveBeenCalledWith(2, 'old-uuid', { userId: 5 });
    expect(user.avatarAssetUuid).toBe('new-uuid');
  });

  it('clears the icon; clearing nothing writes nothing', async () => {
    await svc.clearAvatar(2, 5);
    expect(userRepo.update).not.toHaveBeenCalled();
    user.avatarAssetUuid = 'old-uuid';
    const saved = await svc.clearAvatar(2, 5);
    expect(userRepo.update).toHaveBeenCalledWith({ id: 5, tenantId: 2 }, { avatarAssetUuid: null });
    expect(assets.remove).toHaveBeenCalledWith(2, 'old-uuid', { userId: 5 });
    expect(saved.avatarAssetUuid).toBeNull();
  });

  it('trims the display name; blank clears it; an unchanged name is not audited', async () => {
    await svc.updateDisplayName(2, 5, '  Hoang Anh ');
    expect(userRepo.update).toHaveBeenLastCalledWith({ id: 5, tenantId: 2 }, { name: 'Hoang Anh' });
    audit.write.mockClear();
    await svc.updateDisplayName(2, 5, 'Hoang Anh');
    expect(audit.write).not.toHaveBeenCalled();
    await svc.updateDisplayName(2, 5, '   ');
    expect(userRepo.update).toHaveBeenLastCalledWith({ id: 5, tenantId: 2 }, { name: null });
  });

  it('never reaches another tenant’s user', async () => {
    await expect(svc.setAvatar(3, 5, file)).rejects.toMatchObject({ errorCode: 'E5002' });
    expect(assets.store).not.toHaveBeenCalled();
  });
});

/** Team and job labels on My Page, by name (PLN-261028-MyPage-Team-Labels). */
describe('UserProfileService.org', () => {
  const me = { id: 5, tenantId: 2, unitId: 9 } as User;
  function make(unit: unknown, links: unknown[], labels: unknown[]) {
    const unitRepo = { findOne: jest.fn(async () => unit) };
    const userLabelRepo = { find: jest.fn(async () => links) };
    const labelRepo = { find: jest.fn(async () => labels) };
    const svc = new UserProfileService(
      {} as never,
      {} as never,
      {} as never,
      unitRepo as never,
      labelRepo as never,
      userLabelRepo as never,
    );
    return { svc, unitRepo, userLabelRepo, labelRepo };
  }

  it('returns the team and label names, scoped to the user’s tenant', async () => {
    const { svc, unitRepo, labelRepo } = make(
      { id: '9', name: 'CS 1팀' },
      [{ userId: 5, jobLabelId: 3 }, { userId: 5, jobLabelId: 4 }],
      [{ code: 'consult', name: '상담' }, { code: 'accounting', name: '회계' }],
    );
    expect(await svc.org(me)).toEqual({
      unit: { id: '9', name: 'CS 1팀' },
      labels: [{ code: 'consult', name: '상담' }, { code: 'accounting', name: '회계' }],
    });
    expect(unitRepo.findOne).toHaveBeenCalledWith({ where: { id: 9, tenantId: 2 } });
    expect(labelRepo.find.mock.calls[0][0].where.tenantId).toBe(2);
  });

  it('no team, no labels → null and an empty list, without asking for labels', async () => {
    const { svc, unitRepo, labelRepo } = make(null, [], []);
    expect(await svc.org({ ...me, unitId: null } as User)).toEqual({ unit: null, labels: [] });
    expect(unitRepo.findOne).not.toHaveBeenCalled();
    expect(labelRepo.find).not.toHaveBeenCalled();
  });
});

describe('staffAvatars', () => {
  it('maps agent senders with an icon, one query, and skips everyone else', async () => {
    const find = jest.fn(async () => [
      { id: '5', avatarAssetUuid: 'u5' },
      { id: '6', avatarAssetUuid: null },
    ]);
    const map = await staffAvatars({ find } as never, [
      { senderType: 'agent', senderId: 5 },
      { senderType: 'agent', senderId: 5 },
      { senderType: 'agent', senderId: 6 },
      { senderType: 'ai', senderId: null },
      { senderType: 'user', senderId: 9 },
    ]);
    expect(find).toHaveBeenCalledTimes(1);
    expect([...map.entries()]).toEqual([['5', { uuid: 'u5', version: 1 }]]);
  });

  it('asks nothing when no agent wrote', async () => {
    const find = jest.fn();
    expect((await staffAvatars({ find } as never, [{ senderType: 'ai', senderId: null }])).size).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });
});
