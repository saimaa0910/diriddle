import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CommunitiesService } from './communities.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Communities')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

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
  @ApiOperation({ summary: 'Join a community' })
  join(@Param('communityId') id: string, @CurrentUser() user: RequestUser) {
    return this.communitiesService.join(id, user.id);
  }

  @Delete(':communityId/join')
  @ApiOperation({ summary: 'Leave a community' })
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@Param('communityId') id: string, @CurrentUser() user: RequestUser) {
    return this.communitiesService.leave(id, user.id);
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
