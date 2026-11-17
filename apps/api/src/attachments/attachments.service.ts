import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentType, AttachmentStatus, AttachmentScanStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const ALLOWED_MIME_TYPES: Record<AttachmentType, string[]> = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  VIDEO: ['video/mp4', 'video/quicktime', 'video/webm'],
  DOCUMENT: ['application/pdf'],
};

const MAX_SIZE_BYTES: Record<AttachmentType, number> = {
  IMAGE: 15 * 1024 * 1024, // 15MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  DOCUMENT: 25 * 1024 * 1024, // 25MB
};

export interface InitiateUploadDto {
  post_id?: string;
  comment_id?: string;
  type: AttachmentType;
  mime_type: string;
  size_bytes: number;
  duration_seconds?: number;
}

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async initiateUpload(userId: string, dto: InitiateUploadDto) {
    const allowed = ALLOWED_MIME_TYPES[dto.type];
    if (!allowed || !allowed.includes(dto.mime_type.toLowerCase())) {
      throw new BadRequestException({
        error: 'INVALID_MIME_TYPE',
        message: `Allowed MIME types for ${dto.type}: ${allowed?.join(', ')}`,
      });
    }

    const maxSize = MAX_SIZE_BYTES[dto.type];
    if (dto.size_bytes > maxSize) {
      throw new BadRequestException({
        error: 'FILE_TOO_LARGE',
        message: `File exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
      });
    }

    if (dto.type === 'VIDEO' && dto.duration_seconds && dto.duration_seconds > 180) {
      throw new BadRequestException({
        error: 'VIDEO_TOO_LONG',
        message: 'Video duration must not exceed 180 seconds (3 minutes)',
      });
    }

    const opaqueStorageKey = `attachments/${dto.type.toLowerCase()}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const url = `/v1/media/${opaqueStorageKey}`;

    const attachment = await this.prisma.attachment.create({
      data: {
        postId: dto.post_id ?? null,
        commentId: dto.comment_id ?? null,
        type: dto.type,
        url,
        mimeType: dto.mime_type,
        sizeBytes: dto.size_bytes,
        durationSeconds: dto.duration_seconds ?? null,
        status: AttachmentStatus.PENDING,
        scanStatus: AttachmentScanStatus.PENDING,
      },
    });

    return {
      attachment_id: attachment.id,
      upload_target: {
        url: attachment.url,
        method: 'PUT',
        expires_in_seconds: 900,
      },
      status: attachment.status,
    };
  }

  async confirmUpload(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.deletedAt) {
      throw new NotFoundException({
        error: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    const updated = await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        status: AttachmentStatus.READY,
        scanStatus: AttachmentScanStatus.CLEAN,
      },
    });

    return {
      id: updated.id,
      url: updated.url,
      type: updated.type,
      status: updated.status,
      scan_status: updated.scanStatus,
    };
  }

  async deleteAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.deletedAt) {
      throw new NotFoundException({
        error: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    let isAuthorized = false;
    if (attachment.postId) {
      const post = await this.prisma.post.findUnique({ where: { id: attachment.postId } });
      if (post && post.userId === userId) {
        isAuthorized = true;
      }
    } else if (attachment.commentId) {
      const comment = await this.prisma.comment.findUnique({ where: { id: attachment.commentId } });
      if (comment && comment.userId === userId) {
        isAuthorized = true;
      }
    } else {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      const admin = await this.prisma.adminRole.findUnique({ where: { userId } });
      if (!admin || (admin.expiresAt && admin.expiresAt < new Date())) {
        throw new ForbiddenException({
          error: 'ATTACHMENT_DELETE_FORBIDDEN',
          message: 'Cannot delete attachment owned by another user',
        });
      }
    }

    await this.prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        status: AttachmentStatus.DELETED,
        deletedAt: new Date(),
      },
    });

    return { deleted: true, id: attachmentId };
  }

  async getPostAttachments(postId: string) {
    const attachments = await this.prisma.attachment.findMany({
      where: {
        postId,
        status: AttachmentStatus.READY,
        deletedAt: null,
      },
    });

    return {
      data: attachments.map((a) => ({
        id: a.id,
        type: a.type,
        url: a.url,
        thumbnail_url: a.thumbnailUrl,
        mime_type: a.mimeType,
        size_bytes: a.sizeBytes,
        duration_seconds: a.durationSeconds,
      })),
    };
  }
}
