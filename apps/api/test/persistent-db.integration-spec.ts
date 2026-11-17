import { PrismaClient } from '@prisma/client';

describe('Persistent PostgreSQL Database Integration Tests (DEV_IN_MEMORY=false)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DEV_IN_MEMORY = 'false';
    const databaseUrl =
      process.env.DATABASE_URL || 'postgresql://diriddle:diriddle@localhost:5432/diriddle_dev';
    prisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Successfully connects to real PostgreSQL 16 container', async () => {
    const result = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() as now;`;
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].now).toBeInstanceOf(Date);
  });

  it('2. Verifies all core application tables exist in PostgreSQL schema', async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    const tableNames = tables.map((t) => t.table_name);

    const requiredTables = [
      'users',
      'user_profiles',
      'auth_identities',
      'sessions',
      'anonymous_identities',
      'communities',
      'community_members',
      'posts',
      'comments',
      'reactions',
      'comment_reactions',
      'attachments',
      'reports',
      'blocks',
      'notifications',
      'moderation_actions',
      'moderation_appeals',
      'audit_logs',
      'identity_access_logs',
      'cities',
      'states',
      'countries',
      'retention_policies',
      'temporary_user_gps',
    ];

    for (const table of requiredTables) {
      expect(tableNames).toContain(table);
    }
  });

  it('3. Enforces unique constraint on anonymous_identities [user_id, community_id]', async () => {
    const user = await prisma.user.create({
      data: {
        authId: `phone:+919800000001`,
        status: 'ACTIVE',
      },
    });

    const community = await prisma.community.create({
      data: {
        name: `Test Community ${Date.now()}`,
        slug: `test-comm-${Date.now()}`,
        type: 'CAMPUS',
        description: 'Constraint test',
      },
    });

    // First identity should succeed
    const ident1 = await prisma.anonymousIdentity.create({
      data: {
        userId: user.id,
        communityId: community.id,
        displayCode: 'Anonymous #9001',
      },
    });
    expect(ident1.id).toBeDefined();

    // Duplicate user + community must fail with P2002
    await expect(
      prisma.anonymousIdentity.create({
        data: {
          userId: user.id,
          communityId: community.id,
          displayCode: 'Anonymous #9002',
        },
      }),
    ).rejects.toThrow();

    // Clean up
    await prisma.anonymousIdentity.delete({ where: { id: ident1.id } });
    await prisma.community.delete({ where: { id: community.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('4. Enforces unique constraint on anonymous_identities [community_id, display_code]', async () => {
    const user1 = await prisma.user.create({
      data: { authId: `phone:+919800000002`, status: 'ACTIVE' },
    });
    const user2 = await prisma.user.create({
      data: { authId: `phone:+919800000003`, status: 'ACTIVE' },
    });
    const community = await prisma.community.create({
      data: {
        name: `Display Code Comm ${Date.now()}`,
        slug: `disp-comm-${Date.now()}`,
        type: 'CAMPUS',
        description: 'Display code uniqueness test',
      },
    });

    const ident1 = await prisma.anonymousIdentity.create({
      data: {
        userId: user1.id,
        communityId: community.id,
        displayCode: 'Anonymous #7777',
      },
    });

    // Attempt same displayCode in same community for user2 -> must fail
    await expect(
      prisma.anonymousIdentity.create({
        data: {
          userId: user2.id,
          communityId: community.id,
          displayCode: 'Anonymous #7777',
        },
      }),
    ).rejects.toThrow();

    // Clean up
    await prisma.anonymousIdentity.delete({ where: { id: ident1.id } });
    await prisma.community.delete({ where: { id: community.id } });
    await prisma.user.delete({ where: { id: user1.id } });
    await prisma.user.delete({ where: { id: user2.id } });
  });

  it('5. Enforces unique constraint on comment_reactions [comment_id, user_id]', async () => {
    const user = await prisma.user.create({
      data: { authId: `phone:+919800000004`, status: 'ACTIVE' },
    });
    const community = await prisma.community.create({
      data: {
        name: `Comment Reaction Comm ${Date.now()}`,
        slug: `comm-react-${Date.now()}`,
        type: 'CAMPUS',
        description: 'Test',
      },
    });
    const ident = await prisma.anonymousIdentity.create({
      data: {
        userId: user.id,
        communityId: community.id,
        displayCode: 'Anonymous #1234',
      },
    });
    const post = await prisma.post.create({
      data: {
        userId: user.id,
        communityId: community.id,
        anonymousIdentityId: ident.id,
        category: 'STORY',
        content: 'Post for comment reaction test',
        status: 'PUBLISHED',
      },
    });
    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        userId: user.id,
        anonymousIdentityId: ident.id,
        content: 'Test comment for reaction',
      },
    });

    // First comment reaction succeeds
    const reaction1 = await prisma.commentReaction.create({
      data: {
        commentId: comment.id,
        userId: user.id,
        reactionType: 'LIKE',
      },
    });
    expect(reaction1.id).toBeDefined();

    // Duplicate reaction on same comment and user must fail
    await expect(
      prisma.commentReaction.create({
        data: {
          commentId: comment.id,
          userId: user.id,
          reactionType: 'HEART',
        },
      }),
    ).rejects.toThrow();

    // Clean up
    await prisma.commentReaction.delete({ where: { id: reaction1.id } });
    await prisma.comment.delete({ where: { id: comment.id } });
    await prisma.post.delete({ where: { id: post.id } });
    await prisma.anonymousIdentity.delete({ where: { id: ident.id } });
    await prisma.community.delete({ where: { id: community.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('6. Enforces foreign key integrity (rejects invalid parent relations)', async () => {
    // Attempting to create a post with non-existent community must fail with P2003
    await expect(
      prisma.post.create({
        data: {
          userId: 'non-existent-user-id',
          communityId: 'non-existent-comm-id',
          anonymousIdentityId: 'non-existent-ident-id',
          category: 'STORY',
          content: 'Should fail FK check',
        },
      }),
    ).rejects.toThrow();
  });

  it('7. Transaction rollback on error preserves database atomicity', async () => {
    const initialUserCount = await prisma.user.count();
    const testAuthId = `phone:+919800000005`;

    try {
      await prisma.$transaction(async (tx) => {
        // Step 1: create user
        await tx.user.create({
          data: { authId: testAuthId, status: 'ACTIVE' },
        });

        // Step 2: intentionally throw error to force rollback
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      });
    } catch (err: any) {
      expect(err.message).toBe('SIMULATED_TRANSACTION_FAILURE');
    }

    // Verify rollback: user count must remain unchanged, test user was not committed
    const finalUserCount = await prisma.user.count();
    expect(finalUserCount).toBe(initialUserCount);

    const rolledBackUser = await prisma.user.findUnique({
      where: { authId: testAuthId },
    });
    expect(rolledBackUser).toBeNull();
  });

  it('8. Verifies persistent seed data: 10 Indian launch cities and retention policies', async () => {
    const cities = await prisma.city.findMany();
    expect(cities.length).toBeGreaterThanOrEqual(10);

    const cityNames = cities.map((c) => c.name);
    expect(cityNames).toContain('Mumbai');
    expect(cityNames).toContain('Bengaluru');
    expect(cityNames).toContain('Delhi');
    expect(cityNames).toContain('Hyderabad');
    expect(cityNames).toContain('Chennai');
    expect(cityNames).toContain('Kolkata');
    expect(cityNames).toContain('Pune');
    expect(cityNames).toContain('Ahmedabad');
    expect(cityNames).toContain('Jaipur');
    expect(cityNames).toContain('Lucknow');

    const policies = await prisma.retentionPolicy.findMany();
    expect(policies.length).toBeGreaterThanOrEqual(5);
    const policyTypes = policies.map((p) => p.dataType);
    expect(policyTypes).toContain('TEMPORARY_GPS');
    expect(policyTypes).toContain('AUDIT_LOGS');
    expect(policyTypes).toContain('ACCOUNT_DELETION_RECOVERY');
  });
});
