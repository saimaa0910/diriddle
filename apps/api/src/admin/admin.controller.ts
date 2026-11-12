import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
  AppealStatus,
  CommunityStatus,
  ModerationActionType,
  UserStatus,
} from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class AdminModerationActionDto {
  @IsEnum(['POST', 'COMMENT', 'USER', 'REPORT'])
  target_type!: 'POST' | 'COMMENT' | 'USER' | 'REPORT';

  @IsString()
  @IsNotEmpty()
  target_id!: string;

  @IsEnum(ModerationActionType)
  action_type!: ModerationActionType;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  report_id?: string;
}

class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

class UpdateCommunityStatusDto {
  @IsEnum(CommunityStatus)
  status!: CommunityStatus;
}

class AdminResolveAppealDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  resolution_notes?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR', 'ANALYST')
  @ApiOperation({ summary: 'Platform overview KPIs and priority report summary' })
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('reports')
  @ApiOperation({ summary: 'Filterable reports queue' })
  getReports(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('reason') reason?: string,
  ) {
    return this.adminService.getReports({ status, priority, reason });
  }

  @Post('moderation/actions')
  @ApiOperation({ summary: 'Execute moderation action from admin console' })
  takeModerationAction(
    @Body() dto: AdminModerationActionDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.adminService.executeModerationAction(user.id, dto, req.ip);
  }

  @Get('posts')
  @ApiOperation({ summary: 'List posts for moderation review' })
  listPosts(@Query('status') status?: string) {
    return this.adminService.listPostsForModeration(status);
  }

  @Get('comments')
  @ApiOperation({ summary: 'List comments for moderation review' })
  listComments(@Query('status') status?: string) {
    return this.adminService.listCommentsForModeration(status);
  }

  @Get('users')
  @ApiOperation({ summary: 'List anonymized user statuses (no PII)' })
  listUsers() {
    return this.adminService.listUsersAnonymized();
  }

  @Patch('users/:userId/status')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD')
  @ApiOperation({ summary: 'Update user status (suspend/activate)' })
  updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updateUserStatus(user.id, userId, dto.status, dto.reason);
  }

  @Get('communities')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR', 'ANALYST')
  @ApiOperation({ summary: 'List communities across India for admin management' })
  listCommunities() {
    return this.adminService.listCommunities();
  }

  @Patch('communities/:communityId/status')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD')
  @ApiOperation({ summary: 'Activate or deactivate a community/city' })
  updateCommunityStatus(
    @Param('communityId') communityId: string,
    @Body() dto: UpdateCommunityStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updateCommunityStatus(user.id, communityId, dto.status);
  }

  @Get('appeals')
  @ApiOperation({ summary: 'List moderation appeals queue' })
  listAppeals(@Query('status') status?: AppealStatus) {
    return this.adminService.listAppeals(status);
  }

  @Patch('appeals/:appealId')
  @ApiOperation({ summary: 'Approve or reject a moderation appeal' })
  resolveAppeal(
    @Param('appealId') appealId: string,
    @Body() dto: AdminResolveAppealDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.resolveAppeal(
      user.id,
      appealId,
      dto.status,
      dto.resolution_notes,
    );
  }

  @Get('audit-logs')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'ANALYST')
  @ApiOperation({ summary: 'View immutable moderation and identity access audit logs' })
  getAuditLogs() {
    return this.adminService.getAuditLogs();
  }
}
