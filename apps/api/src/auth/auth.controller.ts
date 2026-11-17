import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyAgeDto } from './dto/verify-age.dto';
import { LinkIdentityDto } from './dto/link-identity.dto';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to phone or email' })
  @HttpCode(HttpStatus.OK)
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and receive JWT tokens' })
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const deviceInfo = {
      deviceId: req.headers['x-device-id'] as string | undefined,
      deviceName: req.headers['x-device-name'] as string | undefined,
      platform: req.headers['x-platform'] as string | undefined,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
    return this.authService.verifyOtp(dto, deviceInfo);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out and revoke refresh token' })
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body('refresh_token') refreshToken?: string) {
    return this.authService.logout(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user session summary' })
  getMe(@CurrentUser() user: RequestUser) {
    return {
      id: user.id,
      status: user.status,
      age_verified: user.ageVerified,
      admin_role: user.adminRole?.role ?? null,
    };
  }

  @Post('verify-age')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm 18+ age eligibility and record legal consents' })
  @HttpCode(HttpStatus.OK)
  verifyAge(
    @Body() dto: VerifyAgeDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.authService.verifyAge(user.id, dto, req.ip);
  }

  @Post('age-verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Alias for verify-age (mobile client compatibility)' })
  @HttpCode(HttpStatus.OK)
  ageVerify(
    @Body() dto: VerifyAgeDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.authService.verifyAge(user.id, dto, req.ip);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active device sessions' })
  listSessions(@CurrentUser() user: RequestUser) {
    return this.sessionService.listActiveSessions(user.id);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific active session' })
  revokeSession(@CurrentUser() user: RequestUser, @Param('sessionId') sessionId: string) {
    return this.sessionService.revokeSession(sessionId, user.id);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all active sessions (logout everywhere)' })
  revokeAllSessions(@CurrentUser() user: RequestUser) {
    return this.sessionService.revokeAllSessions(user.id);
  }

  @Get('login-history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'View recent login attempts for the account' })
  getLoginHistory(@CurrentUser() user: RequestUser) {
    return this.sessionService.getLoginHistory(user.id);
  }

  @Get('identities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List linked authentication identities' })
  listIdentities(@CurrentUser() user: RequestUser) {
    return this.authService.listIdentities(user.id);
  }

  @Post('identities')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link an additional authentication identity' })
  linkIdentity(@CurrentUser() user: RequestUser, @Body() dto: LinkIdentityDto) {
    return this.authService.linkIdentity(user.id, dto);
  }

  @Delete('identities/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink an authentication identity' })
  unlinkIdentity(@CurrentUser() user: RequestUser, @Param('id') identityId: string) {
    return this.authService.unlinkIdentity(user.id, identityId);
  }
}
