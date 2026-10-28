import { User } from './entity/user.entity';
import { MyOrg, MyProfileResponse } from './dto/response/user-profile.response';
import { avatarRef } from './staff-avatar.util';

export class UserProfileMapper {
  static toMyProfile(u: User, org: MyOrg): MyProfileResponse {
    return {
      ...org,
      email: u.email,
      displayName: u.name ?? null,
      avatar: avatarRef(u.avatarAssetUuid),
    };
  }
}
