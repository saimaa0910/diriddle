import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IdentitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForCommunity(userId: string, communityId: string) {
    const existing = await this.prisma.anonymousIdentity.findFirst({
      where: { userId, communityId },
    });
    if (existing) {
      return existing;
    }

    const count = await this.prisma.anonymousIdentity.count({
      where: { communityId },
    });

    const displayNumber = 1000 + count + 1;
    const displayCode = `Anonymous #${String(displayNumber).padStart(4, '0')}`;

    return this.prisma.anonymousIdentity.create({
      data: {
        userId,
        communityId,
        displayCode,
      },
    });
  }

  async listForUser(userId: string) {
    const identities = await this.prisma.anonymousIdentity.findMany({
      where: { userId },
      include: { community: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: identities.map((ident) => ({
        id: ident.id,
        community_id: ident.communityId,
        community_name: ident.community?.name ?? 'Global',
        display_code: ident.displayCode,
        created_at: ident.createdAt,
      })),
    };
  }

  async privateLookupByIdentityId(
    identityId: string,
    actorId: string,
    reason: string,
    ipAddress?: string,
  ) {
    const identity = await this.prisma.anonymousIdentity.findUnique({
      where: { id: identityId },
    });
    if (!identity) {
      throw new NotFoundException({
        error: 'IDENTITY_NOT_FOUND',
        message: 'Anonymous identity not found',
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'IDENTITY_LOOKUP',
        resourceType: 'ANONYMOUS_IDENTITY',
        resourceId: identity.id,
        afterState: { reason, targetUserId: identity.userId },
        ipAddress: ipAddress ?? null,
      },
    });

    return {
      identity_id: identity.id,
      user_id: identity.userId,
      community_id: identity.communityId,
      display_code: identity.displayCode,
      audit_logged: true,
    };
  }
}
