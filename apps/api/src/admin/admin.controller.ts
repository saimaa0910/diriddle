import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AdminRoleType,
  AppealStatus,
  CommentStatus,
  CommunityStatus,
  CommunityType,
  ModerationActionType,
  PostStatus,
  UserStatus,
} from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Request } from 'express';
import { AdminService } from './admin.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

class AdminLoginDto {
  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  identifier?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  otp?: string;
}

class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(CommunityType)
  type!: CommunityType;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  geo_cell?: string;

  @IsEnum(CommunityStatus)
  @IsOptional()
  status?: CommunityStatus;
}

class UpdatePostStatusDto {
  @IsEnum(PostStatus)
  status!: PostStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

class UpdateCommentStatusDto {
  @IsEnum(CommentStatus)
  status!: CommentStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}

class AdminReportActionDto {
  @IsEnum(ModerationActionType)
  action_type!: ModerationActionType;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(['POST', 'COMMENT', 'USER', 'REPORT'])
  @IsOptional()
  target_type?: 'POST' | 'COMMENT' | 'USER' | 'REPORT';

  @IsString()
  @IsOptional()
  target_id?: string;
}

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

class GrantAdminRoleDto {
  @IsEnum(AdminRoleType)
  role!: AdminRoleType;

  @IsString()
  @IsOptional()
  scope?: string;

  @IsString()
  @IsOptional()
  scope_id?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Post('auth/login')
  @ApiOperation({ summary: 'Admin login' })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.adminService.adminLogin(dto);
  }

  @Get('overview')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR', 'ANALYST')
  @ApiOperation({ summary: 'Platform overview KPIs and priority report summary' })
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('reports')
  @ApiOperation({ summary: 'Filterable reports queue' })
  getReports(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('reason') reason?: string,
  ) {
    return this.adminService.getReports({ status, priority, reason }, user);
  }

  @Post('reports/:id/action')
  @ApiOperation({ summary: 'Execute moderation action for a report' })
  handleReportAction(
    @Param('id') reportId: string,
    @Body() dto: AdminReportActionDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.adminService.handleModerationAction(user.id, reportId, dto, req.ip);
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

  @Patch('posts/:id/status')
  @ApiOperation({ summary: 'Update post moderation status' })
  updatePostStatus(
    @Param('id') postId: string,
    @Body() dto: UpdatePostStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updatePostStatus(user.id, postId, dto.status, dto.reason);
  }

  @Get('comments')
  @ApiOperation({ summary: 'List comments for moderation review' })
  listComments(@Query('status') status?: string) {
    return this.adminService.listCommentsForModeration(status);
  }

  @Patch('comments/:id/status')
  @ApiOperation({ summary: 'Update comment moderation status' })
  updateCommentStatus(
    @Param('id') commentId: string,
    @Body() dto: UpdateCommentStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.updateCommentStatus(user.id, commentId, dto.status, dto.reason);
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

  @Post('communities')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD')
  @ApiOperation({ summary: 'Create a new community with status ACTIVE' })
  createCommunity(
    @Body() dto: CreateCommunityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.createCommunity(user.id, dto);
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

  @Post('users/:userId/role')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Grant an administrative role to a user (Super Admin only)' })
  grantRole(
    @Param('userId') targetUserId: string,
    @Body() dto: GrantAdminRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.grantAdminRole(
      user.id,
      targetUserId,
      dto.role,
      dto.scope ?? 'PLATFORM',
      dto.scope_id,
    );
  }

  @Delete('users/:userId/role')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Revoke an administrative role from a user (Super Admin only)' })
  revokeRole(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.revokeAdminRole(user.id, targetUserId);
  }

  @Post('reports/:id/assign')
  @ApiOperation({ summary: 'Assign a report to the current moderator' })
  assignReport(
    @Param('id') reportId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.assignReport(user.id, reportId);
  }

  @Post('users/:userId/legal-hold')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD')
  @ApiOperation({ summary: 'Apply legal hold to a user account, preventing deletion' })
  applyLegalHold(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: RequestUser,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.setLegalHold(user.id, targetUserId, true, reason);
  }

  @Delete('users/:userId/legal-hold')
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD')
  @ApiOperation({ summary: 'Release legal hold from a user account' })
  releaseLegalHold(
    @Param('userId') targetUserId: string,
    @CurrentUser() user: RequestUser,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.setLegalHold(user.id, targetUserId, false, reason);
  }

  @Post('audit-logs/:id/rollback')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Rollback an administrative operation to its prior snapshot' })
  rollbackAction(
    @Param('id') logId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.adminService.rollbackAuditAction(user.id, logId);
  }

  @Get('health/detailed')
  @Public()
  @ApiOperation({ summary: 'Get detailed system and database operational health status' })
  getDetailedHealth() {
    return this.adminService.getDetailedHealth();
  }
}
