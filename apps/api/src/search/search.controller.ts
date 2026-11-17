import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SearchService } from './search.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('global')
  @ApiOperation({ summary: 'Unified multi-entity search across posts, communities, hashtags, and cities' })
  searchGlobal(
    @CurrentUser() user: RequestUser,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.searchGlobal({
      query: q ?? '',
      userId: user.id,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete suggestions for query prefix' })
  getSuggestions(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.getSuggestions(q ?? '', limit ? Number(limit) : 10);
  }

  @Get('trending-hashtags')
  @ApiOperation({ summary: 'Get trending hashtags' })
  getTrendingHashtags(@Query('limit') limit?: string) {
    return this.searchService.getTrendingHashtags(limit ? Number(limit) : 10);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Search published posts by keyword' })
  searchPosts(
    @CurrentUser() user: RequestUser,
    @Query('q') q: string,
    @Query('community_id') communityId?: string,
    @Query('city') city?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.searchPosts({
      query: q ?? '',
      userId: user.id,
      communityId,
      city,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('communities')
  @ApiOperation({ summary: 'Search active communities by keyword' })
  searchCommunities(
    @CurrentUser() user: RequestUser,
    @Query('q') q: string,
    @Query('city') city?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.searchCommunities(
      {
        query: q ?? '',
        city,
        type,
        limit: limit ? Number(limit) : 20,
      },
      user.id,
    );
  }

  @Get('hashtags')
  @ApiOperation({ summary: 'Search hashtags' })
  searchHashtags(
    @CurrentUser() user: RequestUser,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.searchHashtags(
      q ?? '',
      user.id,
      limit ? Number(limit) : 20,
    );
  }

  @Get('cities')
  @ApiOperation({ summary: 'Search active cities' })
  searchCities(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.searchCities(
      q ?? '',
      limit ? Number(limit) : 20,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user search history' })
  getSearchHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    return this.searchService.getSearchHistory(
      user.id,
      limit ? Number(limit) : 20,
    );
  }

  @Delete('history')
  @ApiOperation({ summary: 'Clear all search history' })
  clearAllHistory(@CurrentUser() user: RequestUser) {
    return this.searchService.clearSearchHistory(user.id);
  }

  @Delete('history/:id')
  @ApiOperation({ summary: 'Delete individual search history record' })
  deleteHistoryItem(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.searchService.clearSearchHistory(user.id, id);
  }
}
