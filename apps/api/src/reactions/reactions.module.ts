import { Global, Module } from '@nestjs/common';
import { ReactionsService } from './reactions.service';

@Global()
@Module({
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
