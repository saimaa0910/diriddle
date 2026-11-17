import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum } from 'class-validator';
import { ReactionType } from '@prisma/client';
import { ReactionsService } from './reactions.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AgeVerifiedGuard } from '../common/guards/age-verified.guard';

class ReactDto {
  @IsEnum(ReactionType)
  reaction_type!: ReactionType;
}

@ApiTags('Reactions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @Post('posts/:postId/react')
  @UseGuards(JwtAuthGuard, AgeVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'React to a post (toggle: same type removes the reaction)' })
  react(
    @Param('postId') postId: string,
    @Body() dto: ReactDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reactionsService.react(postId, dto.reaction_type, user.id);
  }

  @Delete('posts/:postId/react')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove all reactions from a post' })
  unreact(@Param('postId') postId: string, @CurrentUser() user: RequestUser) {
    return this.reactionsService.unreact(postId, user.id);
  }

  @Get('posts/:postId/reactions')
  @ApiOperation({ summary: 'Get reaction counts for a post' })
  getCounts(@Param('postId') postId: string) {
    return this.reactionsService.getCounts(postId);
  }
}
