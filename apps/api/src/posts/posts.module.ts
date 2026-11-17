import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { HashtagService } from './hashtag.service';
import { MentionService } from './mention.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, HashtagService, MentionService],
  exports: [PostsService, HashtagService, MentionService],
})
export class PostsModule {}

