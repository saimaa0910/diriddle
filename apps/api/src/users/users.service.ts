import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { IdentitiesService } from '../identities/identities.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identitiesService: IdentitiesService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { locationPreference: true },
    });
    if (!user || user.deletedAt) {
      throw new NotFoundException({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const [postCount, savedCount, communityCount] = await Promise.all([
      this.prisma.post.count({ where: { userId, deletedAt: null } }),
      this.prisma.savedPost.count({ where: { userId } }),
      this.prisma.communityMember.count({ where: { userId, status: 'ACTIVE' } }),
    ]);

    return {
      id: user.id,
      status: user.status,
      age_verified: user.ageVerified,
      created_at: user.createdAt,
      location_preference: user.locationPreference
        ? {
            selected_city: user.locationPreference.selectedCity,
            selected_state: user.locationPreference.selectedState,
            location_permission_granted: user.locationPreference.locationPermissionGranted,
          }
        : null,
      stats: {
        posts_count: postCount,
        saved_count: savedCount,
        communities_count: communityCount,
      },
    };
  }

  async updatePreferences(
    userId: string,
    dto: {
      selected_city?: string;
      selected_state?: string;
      location_permission_granted?: boolean;
    },
  ) {
    const existing = await this.prisma.locationPreference.findUnique({
      where: { userId },
    });

    const updated = await this.prisma.locationPreference.upsert({
      where: { userId },
      create: {
        userId,
        selectedCity: dto.selected_city ?? null,
        selectedState: dto.selected_state ?? null,
        locationPermissionGranted: dto.location_permission_granted ?? false,
      },
      update: {
        selectedCity: dto.selected_city !== undefined ? dto.selected_city : existing?.selectedCity ?? null,
        selectedState:
          dto.selected_state !== undefined ? dto.selected_state : existing?.selectedState ?? null,
        locationPermissionGranted:
          dto.location_permission_granted !== undefined
            ? dto.location_permission_granted
            : existing?.locationPermissionGranted ?? false,
      },
    });

    return {
      selected_city: updated.selectedCity,
      selected_state: updated.selectedState,
      location_permission_granted: updated.locationPermissionGranted,
      updated_at: updated.updatedAt,
    };
  }

  async getMyIdentities(userId: string) {
    return this.identitiesService.listForUser(userId);
  }

  async deleteAccount(userId: string, reason?: string) {
    const now = new Date();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        deletedAt: now,
        authId: `deleted:${userId}:${now.getTime()}`,
      },
    });

    await Promise.all([
      this.prisma.deviceToken.deleteMany({ where: { userId } }),
      this.prisma.communityMember.updateMany({
        where: { userId },
        data: { status: 'LEFT' },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'USER_ACCOUNT_DELETED',
          resourceType: 'USER',
          resourceId: userId,
          afterState: { reason: reason ?? 'user_requested', deletedAt: now.toISOString() },
        },
      }),
    ]);

    return {
      deleted: true,
      deleted_at: now,
    };
  }
}
