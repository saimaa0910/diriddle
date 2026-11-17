import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CommunityGateway } from '../realtime/community.gateway';
import { buildPaginatedResponse, decodeCursor } from '../common/utils/pagination.util';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CommunityGateway,
  ) {}

  async listForUser(userId: string, pagination: { cursor?: string; limit?: number }) {
    const limit = Math.min(Math.max(pagination.limit ?? 20, 1), 50);
    const decoded = decodeCursor(pagination.cursor);

    const where: Record<string, any> = { userId };
    if (decoded) {
      where.createdAt = { lt: new Date(decoded.createdAt) };
    }

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        take: limit + 1,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    const mapped = items.map((n) => ({
      id: n.id,
      type: n.type,
      reference_id: n.referenceId,
      payload: n.payload,
      read_at: n.readAt,
      created_at: n.createdAt,
    }));

    return {
      ...buildPaginatedResponse(mapped, limit, (item) => ({
        id: item.id,
        createdAt: new Date(item.created_at).toISOString(),
      })),
      unread_count: unreadCount,
    };
  }

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markRead(idOrUserId: string, userIdOrId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        OR: [
          { id: idOrUserId, userId: userIdOrId },
          { id: userIdOrId, userId: idOrUserId },
        ],
      },
    });
    if (!notification) {
      throw new NotFoundException({
        error: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });

    return {
      id: updated.id,
      read_at: updated.readAt,
    };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async getPreferences(userId: string) {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    return {
      data: prefs.map((p) => ({
        notification_type: p.notificationType,
        push_enabled: p.pushEnabled,
        in_app_enabled: p.inAppEnabled,
        updated_at: p.updatedAt,
      })),
    };
  }

  async updatePreference(
    userId: string,
    notificationType: string,
    pushEnabled: boolean,
    inAppEnabled: boolean,
  ) {
    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId_notificationType: { userId, notificationType } },
      create: { userId, notificationType, pushEnabled, inAppEnabled },
      update: { pushEnabled, inAppEnabled },
    });
    return {
      notification_type: pref.notificationType,
      push_enabled: pref.pushEnabled,
      in_app_enabled: pref.inAppEnabled,
    };
  }

  async registerDeviceToken(userId: string, token: string, platform: string) {
    const device = await this.prisma.deviceToken.upsert({
      where: { userId_token: { userId, token } },
      create: { userId, token, platform, lastSeenAt: new Date() },
      update: { platform, lastSeenAt: new Date() },
    });
    return { id: device.id, registered: true };
  }

  async removeDeviceToken(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({
      where: { userId, token },
    });
    return { removed: true };
  }

  async notify(
    userId: string,
    type: NotificationType,
    referenceId: string | null,
    payload: Record<string, any>,
  ) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_notificationType: { userId, notificationType: type } },
    });
    if (pref && !pref.inAppEnabled) {
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        referenceId,
        payload,
      },
    });

    const dto = {
      id: notification.id,
      type: notification.type,
      reference_id: notification.referenceId,
      payload: notification.payload,
      read_at: notification.readAt,
      created_at: notification.createdAt,
    };

    this.gateway.sendNotification(userId, dto);
    return dto;
  }
}

