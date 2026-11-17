import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
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

  @Get('global')
  @ApiOperation({ summary: 'Get or generate the user global anonymous identity' })
  getGlobalIdentity(@CurrentUser() user: RequestUser) {
    return this.identitiesService.getOrCreateGlobal(user.id);
  }

  @Patch(':id/display-code')
  @ApiOperation({ summary: 'Change display code for an anonymous identity (audit logged)' })
  changeDisplayCode(
    @Param('id') identityId: string,
    @Body('display_code') displayCode: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!displayCode) {
      throw new BadRequestException({
        error: 'DISPLAY_CODE_REQUIRED',
        message: 'display_code is required',
      });
    }
    return this.identitiesService.changeDisplayCode(user.id, identityId, displayCode, reason);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'View pseudonym change history for your identity' })
  getIdentityHistory(
    @Param('id') identityId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.identitiesService.getIdentityHistory(identityId, user.id);
  }

  @Get(':identityId/audit-lookup')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TRUST_SAFETY_LEAD')
  @ApiOperation({ summary: 'Audit-logged Trust & Safety lookup for an anonymous identity' })
  auditLookup(
    @Param('identityId') identityId: string,
    @Query('reason') reason: string,
    @Query('case_reference') caseReference: string,
    @Query('purpose') purpose: string,
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
      caseReference?.trim(),
      purpose?.trim(),
    );
  }
}

