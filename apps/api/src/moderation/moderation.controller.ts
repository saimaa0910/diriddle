import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ModerationActionType } from '@prisma/client';
import { Request } from 'express';
import { ModerationService } from './moderation.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

class TakeModerationActionDto {
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

  @IsString()
  @IsOptional()
  expires_at?: string;
}

class SubmitAppealDto {
  @IsString()
  @IsNotEmpty()
  moderation_action_id!: string;

  @IsString()
  @MinLength(10)
  reason!: string;
}

class ResolveAppealDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  resolution_notes?: string;
}

@ApiTags('Moderation')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('queue')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR')
  @ApiOperation({ summary: 'Get moderation review queue' })
  getQueue(@Query('status') status?: string, @Query('target_type') targetType?: string) {
    return this.moderationService.getQueue({ status, targetType });
  }

  @Post('actions')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR')
  @ApiOperation({ summary: 'Execute a moderation action with audit logging' })
  takeAction(
    @Body() dto: TakeModerationActionDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.moderationService.takeAction(user.id, dto, req.ip);
  }

  @Post('appeals')
  @ApiOperation({ summary: 'Submit an appeal against a moderation action' })
  submitAppeal(@Body() dto: SubmitAppealDto, @CurrentUser() user: RequestUser) {
    return this.moderationService.submitAppeal(user.id, dto.moderation_action_id, dto.reason);
  }

  @Get('appeals/me')
  @ApiOperation({ summary: 'List current user moderation appeals' })
  listMyAppeals(@CurrentUser() user: RequestUser) {
    return this.moderationService.listMyAppeals(user.id);
  }

  @Patch('appeals/:appealId')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'MODERATOR')
  @ApiOperation({ summary: 'Resolve a moderation appeal' })
  resolveAppeal(
    @Param('appealId') appealId: string,
    @Body() dto: ResolveAppealDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.moderationService.resolveAppeal(
      user.id,
      appealId,
      dto.status,
      dto.resolution_notes,
    );
  }
}

