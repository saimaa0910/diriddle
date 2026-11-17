import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { BlocksService } from '../blocks/blocks.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('SearchService', () => {
  let service: SearchService;
  let blocksService: BlocksService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        BlocksService,
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    service = module.get(SearchService);
    blocksService = module.get(BlocksService);
  });

  it('searches published posts by keyword and hides blocked users', async () => {
    // "Koramangala" is present in demo post 1
    const res = await service.searchPosts({
      query: 'Koramangala',
      userId: 'searcher-1',
    });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].content).toContain('Koramangala');

    // If author (user-demo-admin) is blocked by searcher, it should not appear
    await blocksService.block('searcher-1', 'user-demo-admin');
    const blockedRes = await service.searchPosts({
      query: 'Koramangala',
      userId: 'searcher-1',
    });
    expect(blockedRes.data).toHaveLength(0);
  });

  it('searches communities by keyword', async () => {
    const res = await service.searchCommunities({
      query: 'Bengaluru',
    });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].name).toContain('Bengaluru');
  });

  it('searches hashtags', async () => {
    await store.hashtag.create({
      data: { tag: 'karnataka', postCount: 15 },
    });

    const res = await service.searchHashtags('#karna', 'searcher-1');
    expect(res.data.length).toBe(1);
    expect(res.data[0].tag).toBe('#karnataka');
  });

  it('searches active cities', async () => {
    const res = await service.searchCities('Mumbai');
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].slug).toBe('mumbai');
  });

  it('tracks and clears user search history', async () => {
    const userId = 'history-user-1';
    await service.searchPosts({ query: 'Metro updates', userId });
    await service.searchCommunities({ query: 'Indiranagar' }, userId);

    const history = await service.getSearchHistory(userId);
    expect(history.data.length).toBe(2);

    await service.clearSearchHistory(userId);
    const cleared = await service.getSearchHistory(userId);
    expect(cleared.data).toHaveLength(0);
  });

  it('performs unified global search and returns multi-entity results', async () => {
    const res = await service.searchGlobal({ query: 'Bengaluru', userId: 'searcher-1' });
    expect(res.query).toBe('Bengaluru');
    expect(res.communities.length).toBeGreaterThan(0);
    expect(res.cities.length).toBeGreaterThan(0);
  });

  it('provides autocomplete search suggestions and trending hashtags', async () => {
    await store.hashtag.create({ data: { tag: 'bangaloretech', postCount: 25 } });

    const suggestions = await service.getSuggestions('banga');
    expect(suggestions.suggestions.length).toBeGreaterThan(0);

    const trending = await service.getTrendingHashtags();
    expect(trending.data.length).toBeGreaterThan(0);
    expect(trending.data[0].post_count).toBeGreaterThan(0);
  });
});
