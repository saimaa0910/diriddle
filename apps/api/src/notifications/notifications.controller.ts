import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

class UpdateNotificationPrefDto {
  @IsString()
  @IsNotEmpty()
  notification_type!: string;

  @IsBoolean()
  push_enabled!: boolean;

  @IsBoolean()
  in_app_enabled!: boolean;
}

class DeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @IsNotEmpty()
  platform!: string;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  list(
    @CurrentUser() user: RequestUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.listForUser(user.id, {
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: RequestUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read (POST alias)' })
  markReadPost(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  getPreferences(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preference' })
  updatePreference(@Body() dto: UpdateNotificationPrefDto, @CurrentUser() user: RequestUser) {
    return this.notificationsService.updatePreference(
      user.id,
      dto.notification_type,
      dto.push_enabled,
      dto.in_app_enabled,
    );
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register push notification device token' })
  registerDeviceToken(@Body() dto: DeviceTokenDto, @CurrentUser() user: RequestUser) {
    return this.notificationsService.registerDeviceToken(user.id, dto.token, dto.platform);
  }

  @Delete('device-tokens')
  @ApiOperation({ summary: 'Unregister push notification device token' })
  removeDeviceToken(@Body('token') token: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService.removeDeviceToken(user.id, token);
  }
}

