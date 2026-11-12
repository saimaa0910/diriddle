import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReportReason } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('ReportsService', () => {
  let service: ReportsService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  it('assigns CRITICAL priority for DOXXING reports and prevents duplicates', async () => {
    const created = await service.create({
      reporterId: 'user-demo-admin',
      target_type: 'POST',
      target_id: 'post-demo-2',
      reason: ReportReason.DOXXING,
      description: 'Personal address exposed',
    });

    expect(created.status).toBe('RECEIVED');
    expect(created.priority).toBe('CRITICAL');

    await expect(
      service.create({
        reporterId: 'user-demo-admin',
        target_type: 'POST',
        target_id: 'post-demo-2',
        reason: ReportReason.DOXXING,
      }),
    ).rejects.toThrow(ConflictException);

    const myReports = await service.getMyReports('user-demo-admin');
    expect(myReports.data).toHaveLength(1);
  });
});
