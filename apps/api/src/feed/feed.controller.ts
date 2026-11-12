import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PostCategory } from '@prisma/client';
import { FeedService } from './feed.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Feed')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby city/community feed' })
  getNearby(
    @CurrentUser() user: RequestUser,
    @Query('community_id') communityId?: string,
    @Query('city') city?: string,
    @Query('category') category?: PostCategory,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getNearby({
      userId: user.id,
      communityId,
      city,
      category,
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('trending')
  @ApiOperation({ summary: 'Get trending posts' })
  getTrending(
    @CurrentUser() user: RequestUser,
    @Query('community_id') communityId?: string,
    @Query('category') category?: PostCategory,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getTrending({
      userId: user.id,
      communityId,
      category,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest published posts' })
  getLatest(
    @CurrentUser() user: RequestUser,
    @Query('community_id') communityId?: string,
    @Query('category') category?: PostCategory,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getLatest({
      userId: user.id,
      communityId,
      category,
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get feed filtered by post category' })
  getByCategory(
    @Param('category') category: PostCategory,
    @CurrentUser() user: RequestUser,
    @Query('community_id') communityId?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedService.getByCategory({
      userId: user.id,
      category,
      communityId,
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }
}
