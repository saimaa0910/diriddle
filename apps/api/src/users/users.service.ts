import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { IdentitiesService } from '../identities/identities.service';
import { OtpStorageService } from '../auth/otp-storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identitiesService: IdentitiesService,
    private readonly configService: ConfigService,
    @Optional() private readonly otpStorage?: OtpStorageService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { locationPreference: true, userProfile: true },
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
      profile: user.userProfile
        ? {
            display_name: user.userProfile.displayName,
            avatar_url: user.userProfile.avatarUrl,
            interests: user.userProfile.interests,
            age_band: user.userProfile.ageBand,
            gender: user.userProfile.gender,
            preferred_language: user.userProfile.preferredLanguage,
          }
        : null,
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: dto.display_name ?? null,
        avatarUrl: dto.avatar_url ?? null,
        interests: dto.interests ?? [],
        ageBand: dto.age_band ?? null,
        gender: dto.gender ?? null,
        preferredLanguage: dto.preferred_language ?? null,
      },
      update: {
        ...(dto.display_name !== undefined ? { displayName: dto.display_name } : {}),
        ...(dto.avatar_url !== undefined ? { avatarUrl: dto.avatar_url } : {}),
        ...(dto.interests !== undefined ? { interests: dto.interests } : {}),
        ...(dto.age_band !== undefined ? { ageBand: dto.age_band } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.preferred_language !== undefined ? { preferredLanguage: dto.preferred_language } : {}),
      },
    });

    return {
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      interests: profile.interests,
      age_band: profile.ageBand,
      gender: profile.gender,
      preferred_language: profile.preferredLanguage,
      updated_at: profile.updatedAt,
    };
  }

  async deactivateAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'DEACTIVATED' },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { status: 'DEACTIVATED', deactivated: true };
  }

  async reactivateAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }
    if (user.status !== 'DEACTIVATED') {
      throw new BadRequestException({
        error: 'ACCOUNT_NOT_DEACTIVATED',
        message: 'Account is not currently deactivated',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });

    return { status: 'ACTIVE', reactivated: true };
  }

  async requestDeletion(userId: string, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if ((user as any).legalHold === true) {
      throw new ForbiddenException({
        error: 'ACCOUNT_ON_LEGAL_HOLD',
        message: 'This account is subject to an active legal hold and cannot be deleted.',
      });
    }

    const recoveryDays = Number(this.configService.get('ACCOUNT_DELETION_RECOVERY_DAYS', '30'));
    const now = new Date();
    const scheduledAt = new Date(now.getTime() + recoveryDays * 24 * 60 * 60 * 1000);

    const deletion = await this.prisma.deletionRequest.upsert({
      where: { userId },
      create: {
        userId,
        reason: reason ?? null,
        scheduledAt,
        status: 'PENDING',
        requestedAt: now,
      },
      update: {
        reason: reason ?? null,
        scheduledAt,
        status: 'PENDING',
        cancelledAt: null,
        requestedAt: now,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETION_PENDING' },
    });

    return {
      status: 'DELETION_PENDING',
      scheduled_deletion_at: deletion.scheduledAt,
      recovery_days: recoveryDays,
    };
  }

  async cancelDeletion(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const deletion = await this.prisma.deletionRequest.findUnique({ where: { userId } });
    if (!deletion || deletion.status !== 'PENDING') {
      throw new BadRequestException({
        error: 'NO_PENDING_DELETION',
        message: 'No pending deletion request found for this account',
      });
    }

    await this.prisma.$transaction([
      this.prisma.deletionRequest.update({
        where: { userId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    return { status: 'ACTIVE', cancellation_successful: true };
  }

  async getDeletionStatus(userId: string) {
    const deletion = await this.prisma.deletionRequest.findUnique({ where: { userId } });
    if (!deletion) {
      return { has_pending_deletion: false, deletion: null };
    }
    return {
      has_pending_deletion: deletion.status === 'PENDING',
      deletion: {
        requested_at: deletion.requestedAt,
        scheduled_at: deletion.scheduledAt,
        status: deletion.status,
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

  async requestContactChange(userId: string, newIdentifier: string, type: 'phone' | 'email') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const formatted =
      type === 'phone'
        ? newIdentifier.startsWith('+')
          ? newIdentifier
          : `+${newIdentifier.replace(/\D/g, '')}`
        : newIdentifier.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ authId: `${type}:${formatted}` }, { authId: formatted }],
        deletedAt: null,
      },
    });
    if (existing && existing.id !== userId) {
      throw new BadRequestException({
        error: 'IDENTIFIER_ALREADY_IN_USE',
        message: 'This contact identifier is already linked to another active account',
      });
    }

    if (!this.otpStorage) {
      return { success: true, message: `OTP simulated for ${formatted}` };
    }

    const otpResult = await this.otpStorage.issueOtp(formatted);
    return {
      success: true,
      message: `OTP sent to new ${type}`,
      expires_in_seconds: otpResult.expiresInSeconds,
    };
  }

  async verifyContactChange(
    userId: string,
    newIdentifier: string,
    otp: string,
    type: 'phone' | 'email',
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const formatted =
      type === 'phone'
        ? newIdentifier.startsWith('+')
          ? newIdentifier
          : `+${newIdentifier.replace(/\D/g, '')}`
        : newIdentifier.trim().toLowerCase();

    if (this.otpStorage) {
      const allowDevOtp =
        this.configService.get('ALLOW_DEV_OTP') === 'true' ||
        process.env.NODE_ENV !== 'production';
      const otpValid = await this.otpStorage.verifyOtp(formatted, otp, allowDevOtp);
      if (!otpValid) {
        throw new BadRequestException({
          error: 'INVALID_OR_EXPIRED_OTP',
          message: 'Invalid or expired verification code',
        });
      }
    }

    const newAuthId = `${type}:${formatted}`;
    const previousAuthId = user.authId;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { authId: newAuthId },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'CONTACT_CHANGE_VERIFIED',
          resourceType: 'USER',
          resourceId: userId,
          beforeState: { authId: previousAuthId },
          afterState: { authId: newAuthId },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Contact identifier updated successfully',
      new_contact: formatted,
    };
  }

  async deleteAccount(userId: string, reason?: string): Promise<{ deleted: boolean; deleted_at: Date }> {
    const now = new Date();

    await this.prisma.$transaction([
      // Anonymize/remove content
      this.prisma.post.updateMany({
        where: { userId },
        data: { status: 'REMOVED', deletedAt: now },
      }),
      this.prisma.comment.updateMany({
        where: { userId },
        data: { status: 'REMOVED', deletedAt: now },
      }),
      // Remove device tokens (stops push notifications)
      this.prisma.deviceToken.deleteMany({ where: { userId } }),
      // Update community memberships
      this.prisma.communityMember.updateMany({
        where: { userId },
        data: { status: 'LEFT' },
      }),
      // Soft-delete the user
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          deletedAt: now,
          authId: `deleted:${userId}:${now.getTime()}`,
        },
      }),
    ]);

    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'USER_ACCOUNT_DELETED',
          resourceType: 'USER',
          resourceId: userId,
          afterState: { reason: reason ?? 'user_requested', deletedAt: now.toISOString() },
        },
      });
    } catch {
      // Audit log failures should not block deletion
    }

    return {
      deleted: true,
      deleted_at: now,
    };
  }
}

