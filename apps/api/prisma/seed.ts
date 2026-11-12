import { PrismaClient, CommunityType, PostCategory } from '@prisma/client';

const prisma = new PrismaClient();

const CITIES = [
  { name: 'Mumbai', slug: 'mumbai', city: 'Mumbai', state: 'Maharashtra', geoCell: 'h3_in_mumbai_01' },
  { name: 'Delhi', slug: 'delhi', city: 'Delhi', state: 'Delhi', geoCell: 'h3_in_delhi_01' },
  { name: 'Bengaluru', slug: 'bengaluru', city: 'Bengaluru', state: 'Karnataka', geoCell: 'h3_in_blr_01' },
  { name: 'Hyderabad', slug: 'hyderabad', city: 'Hyderabad', state: 'Telangana', geoCell: 'h3_in_hyd_01' },
  { name: 'Chennai', slug: 'chennai', city: 'Chennai', state: 'Tamil Nadu', geoCell: 'h3_in_maa_01' },
  { name: 'Kolkata', slug: 'kolkata', city: 'Kolkata', state: 'West Bengal', geoCell: 'h3_in_ccu_01' },
  { name: 'Pune', slug: 'pune', city: 'Pune', state: 'Maharashtra', geoCell: 'h3_in_pnq_01' },
  { name: 'Ahmedabad', slug: 'ahmedabad', city: 'Ahmedabad', state: 'Gujarat', geoCell: 'h3_in_amd_01' },
  { name: 'Jaipur', slug: 'jaipur', city: 'Jaipur', state: 'Rajasthan', geoCell: 'h3_in_jai_01' },
  { name: 'Lucknow', slug: 'lucknow', city: 'Lucknow', state: 'Uttar Pradesh', geoCell: 'h3_in_lko_01' },
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

async function main() {
  console.log('Seeding diriddle PostgreSQL database...');

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
    console.log(`  + City: ${c.name}`);
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
    console.log(`  + Local community: ${c.name} (${c.city})`);
  }

  // Demo user + admin role for local testing
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
