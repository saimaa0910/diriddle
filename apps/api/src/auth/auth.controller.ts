import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyAgeDto } from './dto/verify-age.dto';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to phone or email' })
  @HttpCode(HttpStatus.OK)
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and receive JWT tokens' })
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out and revoke refresh token' })
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body('refresh_token') refreshToken?: string) {
    return this.authService.logout(refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
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
}
