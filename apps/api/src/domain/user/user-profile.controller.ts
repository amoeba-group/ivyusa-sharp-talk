import { Body, Controller, Delete, Get, HttpStatus, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Principal } from '@sharptalk/types';
import { CurrentUser } from '../../global/decorator/current-user.decorator';
import { BusinessException } from '../../global/exception/business.exception';
import { ERROR_CODE } from '../../global/constant/error-code.constant';
import { decodeUploadName } from '../../global/util/upload-name.util';
import { AssetUpload } from '../tenant-asset/tenant-asset.service';
import { asTenantUser } from './user-principal.util';
import { UserProfileService } from './user-profile.service';
import { UpdateMyProfileRequest } from './dto/request/user-profile.request';
import { UserProfileMapper } from './user-profile.mapper';

/**
 * The signed-in staff member's own profile (PLN-261028-Agent-Profile-Avatar D5).
 * No menu or rank gate: everyone may set their own name and icon, and only theirs.
 */
@ApiTags('Users')
@Controller('users/me')
export class UserProfileController {
  constructor(private readonly profile: UserProfileService) {}

  @Get('profile')
  @ApiOperation({ summary: 'My display name and profile icon' })
  async get(@CurrentUser() user: Principal) {
    const me = asTenantUser(user);
    return UserProfileMapper.toMyProfile(await this.profile.get(me.tenantId, Number(me.userId)));
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Set my display name (shown to customers beside my replies)' })
  async update(@CurrentUser() user: Principal, @Body() body: UpdateMyProfileRequest) {
    const me = asTenantUser(user);
    return UserProfileMapper.toMyProfile(
      await this.profile.updateDisplayName(me.tenantId, Number(me.userId), body.display_name),
    );
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload my profile icon (PNG/JPG/WEBP; cropped square, 256px)' })
  async upload(@CurrentUser() user: Principal, @UploadedFile() file?: AssetUpload) {
    const me = asTenantUser(user);
    if (!file) throw new BusinessException(ERROR_CODE.VALIDATION_FAILED, HttpStatus.BAD_REQUEST);
    const saved = await this.profile.setAvatar(me.tenantId, Number(me.userId), {
      ...file,
      originalname: decodeUploadName(file.originalname),
    });
    return UserProfileMapper.toMyProfile(saved);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove my profile icon' })
  async remove(@CurrentUser() user: Principal) {
    const me = asTenantUser(user);
    return UserProfileMapper.toMyProfile(await this.profile.clearAvatar(me.tenantId, Number(me.userId)));
  }
}
