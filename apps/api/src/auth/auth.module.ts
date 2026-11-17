import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpRateLimiterService } from './otp-rate-limiter.service';
import { OtpStorageService } from './otp-storage.service';
import { SessionService } from './session.service';
import { TokenRevocationService } from './token-revocation.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    OtpRateLimiterService,
    OtpStorageService,
    SessionService,
    TokenRevocationService,
  ],
  exports: [
    AuthService,
    OtpRateLimiterService,
    OtpStorageService,
    SessionService,
    TokenRevocationService,
  ],
})
export class AuthModule {}
