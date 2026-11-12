import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AppealStatus, ModerationActionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface ContentSafetyResult {
  allowed: boolean;
  action: 'PUBLISH' | 'HOLD_FOR_REVIEW' | 'REJECT';
  reasons: string[];
  detectedPatterns: string[];
}

export interface TakeModerationActionInput {
  target_type: 'POST' | 'COMMENT' | 'USER' | 'REPORT';
  target_id: string;
  action_type: ModerationActionType;
  reason: string;
  notes?: string;
  report_id?: string;
  expires_at?: string;
}

const INDIAN_PHONE_REGEX = /(?:\+91[\s-]?)?[6-9]\d{9}\b/;
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const AADHAAR_REGEX = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}\d{4}[A-Z]\b/;
const URL_REGEX = /https?:\/\/\S+/gi;
const REPEATED_CHAR_REGEX = /(.)\1{14,}/;
const SEVERE_KEYWORDS = ['doxx', 'kill yourself', 'kys', 'bomb threat', 'leaked address'];

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  checkContentSafety(content: string): ContentSafetyResult {
    const reasons: string[] = [];
    const detectedPatterns: string[] = [];

    if (INDIAN_PHONE_REGEX.test(content)) {
      reasons.push('Potential phone number PII detected');
      detectedPatterns.push('PHONE_NUMBER');
    }
    if (EMAIL_REGEX.test(content)) {
      reasons.push('Potential email address PII detected');
      detectedPatterns.push('EMAIL');
    }
    if (AADHAAR_REGEX.test(content)) {
      reasons.push('Potential 12-digit ID / Aadhaar PII detected');
      detectedPatterns.push('AADHAAR_NUMBER');
    }
    if (PAN_REGEX.test(content)) {
      reasons.push('Potential PAN card identifier detected');
      detectedPatterns.push('PAN_NUMBER');
    }

    const lower = content.toLowerCase();
    for (const kw of SEVERE_KEYWORDS) {
      if (lower.includes(kw)) {
        reasons.push(`Flagged safety keyword: ${kw}`);
        detectedPatterns.push('SAFETY_KEYWORD');
        break;
      }
    }

    const urls = content.match(URL_REGEX) ?? [];
    if (urls.length >= 4 || REPEATED_CHAR_REGEX.test(content)) {
      reasons.push('Potential spam pattern detected');
      detectedPatterns.push('SPAM_PATTERN');
    }

    if (detectedPatterns.includes('AADHAAR_NUMBER') || detectedPatterns.includes('PAN_NUMBER')) {
      return {
        allowed: false,
        action: 'REJECT',
        reasons,
        detectedPatterns,
      };
    }

    if (detectedPatterns.length > 0) {
      return {
        allowed: true,
        action: 'HOLD_FOR_REVIEW',
        reasons,
        detectedPatterns,
      };
    }

    return {
      allowed: true,
      action: 'PUBLISH',
      reasons: [],
      detectedPatterns: [],
    };
  }

  async getQueue(filters: { status?: string; targetType?: string }) {
    const reports = await this.prisma.report.findMany({
      where: {
        ...(filters.status ? { status: filters.status as any } : { status: { in: ['RECEIVED', 'UNDER_REVIEW'] as any } }),
        ...(filters.targetType ? { targetType: filters.targetType } : {}),
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 50,
    });

    const flaggedPosts = await this.prisma.post.findMany({
      where: { status: 'UNDER_REVIEW', deletedAt: null },
      include: { anonymousIdentity: true, community: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return {
      reports: reports.map((r) => ({
        id: r.id,
        target_type: r.targetType,
        target_id: r.targetId,
        reason: r.reason,
        description: r.description,
        status: r.status,
        priority: r.priority,
        created_at: r.createdAt,
      })),
      flagged_posts: flaggedPosts.map((p) => ({
        id: p.id,
        anonymous_name: p.anonymousIdentity?.displayCode ?? 'Anonymous',
        community_name: p.community?.name ?? 'Unknown',
        category: p.category,
        content: p.content,
        status: p.status,
        created_at: p.createdAt,
      })),
    };
  }

  async takeAction(
    moderatorId: string,
    input: TakeModerationActionInput,
    ipAddress?: string,
  ) {
    const action = await this.prisma.moderationAction.create({
      data: {
        moderatorId,
        targetType: input.target_type,
        targetId: input.target_id,
        actionType: input.action_type,
        reason: input.reason,
        notes: input.notes ?? null,
        expiresAt: input.expires_at ? new Date(input.expires_at) : null,
      },
    });

    let beforeState: Record<string, any> | null = null;
    let afterState: Record<string, any> | null = null;

    if (input.target_type === 'POST') {
      const post = await this.prisma.post.findUnique({ where: { id: input.target_id } });
      if (post) {
        beforeState = { status: post.status };
        const nextStatus =
          input.action_type === 'APPROVE'
            ? 'PUBLISHED'
            : input.action_type === 'REMOVE'
              ? 'REMOVED'
              : input.action_type === 'ESCALATE'
                ? 'UNDER_REVIEW'
                : post.status;
        await this.prisma.post.update({
          where: { id: post.id },
          data: { status: nextStatus as any },
        });
        afterState = { status: nextStatus };
      }
    } else if (input.target_type === 'COMMENT') {
      const comment = await this.prisma.comment.findUnique({ where: { id: input.target_id } });
      if (comment) {
        beforeState = { status: comment.status };
        const nextStatus =
          input.action_type === 'APPROVE'
            ? 'ACTIVE'
            : input.action_type === 'REMOVE'
              ? 'REMOVED'
              : 'FLAGGED';
        await this.prisma.comment.update({
          where: { id: comment.id },
          data: { status: nextStatus as any },
        });
        afterState = { status: nextStatus };
      }
    } else if (input.target_type === 'USER') {
      const targetUser = await this.prisma.user.findUnique({ where: { id: input.target_id } });
      if (targetUser) {
        beforeState = { status: targetUser.status };
        const nextStatus =
          input.action_type === 'TEMPORARY_SUSPENSION' ||
          input.action_type === 'PERMANENT_SUSPENSION'
            ? 'SUSPENDED'
            : input.action_type === 'APPROVE'
              ? 'ACTIVE'
              : targetUser.status;
        await this.prisma.user.update({
          where: { id: targetUser.id },
          data: { status: nextStatus as any },
        });
        afterState = { status: nextStatus };
      }
    }

    if (input.report_id) {
      await this.prisma.report.update({
        where: { id: input.report_id },
        data: {
          status: input.action_type === 'APPROVE' ? 'DISMISSED' : 'RESOLVED',
          resolvedAt: new Date(),
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: moderatorId,
        action: `MODERATION_${input.action_type}`,
        resourceType: input.target_type,
        resourceId: input.target_id,
        beforeState: beforeState ?? undefined,
        afterState: { ...(afterState ?? {}), reason: input.reason },
        ipAddress: ipAddress ?? null,
      },
    });

    return {
      id: action.id,
      target_type: action.targetType,
      target_id: action.targetId,
      action_type: action.actionType,
      reason: action.reason,
      created_at: action.createdAt,
    };
  }

  async submitAppeal(userId: string, moderationActionId: string, reason: string) {
    const modAction = await this.prisma.moderationAction.findUnique({
      where: { id: moderationActionId },
    });
    if (!modAction) {
      throw new NotFoundException({
        error: 'MODERATION_ACTION_NOT_FOUND',
        message: 'Moderation action not found',
      });
    }

    const appeal = await this.prisma.moderationAppeal.create({
      data: {
        userId,
        moderationActionId,
        reason,
        status: 'PENDING',
      },
    });

    return {
      id: appeal.id,
      moderation_action_id: appeal.moderationActionId,
      status: appeal.status,
      created_at: appeal.createdAt,
    };
  }

  async listAppeals(status?: AppealStatus) {
    const appeals = await this.prisma.moderationAppeal.findMany({
      where: status ? { status } : {},
      include: { moderationAction: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: appeals.map((a) => ({
        id: a.id,
        user_id: a.userId,
        moderation_action_id: a.moderationActionId,
        action_type: a.moderationAction?.actionType ?? null,
        reason: a.reason,
        status: a.status,
        resolution_notes: a.resolutionNotes,
        created_at: a.createdAt,
        resolved_at: a.resolvedAt,
      })),
    };
  }

  async listMyAppeals(userId: string) {
    const appeals = await this.prisma.moderationAppeal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { data: appeals };
  }

  async resolveAppeal(
    reviewerId: string,
    appealId: string,
    status: 'APPROVED' | 'REJECTED',
    resolutionNotes?: string,
  ) {
    const appeal = await this.prisma.moderationAppeal.findUnique({
      where: { id: appealId },
      include: { moderationAction: true },
    });
    if (!appeal) {
      throw new NotFoundException({
        error: 'APPEAL_NOT_FOUND',
        message: 'Moderation appeal not found',
      });
    }
    if (appeal.userId === reviewerId) {
      throw new ForbiddenException({
        error: 'SELF_REVIEW_FORBIDDEN',
        message: 'Cannot review your own appeal',
      });
    }

    const updated = await this.prisma.moderationAppeal.update({
      where: { id: appealId },
      data: {
        status,
        reviewerId,
        resolutionNotes: resolutionNotes ?? null,
        resolvedAt: new Date(),
      },
    });

    if (status === 'APPROVED' && appeal.moderationAction) {
      await this.takeAction(reviewerId, {
        target_type: appeal.moderationAction.targetType as any,
        target_id: appeal.moderationAction.targetId,
        action_type: 'APPROVE',
        reason: `Appeal ${appealId} approved`,
      });
    }

    return {
      id: updated.id,
      status: updated.status,
      resolved_at: updated.resolvedAt,
    };
  }
}
