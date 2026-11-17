import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { TrendingService } from './trending.service';

@Module({
  controllers: [FeedController],
  providers: [FeedService, TrendingService],
  exports: [FeedService, TrendingService],
})
export class FeedModule {}

