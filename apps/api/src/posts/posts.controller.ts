import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ReactionType } from '@prisma/client';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AgeVerifiedGuard } from '../common/guards/age-verified.guard';

class ReactDto {
  @IsEnum(ReactionType)
  reaction_type!: ReactionType;
}

class VotePollDto {
  @IsString()
  @IsNotEmpty()
  option_id!: string;
}

class UpdatePostDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsOptional()
  category?: any;

  @IsOptional()
  comments_enabled?: boolean;
}

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @ApiOperation({ summary: 'Create an anonymous post with auto-moderation and idempotency' })
  create(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: RequestUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.postsService.create(dto, user.id, idempotencyKey);
  }

  @Patch(':postId')
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @ApiOperation({ summary: 'Edit an authored post' })
  update(
    @Param('postId') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.postsService.update(id, user.id, {
      content: dto.content,
      category: dto.category,
      commentsEnabled: dto.comments_enabled,
    });
  }

  @Post(':postId/pin')
  @ApiOperation({ summary: 'Pin a post at the top of the community' })
  pinPost(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.pinPost(id, user.id);
  }

  @Post(':postId/unpin')
  @ApiOperation({ summary: 'Unpin a post from the top of the community' })
  unpinPost(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.unpinPost(id, user.id);
  }

  @Post(':postId/publish')
  @ApiOperation({ summary: 'Publish an authored draft post' })
  publishDraft(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.publishDraft(id, user.id);
  }

  @Post(':postId/hide')
  @ApiOperation({ summary: 'Hide a post from community view' })
  hidePost(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.hidePost(id, user.id);
  }

  @Post(':postId/unhide')
  @ApiOperation({ summary: 'Restore a hidden post to published status' })
  unhidePost(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.unhidePost(id, user.id);
  }

  @Post(':postId/share')
  @ApiOperation({ summary: 'Generate share reference for a post' })
  sharePost(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.sharePost(id, user.id);
  }

  @Get('me/authored')
  @ApiOperation({ summary: 'List posts authored by current user' })
  getMyAuthored(@CurrentUser() user: RequestUser) {
    return this.postsService.getMyAuthoredPosts(user.id);
  }

  @Get('me/saved')
  @ApiOperation({ summary: 'List posts saved by current user' })
  getMySaved(@CurrentUser() user: RequestUser) {
    return this.postsService.getMySavedPosts(user.id);
  }

  @Get(':postId')
  @ApiOperation({ summary: 'Get post detail by ID' })
  findOne(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.findOne(id, user.id);
  }

  @Delete(':postId')
  @ApiOperation({ summary: 'Delete own post' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.remove(id, user.id);
  }

  @Post(':postId/reactions')
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @ApiOperation({ summary: 'Toggle or set reaction on a post' })
  react(
    @Param('postId') id: string,
    @Body() dto: ReactDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.postsService.react(id, dto.reaction_type, user.id);
  }

  @Delete(':postId/reactions')
  @ApiOperation({ summary: 'Remove reaction from post' })
  unreact(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.unreact(id, user.id);
  }

  @Post(':postId/save')
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @ApiOperation({ summary: 'Save/bookmark a post' })
  save(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.save(id, user.id);
  }

  @Delete(':postId/save')
  @ApiOperation({ summary: 'Remove post bookmark' })
  unsave(@Param('postId') id: string, @CurrentUser() user: RequestUser) {
    return this.postsService.unsave(id, user.id);
  }

  @Post(':postId/poll/vote')
  @ApiOperation({ summary: 'Vote in a post poll' })
  votePoll(
    @Param('postId') id: string,
    @Body() dto: VotePollDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.postsService.votePoll(id, dto.option_id, user.id);
  }
}

