import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class IdentitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForCommunity(userId: string, communityId: string) {
    let identity = await this.prisma.anonymousIdentity.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!identity) {
      // Retry up to 10 times on collision
      let attempts = 0;
      while (!identity && attempts < 10) {
        attempts++;
        try {
          const count = await this.prisma.anonymousIdentity.count({ where: { communityId } });
          const displayNumber = 1000 + count + attempts;
          const displayCode = `Anonymous #${String(displayNumber).padStart(4, '0')}`;
          identity = await this.prisma.anonymousIdentity.create({
            data: { userId, communityId, displayCode, isGlobal: false },
          });
        } catch (err: any) {
          // P2002 = Prisma unique constraint violation
          if (err?.code !== 'P2002') throw err;
          identity = await this.prisma.anonymousIdentity.findUnique({
            where: { userId_communityId: { userId, communityId } },
          });
        }
      }
      if (!identity) {
        throw new Error('Failed to create anonymous identity after 10 attempts');
      }
    }
    return identity;
  }

  async getOrCreateGlobal(userId: string) {
    let identity = await this.prisma.anonymousIdentity.findFirst({
      where: { userId, communityId: null, isGlobal: true },
    });

    if (!identity) {
      const globalCount = await this.prisma.anonymousIdentity.count({
        where: { isGlobal: true },
      });
      const displayCode = `Global #${String(1000 + globalCount + 1).padStart(4, '0')}`;
      identity = await this.prisma.anonymousIdentity.create({
        data: {
          userId,
          communityId: null,
          displayCode,
          isGlobal: true,
          avatarCode: `avatar_${Math.floor(1 + Math.random() * 20)}`,
        },
      });
    }

    return {
      id: identity.id,
      display_code: identity.displayCode,
      avatar_code: identity.avatarCode,
      is_global: true,
      created_at: identity.createdAt,
    };
  }

  async changeDisplayCode(
    userId: string,
    identityId: string,
    newDisplayCode: string,
    reason?: string,
  ) {
    const trimmed = newDisplayCode.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      throw new BadRequestException({
        error: 'INVALID_DISPLAY_CODE',
        message: 'Display code must be between 3 and 30 characters',
      });
    }

    const identity = await this.prisma.anonymousIdentity.findUnique({
      where: { id: identityId },
    });

    if (!identity) {
      throw new NotFoundException({
        error: 'IDENTITY_NOT_FOUND',
        message: 'Anonymous identity not found',
      });
    }

    if (identity.userId !== userId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_IDENTITY_EDIT',
        message: 'You can only change display codes for your own identities',
      });
    }

    // Check collision in the same scope
    if (identity.communityId) {
      const collision = await this.prisma.anonymousIdentity.findFirst({
        where: { communityId: identity.communityId, displayCode: trimmed, id: { not: identityId } },
      });
      if (collision) {
        throw new BadRequestException({
          error: 'DISPLAY_CODE_TAKEN',
          message: 'This display code is already taken in this community',
        });
      }
    }

    const previousDisplayCode = identity.displayCode;
    const previousAvatarCode = identity.avatarCode;

    await this.prisma.$transaction([
      this.prisma.identityHistory.create({
        data: {
          identityId: identity.id,
          previousDisplayCode,
          newDisplayCode: trimmed,
          previousAvatarCode,
          newAvatarCode: previousAvatarCode,
          changedAt: new Date(),
          changedBy: userId,
          reason: reason ?? null,
        },
      }),
      this.prisma.anonymousIdentity.update({
        where: { id: identityId },
        data: { displayCode: trimmed },
      }),
    ]);

    return {
      id: identity.id,
      display_code: trimmed,
      previous_display_code: previousDisplayCode,
    };
  }

  async getIdentityHistory(identityId: string, requestingUserId: string) {
    const identity = await this.prisma.anonymousIdentity.findUnique({
      where: { id: identityId },
    });

    if (!identity) {
      throw new NotFoundException({
        error: 'IDENTITY_NOT_FOUND',
        message: 'Anonymous identity not found',
      });
    }

    if (identity.userId !== requestingUserId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_HISTORY_ACCESS',
        message: 'You can only view history for your own identities',
      });
    }

    const history = await this.prisma.identityHistory.findMany({
      where: { identityId },
      orderBy: { changedAt: 'desc' },
    });

    return {
      identity_id: identity.id,
      current_display_code: identity.displayCode,
      history: history.map((h) => ({
        id: h.id,
        previous_display_code: h.previousDisplayCode,
        new_display_code: h.newDisplayCode,
        changed_at: h.changedAt,
        reason: h.reason,
      })),
    };
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
        community_name: ident.community?.name ?? (ident.isGlobal ? 'Global' : null),
        display_code: ident.displayCode,
        avatar_code: ident.avatarCode,
        is_global: ident.isGlobal,
        created_at: ident.createdAt,
      })),
    };
  }

  async privateLookupByIdentityId(
    identityId: string,
    actorId: string,
    reason: string,
    ipAddress?: string,
    caseReference?: string,
    purpose?: string,
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

    // Explicit authorization check
    const admin = await this.prisma.adminRole.findUnique({
      where: { userId: actorId },
    });
    if (!admin || !['SUPER_ADMIN', 'TRUST_SAFETY_LEAD'].includes(admin.role)) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_IDENTITY_LOOKUP',
        message: 'Only SUPER_ADMIN or TRUST_SAFETY_LEAD can resolve anonymous identities',
      });
    }
    if (admin.expiresAt && admin.expiresAt < new Date()) {
      throw new ForbiddenException({
        error: 'ADMIN_ROLE_EXPIRED',
        message: 'Administrative privileges have expired',
      });
    }

    const resolvedPurpose = purpose || 'COMPLIANCE_INVESTIGATION';
    const resolvedCaseRef = caseReference || 'INTERNAL-AUDIT';

    // Log to immutable IdentityAccessLog
    await this.prisma.identityAccessLog.create({
      data: {
        actorId,
        identityId: identity.id,
        accessReason: `[${resolvedPurpose}] [Ref: ${resolvedCaseRef}] ${reason}`,
        ipAddress: ipAddress ?? null,
      },
    });

    // Log to system AuditLog
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'IDENTITY_LOOKUP',
        resourceType: 'ANONYMOUS_IDENTITY',
        resourceId: identity.id,
        afterState: {
          reason,
          purpose: resolvedPurpose,
          caseReference: resolvedCaseRef,
          targetUserId: identity.userId,
        },
        ipAddress: ipAddress ?? null,
      },
    });

    return {
      identity_id: identity.id,
      user_id: identity.userId,
      community_id: identity.communityId,
      display_code: identity.displayCode,
      purpose: resolvedPurpose,
      case_reference: resolvedCaseRef,
      audit_logged: true,
    };
  }
}

