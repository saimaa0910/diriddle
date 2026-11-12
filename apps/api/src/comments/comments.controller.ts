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
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { CommentsService } from './comments.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

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
  @ApiOperation({ summary: 'Add a comment to a post' })
  createComment(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.commentsService.createComment(postId, dto.content, user.id);
  }

  @Post('comments/:commentId/replies')
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
}
