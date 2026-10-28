import { User } from './entity/user.entity';
import { MyProfileResponse } from './dto/response/user-profile.response';
import { avatarRef } from './staff-avatar.util';

export class UserProfileMapper {
  static toMyProfile(u: User): MyProfileResponse {
    return {
      email: u.email,
      displayName: u.name ?? null,
      avatar: avatarRef(u.avatarAssetUuid),
    };
  }
}
