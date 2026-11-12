import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async block(blockerId: string, blockedId: string) {
    if (!blockedId) {
      throw new BadRequestException({
        error: 'INVALID_USER_ID',
        message: 'Target user_id is required',
      });
    }
    if (blockerId === blockedId) {
      throw new BadRequestException({
        error: 'SELF_BLOCK_NOT_ALLOWED',
        message: 'Cannot block yourself',
      });
    }

    const target = await this.prisma.user.findUnique({ where: { id: blockedId } });
    if (!target || target.deletedAt) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'Target user not found',
      });
    }

    await this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });

    return { blocked: true, user_id: blockedId };
  }

  async unblock(blockerId: string, blockedId: string) {
    await this.prisma.block.deleteMany({
      where: { blockerId, blockedId },
    });
    return { blocked: false, user_id: blockedId };
  }

  async getBlocked(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { blockedId: true, createdAt: true },
    });

    return {
      data: blocks.map((b) => ({
        user_id: b.blockedId,
        blocked_at: b.createdAt,
      })),
      next_cursor: null,
      has_more: false,
    };
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const [initiated, received] = await Promise.all([
      this.prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true },
      }),
      this.prisma.block.findMany({
        where: { blockedId: userId },
        select: { blockerId: true },
      }),
    ]);

    const ids = new Set<string>();
    for (const row of initiated) ids.add(row.blockedId);
    for (const row of received) ids.add(row.blockerId);
    return Array.from(ids);
  }
}
