import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { AuditService } from '../audit/audit.service';
import { AssetUpload, TenantAssetService } from '../tenant-asset/tenant-asset.service';
import { TENANT_ASSET_AREA, TENANT_ASSET_KIND } from '../tenant-asset/entity/tenant-asset.entity';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';

/**
 * A staff member's own profile — display name and icon (PLN-261028 D5).
 * Every route acts on the caller only; nobody edits someone else's face.
 */
@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly assets: TenantAssetService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: number, userId: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new BusinessException(ERROR_CODE.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
    return user;
  }

  async updateDisplayName(tenantId: number, userId: number, displayName: string): Promise<User> {
    const user = await this.get(tenantId, userId);
    const next = displayName.trim() || null;
    if (next === user.name) return user;
    const previous = user.name;
    user.name = next;
    await this.userRepo.update({ id: userId, tenantId }, { name: next });
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'user.profile_updated',
      target: `user:${userId}`,
      metadata: { field: 'name', previous, next },
    });
    return user;
  }

  async setAvatar(tenantId: number, userId: number, file: AssetUpload): Promise<User> {
    const user = await this.get(tenantId, userId);
    const row = await this.assets.store(
      tenantId,
      { area: TENANT_ASSET_AREA.PROFILE, kind: TENANT_ASSET_KIND.AVATAR, label: `user:${userId}` },
      file,
      { userId },
    );
    const previous = user.avatarAssetUuid;
    user.avatarAssetUuid = row.uuid;
    await this.userRepo.update({ id: userId, tenantId }, { avatarAssetUuid: row.uuid });
    await this.dropAsset(tenantId, userId, previous);
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'user.profile_updated',
      target: `user:${userId}`,
      metadata: { field: 'avatar', previous, next: row.uuid },
    });
    return user;
  }

  async clearAvatar(tenantId: number, userId: number): Promise<User> {
    const user = await this.get(tenantId, userId);
    const previous = user.avatarAssetUuid;
    if (!previous) return user;
    user.avatarAssetUuid = null;
    await this.userRepo.update({ id: userId, tenantId }, { avatarAssetUuid: null });
    await this.dropAsset(tenantId, userId, previous);
    await this.audit.write({
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'user.profile_updated',
      target: `user:${userId}`,
      metadata: { field: 'avatar', previous, next: null },
    });
    return user;
  }

  /** The replaced icon goes; a file already gone is the desired end state. */
  private async dropAsset(tenantId: number, userId: number, uuid: string | null): Promise<void> {
    if (!uuid) return;
    try {
      await this.assets.remove(tenantId, uuid, { userId });
    } catch (e) {
      this.logger.warn(`old avatar ${uuid} not removed (user ${userId}): ${(e as Error).message}`);
    }
  }
}
