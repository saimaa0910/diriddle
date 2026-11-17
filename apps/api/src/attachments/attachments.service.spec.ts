import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AttachmentType, AttachmentStatus } from '@prisma/client';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(AttachmentsService);
  });

  describe('initiateUpload', () => {
    it('initiates valid image upload and returns upload target with opaque url', async () => {
      const res = await service.initiateUpload('user-1', {
        type: AttachmentType.IMAGE,
        mime_type: 'image/jpeg',
        size_bytes: 2 * 1024 * 1024,
      });

      expect(res.attachment_id).toBeDefined();
      expect(res.status).toBe(AttachmentStatus.PENDING);
      expect(res.upload_target.method).toBe('PUT');
      expect(res.upload_target.url).toContain('/v1/media/attachments/image/');
    });

    it('rejects unsupported MIME type', async () => {
      await expect(
        service.initiateUpload('user-1', {
          type: AttachmentType.IMAGE,
          mime_type: 'application/x-executable',
          size_bytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects file exceeding size limit for its type', async () => {
      await expect(
        service.initiateUpload('user-1', {
          type: AttachmentType.IMAGE,
          mime_type: 'image/png',
          size_bytes: 20 * 1024 * 1024, // 20MB > 15MB limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects video exceeding 180 seconds maximum duration', async () => {
      await expect(
        service.initiateUpload('user-1', {
          type: AttachmentType.VIDEO,
          mime_type: 'video/mp4',
          size_bytes: 10 * 1024 * 1024,
          duration_seconds: 240, // 4 mins > 3 mins
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmUpload', () => {
    it('confirms upload and marks attachment as READY and scan CLEAN', async () => {
      const init = await service.initiateUpload('user-1', {
        type: AttachmentType.IMAGE,
        mime_type: 'image/webp',
        size_bytes: 500 * 1024,
      });

      const confirmed = await service.confirmUpload('user-1', init.attachment_id);
      expect(confirmed.status).toBe(AttachmentStatus.READY);
      expect(confirmed.scan_status).toBe('CLEAN');
    });

    it('throws NotFoundException for non-existent attachment ID', async () => {
      await expect(service.confirmUpload('user-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAttachment & getPostAttachments', () => {
    it('soft-deletes attachment and excludes it from post listing', async () => {
      const post = await store.post.create({
        data: {
          userId: 'user-1',
          communityId: 'comm-bengaluru',
          content: 'Post with image',
        },
      });

      const init = await service.initiateUpload('user-1', {
        post_id: post.id,
        type: AttachmentType.IMAGE,
        mime_type: 'image/jpeg',
        size_bytes: 1024 * 1024,
      });
      await service.confirmUpload('user-1', init.attachment_id);

      const beforeDelete = await service.getPostAttachments(post.id);
      expect(beforeDelete.data).toHaveLength(1);

      await service.deleteAttachment('user-1', init.attachment_id);

      const afterDelete = await service.getPostAttachments(post.id);
      expect(afterDelete.data).toHaveLength(0);
    });
  });
});
