import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

class UpdateUserPreferencesDto {
  @IsString()
  @IsOptional()
  selected_city?: string;

  @IsString()
  @IsOptional()
  selected_state?: string;

  @IsBoolean()
  @IsOptional()
  location_permission_granted?: boolean;
}

class RequestContactChangeDto {
  @IsString()
  @IsNotEmpty()
  new_identifier!: string;

  @IsEnum(['phone', 'email'])
  type!: 'phone' | 'email';
}

class VerifyContactChangeDto {
  @IsString()
  @IsNotEmpty()
  new_identifier!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp!: string;

  @IsEnum(['phone', 'email'])
  type!: 'phone' | 'email';
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile and stats (no PII exposed)' })
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update private profile details' })
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/contact-change/request')
  @ApiOperation({ summary: 'Request OTP to verify a new phone or email contact identifier' })
  requestContactChange(
    @CurrentUser() user: RequestUser,
    @Body() dto: RequestContactChangeDto,
  ) {
    return this.usersService.requestContactChange(user.id, dto.new_identifier, dto.type);
  }

  @Post('me/contact-change/verify')
  @ApiOperation({ summary: 'Verify OTP and finalize changing contact identifier' })
  verifyContactChange(
    @CurrentUser() user: RequestUser,
    @Body() dto: VerifyContactChangeDto,
  ) {
    return this.usersService.verifyContactChange(
      user.id,
      dto.new_identifier,
      dto.otp,
      dto.type,
    );
  }

  @Post('me/deactivate')
  @ApiOperation({ summary: 'Temporarily deactivate account and invalidate sessions' })
  deactivateAccount(@CurrentUser() user: RequestUser) {
    return this.usersService.deactivateAccount(user.id);
  }

  @Post('me/reactivate')
  @ApiOperation({ summary: 'Reactivate a temporarily deactivated account' })
  reactivateAccount(@CurrentUser() user: RequestUser) {
    return this.usersService.reactivateAccount(user.id);
  }

  @Post('me/request-deletion')
  @ApiOperation({ summary: 'Request account deletion with a recovery holding period' })
  requestDeletion(@CurrentUser() user: RequestUser, @Body('reason') reason?: string) {
    return this.usersService.requestDeletion(user.id, reason);
  }

  @Post('me/cancel-deletion')
  @ApiOperation({ summary: 'Cancel a pending account deletion request' })
  cancelDeletion(@CurrentUser() user: RequestUser) {
    return this.usersService.cancelDeletion(user.id);
  }

  @Get('me/deletion-status')
  @ApiOperation({ summary: 'Check account deletion status and recovery window' })
  getDeletionStatus(@CurrentUser() user: RequestUser) {
    return this.usersService.getDeletionStatus(user.id);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update user city/location preferences' })
  updatePreferences(
    @Body() dto: UpdateUserPreferencesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.updatePreferences(user.id, dto);
  }

  @Get('me/identities')
  @ApiOperation({ summary: 'List anonymous identities for current user' })
  getMyIdentities(@CurrentUser() user: RequestUser) {
    return this.usersService.getMyIdentities(user.id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete account and revoke active tokens/sessions' })
  deleteAccount(@CurrentUser() user: RequestUser, @Body('reason') reason?: string) {
    return this.usersService.deleteAccount(user.id, reason);
  }
}
