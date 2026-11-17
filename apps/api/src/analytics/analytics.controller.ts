import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD', 'ANALYST')
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get platform analytics KPIs: users, content, engagement, safety, city breakdown',
  })
  getPlatformMetrics() {
    return this.analyticsService.getPlatformMetrics();
  }

  @Get('communities/:communityId')
  @ApiOperation({ summary: 'Get community growth and engagement metrics' })
  getCommunityGrowth(@Param('communityId') communityId: string) {
    return this.analyticsService.getCommunityGrowth(communityId);
  }
}
