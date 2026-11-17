import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { FeedModule } from '../feed/feed.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [FeedModule, UsersModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
