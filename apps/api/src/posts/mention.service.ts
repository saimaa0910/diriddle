import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  extractMentions(content: string): string[] {
    if (!content) return [];
    // Matches @Anonymous#1234 or @Anonymous #1234
    const matches = content.match(/@Anonymous\s*#(\d{4})/gi);
    if (!matches) return [];

    const codes = new Set<string>();
    for (const match of matches) {
      const numMatch = match.match(/\d{4}/);
      if (numMatch) {
        codes.add(`Anonymous #${numMatch[0]}`);
      }
    }

    return Array.from(codes);
  }

  async resolveAndNotifyMentions(
    content: string,
    communityId: string,
    postId: string,
    commentId?: string,
  ): Promise<void> {
    const displayCodes = this.extractMentions(content);
    if (displayCodes.length === 0) return;

    const identities = await this.prisma.anonymousIdentity.findMany({
      where: {
        communityId,
        displayCode: { in: displayCodes },
      },
    });

    for (const identity of identities) {
      await this.prisma.mention.create({
        data: {
          postId,
          commentId: commentId ?? null,
          mentionedIdentityId: identity.id,
        },
      });

      // Dispatch mention notification without revealing author identity
      await this.notifications.notify(identity.userId, 'COMMUNITY_POST', postId, {
        post_id: postId,
        comment_id: commentId ?? null,
        message: 'You were mentioned in a conversation',
      });
    }
  }
}
