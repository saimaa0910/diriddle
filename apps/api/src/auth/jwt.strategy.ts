import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret-min-32-chars-local-only',
    });
  }

  async validate(payload: { sub: string; uid?: string; type?: string }) {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException({
        error: 'INVALID_TOKEN_TYPE',
        message: 'Invalid token type',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { authId: payload.sub },
      include: { adminRole: true },
    });

    if (!user || user.deletedAt || user.status === 'DELETED') {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended',
      });
    }

    if (user.status === 'DEACTIVATED') {
      throw new ForbiddenException({
        error: 'ACCOUNT_DEACTIVATED',
        message: 'Your account is deactivated. Please reactivate to continue.',
      });
    }

    return user;
  }
}

