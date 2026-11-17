import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { AgeVerifiedGuard } from '../common/guards/age-verified.guard';

@ApiTags('Communities')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @UseGuards(AgeVerifiedGuard)
  @ApiOperation({ summary: 'Create a new public or private community' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List active communities' })
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('type') type?: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communitiesService.findAll(user.id, {
      city,
      state,
      type,
      q,
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':communityId')
  @ApiOperation({ summary: 'Get community detail' })
  findOne(@Param('communityId') id: string, @CurrentUser() user: RequestUser) {
    return this.communitiesService.findOne(id, user.id);
  }

  @Post(':communityId/join')
  @UseGuards(AgeVerifiedGuard)
  @ApiOperation({ summary: 'Join a community or request to join if private' })
  join(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Body('message') message?: string,
  ) {
    return this.communitiesService.join(id, user.id, message);
  }

  @Delete(':communityId/join')
  @ApiOperation({ summary: 'Leave a community' })
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@Param('communityId') id: string, @CurrentUser() user: RequestUser) {
    return this.communitiesService.leave(id, user.id);
  }

  @Post(':communityId/transfer-ownership')
  @ApiOperation({ summary: 'Transfer community ownership to an active member' })
  transferOwnership(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Body('new_owner_id') newOwnerId: string,
  ) {
    return this.communitiesService.transferOwnership(id, user.id, newOwnerId);
  }

  @Post(':communityId/moderators')
  @ApiOperation({ summary: 'Add a community moderator' })
  addModerator(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Body('user_id') targetUserId: string,
    @Body('permissions') permissions?: string[],
  ) {
    return this.communitiesService.addModerator(id, user.id, targetUserId, permissions);
  }

  @Delete(':communityId/moderators/:userId')
  @ApiOperation({ summary: 'Remove a community moderator' })
  removeModerator(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Param('userId') targetUserId: string,
  ) {
    return this.communitiesService.removeModerator(id, user.id, targetUserId);
  }

  @Get(':communityId/roles')
  @ApiOperation({ summary: 'List roles within the community' })
  listRoles(@Param('communityId') id: string, @CurrentUser() user: RequestUser) {
    return this.communitiesService.listRoles(id, user.id);
  }

  @Get(':communityId/join-requests')
  @ApiOperation({ summary: 'List pending join requests for a private community' })
  listJoinRequests(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    return this.communitiesService.listJoinRequests(id, user.id, status);
  }

  @Post(':communityId/join-requests/:requestId/approve')
  @ApiOperation({ summary: 'Approve a member join request' })
  approveJoinRequest(
    @Param('communityId') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communitiesService.approveJoinRequest(id, user.id, requestId);
  }

  @Post(':communityId/join-requests/:requestId/reject')
  @ApiOperation({ summary: 'Reject a member join request' })
  rejectJoinRequest(
    @Param('communityId') id: string,
    @Param('requestId') requestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communitiesService.rejectJoinRequest(id, user.id, requestId);
  }

  @Post(':communityId/rules')
  @ApiOperation({ summary: 'Create a community rule' })
  createRule(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { title: string; description?: string },
  ) {
    return this.communitiesService.createRule(id, user.id, dto);
  }

  @Get(':communityId/rules')
  @ApiOperation({ summary: 'List rules for a community' })
  listRules(@Param('communityId') id: string) {
    return this.communitiesService.listRules(id);
  }

  @Delete(':communityId/rules/:ruleId')
  @ApiOperation({ summary: 'Delete a community rule' })
  deleteRule(
    @Param('communityId') id: string,
    @Param('ruleId') ruleId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communitiesService.deleteRule(id, user.id, ruleId);
  }

  @Post(':communityId/bans')
  @ApiOperation({ summary: 'Ban a member from the community' })
  banMember(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: { user_id: string; reason?: string; expires_at?: Date; notes?: string },
  ) {
    return this.communitiesService.banMember(id, user.id, dto.user_id, {
      reason: dto.reason,
      expiresAt: dto.expires_at ? new Date(dto.expires_at) : undefined,
      notes: dto.notes,
    });
  }

  @Delete(':communityId/bans/:userId')
  @ApiOperation({ summary: 'Unban a member from the community' })
  unbanMember(
    @Param('communityId') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communitiesService.unbanMember(id, user.id, targetUserId);
  }

  @Get(':communityId/bans')
  @ApiOperation({ summary: 'List banned members in the community' })
  listBans(@Param('communityId') id: string, @CurrentUser() user: RequestUser) {
    return this.communitiesService.listBans(id, user.id);
  }

  @Get(':communityId/feed')
  @ApiOperation({ summary: 'Get community post feed' })
  getFeed(
    @Param('communityId') id: string,
    @CurrentUser() user: RequestUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communitiesService.getFeed(id, user.id, {
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }
}
