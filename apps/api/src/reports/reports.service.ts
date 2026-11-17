import { ConflictException, Injectable } from '@nestjs/common';
import { ReportReason } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface CreateReportInput {
  reporterId: string;
  target_type: 'POST' | 'COMMENT' | 'USER' | 'COMMUNITY' | 'IDENTITY' | string;
  target_id: string;
  reason: ReportReason;
  description?: string;
  community_id?: string;
  evidence_urls?: string[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReportInput) {
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: input.reporterId,
        targetType: input.target_type,
        targetId: input.target_id,
        status: { in: ['RECEIVED', 'UNDER_REVIEW'] as any },
      },
    });

    if (existing) {
      throw new ConflictException({
        error: 'DUPLICATE_REPORT',
        message: 'You have already submitted an open report for this item',
      });
    }

    const priority = this.computePriority(input.reason);
    const report = await this.prisma.report.create({
      data: {
        reporterId: input.reporterId,
        targetType: input.target_type,
        targetId: input.target_id,
        reason: input.reason,
        description: input.description ?? null,
        communityId: input.community_id ?? null,
        evidenceUrls: input.evidence_urls ?? [],
        status: 'RECEIVED',
        priority,
      },
    });

    return {
      id: report.id,
      status: report.status,
      priority: report.priority,
      created_at: report.createdAt,
    };
  }

  async getMyReports(reporterId: string) {
    const reports = await this.prisma.report.findMany({
      where: { reporterId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: reports.map((r) => ({
        id: r.id,
        target_type: r.targetType,
        target_id: r.targetId,
        reason: r.reason,
        status: r.status,
        priority: r.priority,
        created_at: r.createdAt,
        resolved_at: r.resolvedAt,
      })),
    };
  }

  private computePriority(reason: ReportReason): 'CRITICAL' | 'HIGH' | 'NORMAL' {
    if (reason === 'DOXXING') return 'CRITICAL';
    if (reason === 'HATE_SPEECH' || reason === 'HARASSMENT' || reason === 'NSFW') return 'HIGH';
    return 'NORMAL';
  }
}

