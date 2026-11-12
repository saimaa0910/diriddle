import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { LocationService } from './location.service';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator';

class ResolveCellDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

class SetLocationPrefDto {
  @IsString()
  selected_city!: string;

  @IsString()
  @IsOptional()
  selected_state?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsBoolean()
  @IsOptional()
  location_permission_granted?: boolean;
}

@ApiTags('Location')
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('cities')
  @ApiOperation({ summary: 'List supported India cities for location selection' })
  getCities() {
    return this.locationService.getIndiaCities();
  }

  @Post('resolve-cell')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve approximate coordinates to a coarse privacy-preserving geo-cell' })
  resolveCell(@Body() dto: ResolveCellDto) {
    const resolved = this.locationService.latLngToCoarseGeoCell(dto.lat, dto.lng);
    return {
      geo_cell: resolved.geo_cell,
      nearest_city: resolved.nearest_city.name,
      nearest_state: resolved.nearest_city.state,
      granularity: resolved.granularity,
    };
  }

  @Put('preference')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save user city and coarse geo-cell preference' })
  setPreference(@Body() dto: SetLocationPrefDto, @CurrentUser() user: RequestUser) {
    return this.locationService.setLocationPreference(user.id, dto);
  }
}
