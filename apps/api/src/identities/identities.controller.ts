import { Controller, Get, Param, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { IdentitiesService } from './identities.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('Identities')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('identities')
export class IdentitiesController {
  constructor(private readonly identitiesService: IdentitiesService) {}

  @Get('me')
  @ApiOperation({ summary: 'List current user community-scoped anonymous identities' })
  getMyIdentities(@CurrentUser() user: RequestUser) {
    return this.identitiesService.listForUser(user.id);
  }

  @Get(':identityId/audit-lookup')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD')
  @ApiOperation({ summary: 'Audit-logged Trust & Safety lookup for an anonymous identity' })
  auditLookup(
    @Param('identityId') identityId: string,
    @Query('reason') reason: string,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException({
        error: 'AUDIT_REASON_REQUIRED',
        message: 'A descriptive compliance reason (min 5 chars) is required',
      });
    }
    return this.identitiesService.privateLookupByIdentityId(
      identityId,
      user.id,
      reason.trim(),
      req.ip,
    );
  }
}
