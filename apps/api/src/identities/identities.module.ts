import { Global, Module } from '@nestjs/common';
import { IdentitiesController } from './identities.controller';
import { IdentitiesService } from './identities.service';

@Global()
@Module({
  controllers: [IdentitiesController],
  providers: [IdentitiesService],
  exports: [IdentitiesService],
})
export class IdentitiesModule {}
