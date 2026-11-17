import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  ipAddress?: string;
  userAgent?: string;
  approximateCity?: string;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    userId: string,
    jti: string,
    expiresAt: Date,
    deviceInfo?: DeviceInfo,
  ) {
    return this.prisma.session.create({
      data: {
        userId,
        jti,
        deviceId: deviceInfo?.deviceId ?? null,
        deviceName: deviceInfo?.deviceName ?? null,
        platform: deviceInfo?.platform ?? null,
        ipAddress: deviceInfo?.ipAddress ?? null,
        userAgent: deviceInfo?.userAgent ?? null,
        lastActiveAt: new Date(),
        expiresAt,
        revokedAt: null,
      },
    });
  }

  async listActiveSessions(userId: string) {
    const now = new Date();
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return {
      data: sessions.map((s) => ({
        id: s.id,
        device_id: s.deviceId,
        device_name: s.deviceName,
        platform: s.platform,
        last_active_at: s.lastActiveAt,
        created_at: s.createdAt,
      })),
    };
  }

  async revokeSession(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException({
        error: 'SESSION_NOT_FOUND',
        message: 'Active session not found',
      });
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return { revoked: true, session_id: sessionId };
  }

  async revokeAllSessions(userId: string) {
    const res = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { revoked_count: res.count ?? 0 };
  }

  async isSessionRevoked(jti: string): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { jti },
    });
    if (!session) return false;
    return session.revokedAt !== null || session.expiresAt <= new Date();
  }

  async updateLastActive(jti: string): Promise<void> {
    try {
      await this.prisma.session.update({
        where: { jti },
        data: { lastActiveAt: new Date() },
      });
    } catch {
      // Session might not exist or be in memory, safe to ignore
    }
  }

  async recordLoginAttempt(
    userId: string,
    deviceInfo: DeviceInfo,
    success: boolean,
    failReason?: string,
  ) {
    return this.prisma.loginHistory.create({
      data: {
        userId,
        ipAddress: deviceInfo.ipAddress ?? null,
        userAgent: deviceInfo.userAgent ?? null,
        platform: deviceInfo.platform ?? null,
        approximateCity: deviceInfo.approximateCity ?? null,
        success,
        failReason: failReason ?? null,
      },
    });
  }

  async getLoginHistory(userId: string, limit = 20) {
    const records = await this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
    });

    return {
      data: records.map((r) => ({
        id: r.id,
        platform: r.platform,
        approximate_city: r.approximateCity,
        success: r.success,
        created_at: r.createdAt,
      })),
    };
  }
}
