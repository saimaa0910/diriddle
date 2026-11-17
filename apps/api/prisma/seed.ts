import { PrismaClient, CommunityType, PostCategory } from '@prisma/client';

const prisma = new PrismaClient();

const CITIES = [
  { name: 'Mumbai', slug: 'mumbai', city: 'Mumbai', state: 'Maharashtra', stateCode: 'MH', geoCell: 'h3_in_mumbai_01', lat: 19.076, lng: 72.8777, aliases: ['Bombay'] },
  { name: 'Delhi', slug: 'delhi', city: 'Delhi', state: 'Delhi', stateCode: 'DL', geoCell: 'h3_in_delhi_01', lat: 28.6139, lng: 77.209, aliases: ['New Delhi', 'NCR'] },
  { name: 'Bengaluru', slug: 'bengaluru', city: 'Bengaluru', state: 'Karnataka', stateCode: 'KA', geoCell: 'h3_in_blr_01', lat: 12.9716, lng: 77.5946, aliases: ['Bangalore'] },
  { name: 'Hyderabad', slug: 'hyderabad', city: 'Hyderabad', state: 'Telangana', stateCode: 'TS', geoCell: 'h3_in_hyd_01', lat: 17.385, lng: 78.4867, aliases: ['Cyberabad'] },
  { name: 'Chennai', slug: 'chennai', city: 'Chennai', state: 'Tamil Nadu', stateCode: 'TN', geoCell: 'h3_in_maa_01', lat: 13.0827, lng: 80.2707, aliases: ['Madras'] },
  { name: 'Kolkata', slug: 'kolkata', city: 'Kolkata', state: 'West Bengal', stateCode: 'WB', geoCell: 'h3_in_ccu_01', lat: 22.5726, lng: 88.3639, aliases: ['Calcutta'] },
  { name: 'Pune', slug: 'pune', city: 'Pune', state: 'Maharashtra', stateCode: 'MH', geoCell: 'h3_in_pnq_01', lat: 18.5204, lng: 73.8567, aliases: ['Poona'] },
  { name: 'Ahmedabad', slug: 'ahmedabad', city: 'Ahmedabad', state: 'Gujarat', stateCode: 'GJ', geoCell: 'h3_in_amd_01', lat: 23.0225, lng: 72.5714, aliases: ['Amdavad'] },
  { name: 'Jaipur', slug: 'jaipur', city: 'Jaipur', state: 'Rajasthan', stateCode: 'RJ', geoCell: 'h3_in_jai_01', lat: 26.9124, lng: 75.7873, aliases: ['Pink City'] },
  { name: 'Lucknow', slug: 'lucknow', city: 'Lucknow', state: 'Uttar Pradesh', stateCode: 'UP', geoCell: 'h3_in_lko_01', lat: 26.8467, lng: 80.9462, aliases: ['City of Nawabs'] },
];

const LOCAL_COMMUNITIES = [
  { name: 'Koramangala', slug: 'koramangala-blr', type: CommunityType.NEIGHBORHOOD, city: 'Bengaluru', state: 'Karnataka', geoCell: 'h3_in_blr_krm' },
  { name: 'Indiranagar', slug: 'indiranagar-blr', type: CommunityType.NEIGHBORHOOD, city: 'Bengaluru', state: 'Karnataka', geoCell: 'h3_in_blr_ind' },
  { name: 'Bandra West', slug: 'bandra-west-bom', type: CommunityType.NEIGHBORHOOD, city: 'Mumbai', state: 'Maharashtra', geoCell: 'h3_in_bom_ban' },
  { name: 'IIT Bombay Campus', slug: 'iit-bombay', type: CommunityType.CAMPUS, city: 'Mumbai', state: 'Maharashtra', geoCell: 'h3_in_bom_iit' },
  { name: 'Hauz Khas', slug: 'hauz-khas-del', type: CommunityType.NEIGHBORHOOD, city: 'Delhi', state: 'Delhi', geoCell: 'h3_in_del_hk' },
  { name: 'DU North Campus', slug: 'du-north-campus', type: CommunityType.CAMPUS, city: 'Delhi', state: 'Delhi', geoCell: 'h3_in_del_du' },
  { name: 'Madhapur', slug: 'madhapur-hyd', type: CommunityType.NEIGHBORHOOD, city: 'Hyderabad', state: 'Telangana', geoCell: 'h3_in_hyd_mad' },
  { name: 'Kothrud', slug: 'kothrud-pnq', type: CommunityType.NEIGHBORHOOD, city: 'Pune', state: 'Maharashtra', geoCell: 'h3_in_pnq_kot' },
];

const RETENTION_POLICIES = [
  { dataType: 'TEMPORARY_GPS', retentionDays: 1, legalBasis: 'Location-based feed discovery (ephemeral)' },
  { dataType: 'AUDIT_LOGS', retentionDays: 365, legalBasis: 'Security and fraud prevention' },
  { dataType: 'ACCOUNT_DELETION_RECOVERY', retentionDays: 30, legalBasis: 'User right to erasure grace recovery window' },
  { dataType: 'CONSENT_RECORDS', retentionDays: 1825, legalBasis: 'Regulatory compliance (Digital Personal Data Protection Act)' },
  { dataType: 'INACTIVE_SESSIONS', retentionDays: 90, legalBasis: 'Device session cleanup' },
];

async function main() {
  console.log('Seeding diriddle PostgreSQL database...');

  // 1. Seed Country
  const india = await prisma.country.upsert({
    where: { code: 'IN' },
    update: {},
    create: {
      name: 'India',
      code: 'IN',
      isActive: true,
    },
  });
  console.log(`  + Country: ${india.name}`);

  // 2. Seed States and Cities in Geography tables
  const stateMap = new Map<string, string>();
  for (const c of CITIES) {
    if (!stateMap.has(c.state)) {
      const state = await prisma.state.create({
        data: {
          countryId: india.id,
          name: c.state,
          code: c.stateCode,
          isActive: true,
        },
      });
      stateMap.set(c.state, state.id);
      console.log(`  + State: ${c.state}`);
    }

    const stateId = stateMap.get(c.state)!;
    await prisma.city.upsert({
      where: { slug: c.slug },
      update: {
        aliases: c.aliases,
        centerLat: c.lat,
        centerLng: c.lng,
        isActive: true,
      },
      create: {
        stateId,
        name: c.name,
        slug: c.slug,
        aliases: c.aliases,
        centerLat: c.lat,
        centerLng: c.lng,
        radiusKm: 25,
        isActive: true,
        activatedAt: new Date(),
      },
    });
    console.log(`  + Geo City: ${c.name}`);
  }

  // 3. Seed Retention Policies
  for (const p of RETENTION_POLICIES) {
    const existing = await prisma.retentionPolicy.findFirst({
      where: { dataType: p.dataType },
    });
    if (!existing) {
      await prisma.retentionPolicy.create({
        data: p,
      });
      console.log(`  + Retention Policy: ${p.dataType} (${p.retentionDays}d)`);
    }
  }

  // 4. Seed Communities
  const communityMap = new Map<string, string>();

  for (const c of CITIES) {
    const community = await prisma.community.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        type: CommunityType.CITY,
        city: c.city,
        state: c.state,
        geoCell: c.geoCell,
        status: 'ACTIVE',
      },
    });
    communityMap.set(c.slug, community.id);
    console.log(`  + City Community: ${c.name}`);
  }

  for (const c of LOCAL_COMMUNITIES) {
    const community = await prisma.community.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        type: c.type,
        city: c.city,
        state: c.state,
        geoCell: c.geoCell,
        status: 'ACTIVE',
      },
    });
    communityMap.set(c.slug, community.id);
    console.log(`  + Local Community: ${c.name} (${c.city})`);
  }

  // 5. Seed Super Admin Demo User
  const demoUser = await prisma.user.upsert({
    where: { authId: 'phone:+919876543210' },
    update: {},
    create: {
      authId: 'phone:+919876543210',
      ageVerified: true,
      status: 'ACTIVE',
    },
  });

  await prisma.adminRole.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      role: 'SUPER_ADMIN',
      scope: 'PLATFORM',
    },
  });

  // 6. Seed Sample Posts
  const samplePosts = [
    {
      slug: 'bengaluru',
      category: PostCategory.CONFESSION,
      content: 'Left a startup job in Koramangala after 3 years and honestly just sitting at Third Wave Coffee all afternoon feels unreal.',
    },
    {
      slug: 'mumbai',
      category: PostCategory.LOCAL_ALERT,
      content: 'Heavy waterlogging near Western Express Highway Andheri flyover — take the metro if heading south.',
    },
    {
      slug: 'delhi',
      category: PostCategory.QUESTION,
      content: 'Which library or quiet cafe in South Delhi stays open past 11 PM without blasting EDM?',
    },
    {
      slug: 'hyderabad',
      category: PostCategory.NEIGHBORHOOD,
      content: 'Evening Irani chai + Osmania biscuit meetup near Madhapur lake walking track was unexpectedly wholesome.',
    },
    {
      slug: 'iit-bombay',
      category: PostCategory.CAMPUS,
      content: 'Midsem week energy in Hostel 5: everyone pretends to study while debating Maggi recipes at 2 AM.',
    },
  ];

  const existingPosts = await prisma.post.count();
  if (existingPosts === 0) {
    for (let i = 0; i < samplePosts.length; i++) {
      const sp = samplePosts[i];
      const communityId = communityMap.get(sp.slug);
      if (!communityId) continue;

      let identity = await prisma.anonymousIdentity.findFirst({
        where: { userId: demoUser.id, communityId },
      });
      if (!identity) {
        identity = await prisma.anonymousIdentity.create({
          data: {
            userId: demoUser.id,
            communityId,
            displayCode: `Anonymous #${String(1001 + i).padStart(4, '0')}`,
          },
        });
      }

      await prisma.post.create({
        data: {
          userId: demoUser.id,
          anonymousIdentityId: identity.id,
          communityId,
          category: sp.category,
          content: sp.content,
          status: 'PUBLISHED',
          visibility: 'COMMUNITY',
        },
      });
    }
    console.log('  + Demo posts seeded');
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
