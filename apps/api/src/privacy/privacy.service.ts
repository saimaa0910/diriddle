import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RecordConsentDto } from './dto/record-consent.dto';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async getConsentHistory(userId: string) {
    const consents = await this.prisma.userConsent.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });

    return {
      data: consents.map((c) => ({
        id: c.id,
        consent_type: c.consentType,
        version: c.version,
        granted: c.granted,
        granted_at: c.grantedAt,
      })),
    };
  }

  async recordConsent(userId: string, dto: RecordConsentDto) {
    const record = await this.prisma.userConsent.create({
      data: {
        userId,
        consentType: dto.consent_type,
        version: dto.version,
        granted: dto.granted,
        ipAddress: dto.ip_address ?? null,
      },
    });

    return {
      id: record.id,
      consent_type: record.consentType,
      version: record.version,
      granted: record.granted,
      granted_at: record.grantedAt,
    };
  }

  async getRetentionPolicies() {
    let policies = await this.prisma.retentionPolicy.findMany({
      orderBy: { createdAt: 'asc' },
    });

    if (policies.length === 0) {
      // Default privacy and retention standard policies
      return {
        data: [
          {
            data_type: 'EPHEMERAL_GPS',
            retention_hours: 1,
            legal_basis: 'Explicit Consent / Service Delivery',
            description: 'Precise coordinates snapped to ~5km coarse cell and automatically deleted after expiry.',
          },
          {
            data_type: 'OTP_CHALLENGES',
            retention_minutes: 5,
            legal_basis: 'Security / Authentication',
            description: 'PBKDF2 HMAC-SHA256 hashed OTPs deleted upon consumption or after 5 minutes.',
          },
          {
            data_type: 'USER_SESSIONS',
            retention_days: 30,
            legal_basis: 'Security / Session Integrity',
            description: 'Active sessions revoked upon logout, password reset, or inactivity timeout.',
          },
          {
            data_type: 'ACCOUNT_DELETION_GRACE_PERIOD',
            retention_days: 30,
            legal_basis: 'Data Subject Rights (GDPR Art. 17 / DPDP)',
            description: 'Configurable grace recovery window before irreversible database erasure.',
          },
          {
            data_type: 'CONTENT_RETENTION',
            retention_days: null,
            legal_basis: 'Legitimate Interest / User Choice',
            description: 'Anonymous posts and comments retained until author deletion or community moderation.',
          },
        ],
      };
    }

    return {
      data: policies.map((p) => ({
        id: p.id,
        data_type: p.dataType,
        retention_days: p.retentionDays,
        legal_basis: p.legalBasis,
      })),
    };
  }

  async logIdentityAccess(
    actorId: string,
    identityId: string,
    accessReason: string,
    ipAddress?: string,
  ) {
    const log = await this.prisma.identityAccessLog.create({
      data: {
        actorId,
        identityId,
        accessReason,
        ipAddress: ipAddress ?? null,
      },
    });

    return {
      id: log.id,
      identity_id: log.identityId,
      logged_at: log.createdAt,
    };
  }

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        authIdentities: true,
        anonymousIdentities: {
          include: { community: { select: { id: true, name: true, city: true } } },
        },
        locationPreference: true,
        userConsents: { orderBy: { grantedAt: 'desc' } },
        sessions: { where: { revokedAt: null } },
        loginHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User account not found' });
    }

    const [posts, comments, reactions] = await Promise.all([
      this.prisma.post.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { community: { select: { name: true, city: true } } },
      }),
      this.prisma.comment.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      export_version: '2.0',
      exported_at: new Date(),
      account: {
        status: user.status,
        age_verified: user.ageVerified,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
      profile: user.userProfile
        ? {
            display_name: user.userProfile.displayName,
            avatar_url: user.userProfile.avatarUrl,
            interests: user.userProfile.interests,
            preferred_language: user.userProfile.preferredLanguage,
            gender: user.userProfile.gender,
            age_band: user.userProfile.ageBand,
          }
        : null,
      auth_providers: (user as any).authIdentities?.map((a: any) => ({
        provider: a.provider,
        verified_at: a.verifiedAt,
        linked_at: a.createdAt,
      })) ?? [],
      identities: (user.anonymousIdentities ?? []).map((i) => ({
        is_global: i.isGlobal,
        display_code: i.displayCode,
        community_name: i.community?.name ?? 'Global',
        created_at: i.createdAt,
      })),
      location_preference: user.locationPreference
        ? {
            selected_city: user.locationPreference.selectedCity,
            selected_state: user.locationPreference.selectedState,
            location_permission_granted: user.locationPreference.locationPermissionGranted,
          }
        : null,
      content: {
        posts: posts.map((p) => ({
          id: p.id,
          content: p.content,
          category: p.category,
          community_name: p.community?.name ?? null,
          created_at: p.createdAt,
        })),
        comments: comments.map((c) => ({
          id: c.id,
          post_id: c.postId,
          content: c.content,
          created_at: c.createdAt,
        })),
        reactions: reactions.map((r) => ({
          post_id: r.postId,
          reaction_type: r.reactionType,
          created_at: r.createdAt,
        })),
      },
      consents: (user.userConsents ?? []).map((c) => ({
        consent_type: c.consentType,
        version: c.version,
        granted: c.granted,
        granted_at: c.grantedAt,
      })),
      sessions: {
        active_count: (user as any).sessions?.length ?? 0,
        recent_logins: (user as any).loginHistory?.map((l: any) => ({
          platform: l.platform,
          city: l.approximateCity,
          success: l.success,
          timestamp: l.createdAt,
        })) ?? [],
      },
    };
  }
}
