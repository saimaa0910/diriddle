import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';
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
