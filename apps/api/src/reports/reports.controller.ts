import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportReason } from '@prisma/client';
import { ReportsService } from './reports.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

class CreateReportDto {
  @IsEnum(['POST', 'COMMENT', 'USER'])
  target_type!: 'POST' | 'COMMENT' | 'USER';

  @IsString()
  @IsNotEmpty()
  target_id!: string;

  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  description?: string;
}

@ApiTags('Safety')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit a safety/content report' })
  create(@Body() dto: CreateReportDto, @CurrentUser() user: RequestUser) {
    return this.reportsService.create({
      ...dto,
      reporterId: user.id,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Get reports submitted by current user' })
  getMyReports(@CurrentUser() user: RequestUser) {
    return this.reportsService.getMyReports(user.id);
  }
}
