import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface IndiaCity {
  name: string;
  slug: string;
  state: string;
  lat: number;
  lng: number;
  geoCell: string;
}

export const INDIA_CITIES: IndiaCity[] = [
  { name: 'Mumbai', slug: 'mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777, geoCell: 'h3_in_mumbai_01' },
  { name: 'Delhi', slug: 'delhi', state: 'Delhi', lat: 28.6139, lng: 77.209, geoCell: 'h3_in_delhi_01' },
  { name: 'Bengaluru', slug: 'bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946, geoCell: 'h3_in_blr_01' },
  { name: 'Hyderabad', slug: 'hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867, geoCell: 'h3_in_hyd_01' },
  { name: 'Chennai', slug: 'chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707, geoCell: 'h3_in_maa_01' },
  { name: 'Kolkata', slug: 'kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639, geoCell: 'h3_in_ccu_01' },
  { name: 'Pune', slug: 'pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, geoCell: 'h3_in_pnq_01' },
  { name: 'Ahmedabad', slug: 'ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714, geoCell: 'h3_in_amd_01' },
  { name: 'Jaipur', slug: 'jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, geoCell: 'h3_in_jai_01' },
  { name: 'Lucknow', slug: 'lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, geoCell: 'h3_in_lko_01' },
];

const MIN_K_ANONYMITY_USERS = 20;

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  getIndiaCities() {
    return {
      data: INDIA_CITIES.map((c) => ({
        name: c.name,
        slug: c.slug,
        state: c.state,
        geo_cell: c.geoCell,
      })),
    };
  }

  latLngToCoarseGeoCell(lat: number, lng: number): {
    geo_cell: string;
    nearest_city: IndiaCity;
    granularity: 'CELL_5KM' | 'CITY_FALLBACK';
  } {
    // Snap raw coordinates to a ~5km (0.05 deg) coarse grid cell; never persist exact lat/lng
    const gridLat = Math.round(lat * 20) / 20;
    const gridLng = Math.round(lng * 20) / 20;
    const geoCell = `h3_in_${gridLat.toFixed(2)}_${gridLng.toFixed(2)}`;

    let nearest = INDIA_CITIES[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const city of INDIA_CITIES) {
      const dist = Math.hypot(city.lat - lat, city.lng - lng);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = city;
      }
    }

    return {
      geo_cell: geoCell,
      nearest_city: nearest,
      granularity: 'CELL_5KM',
    };
  }

  checkLocationPrivacyThreshold(geoCell: string, activeUsersInCell: number) {
    const meetsThreshold = activeUsersInCell >= MIN_K_ANONYMITY_USERS;
    return {
      geo_cell: geoCell,
      active_users: activeUsersInCell,
      min_threshold: MIN_K_ANONYMITY_USERS,
      allow_neighborhood_precision: meetsThreshold,
      effective_scope: meetsThreshold ? 'NEIGHBORHOOD' : 'CITY',
    };
  }

  async setLocationPreference(
    userId: string,
    input: {
      selected_city: string;
      selected_state?: string;
      lat?: number;
      lng?: number;
      location_permission_granted?: boolean;
    },
  ) {
    const cityMatch = INDIA_CITIES.find(
      (c) => c.name.toLowerCase() === input.selected_city.trim().toLowerCase(),
    );
    const resolved =
      typeof input.lat === 'number' && typeof input.lng === 'number'
        ? this.latLngToCoarseGeoCell(input.lat, input.lng)
        : null;

    const selectedCity = cityMatch?.name ?? input.selected_city;
    const selectedState = input.selected_state ?? cityMatch?.state ?? null;
    const geoCell = resolved?.geo_cell ?? cityMatch?.geoCell ?? null;

    const pref = await this.prisma.locationPreference.upsert({
      where: { userId },
      create: {
        userId,
        selectedCity,
        selectedState,
        geoCell,
        locationPermissionGranted: input.location_permission_granted ?? Boolean(resolved),
      },
      update: {
        selectedCity,
        selectedState,
        geoCell,
        locationPermissionGranted: input.location_permission_granted ?? Boolean(resolved),
      },
    });

    return {
      selected_city: pref.selectedCity,
      selected_state: pref.selectedState,
      geo_cell: pref.geoCell,
      location_permission_granted: pref.locationPermissionGranted,
    };
  }
}
