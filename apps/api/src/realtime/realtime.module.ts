import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CommunityGateway } from './community.gateway';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-min-32-chars-local-only'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [CommunityGateway],
  exports: [CommunityGateway],
})
export class RealtimeModule {}

