import {
  Body,
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
import { IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ReactionType } from '@prisma/client';
import { CommentsService } from './comments.service';
import { ReactionsService } from '../reactions/reactions.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AgeVerifiedGuard } from '../common/guards/age-verified.guard';

class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

class ReactCommentDto {
  @IsEnum(ReactionType)
  reaction_type!: ReactionType;
}

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly reactionsService: ReactionsService,
  ) {}

  @Get('posts/:postId/comments')
  @ApiOperation({ summary: 'List comments and nested replies for a post' })
  getComments(
    @Param('postId') postId: string,
    @CurrentUser() user: RequestUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commentsService.getComments(postId, user.id, {
      cursor,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('posts/:postId/comments')
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @ApiOperation({ summary: 'Add a comment to a post' })
  createComment(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.commentsService.createComment(postId, dto.content, user.id);
  }

  @Post('comments/:commentId/replies')
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @ApiOperation({ summary: 'Reply to a comment' })
  createReply(
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.commentsService.createReply(commentId, dto.content, user.id);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete own comment' })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComment(@Param('commentId') commentId: string, @CurrentUser() user: RequestUser) {
    return this.commentsService.deleteComment(commentId, user.id);
  }

  @Post('comments/:commentId/react')
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'React to a comment (toggle: same type removes the reaction)' })
  reactToComment(
    @Param('commentId') commentId: string,
    @Body() dto: ReactCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reactionsService.reactToComment(commentId, dto.reaction_type, user.id);
  }

  @Delete('comments/:commentId/react')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove reaction from a comment' })
  unreactComment(@Param('commentId') commentId: string, @CurrentUser() user: RequestUser) {
    return this.reactionsService.unreactComment(commentId, user.id);
  }

  @Get('comments/:commentId/reactions')
  @ApiOperation({ summary: 'Get reaction counts for a comment' })
  getCommentReactions(@Param('commentId') commentId: string) {
    return this.reactionsService.getCommentCounts(commentId);
  }
}
