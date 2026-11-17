import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PrivacyService } from './privacy.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Privacy')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get('consents')
  @ApiOperation({ summary: 'Get current user consent history' })
  getConsentHistory(@CurrentUser() user: RequestUser) {
    return this.privacyService.getConsentHistory(user.id);
  }

  @Post('consents')
  @ApiOperation({ summary: 'Record a user consent decision or withdrawal' })
  recordConsent(
    @CurrentUser() user: RequestUser,
    @Body() dto: RecordConsentDto,
    @Req() req: any,
  ) {
    const ip = dto.ip_address ?? req.ip ?? req.headers?.['x-forwarded-for'];
    return this.privacyService.recordConsent(user.id, { ...dto, ip_address: ip });
  }

  @Get('retention-policies')
  @ApiOperation({ summary: 'List platform data retention and privacy policies' })
  getRetentionPolicies() {
    return this.privacyService.getRetentionPolicies();
  }

  @Get('export')
  @ApiOperation({ summary: 'Export full user personal data package (GDPR Data Portability)' })
  exportUserData(@CurrentUser() user: RequestUser) {
    return this.privacyService.exportUserData(user.id);
  }
}
