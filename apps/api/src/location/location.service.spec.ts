import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocationService } from './location.service';
import { CityService } from './city.service';
import { PrismaService } from '../database/prisma.service';
import { InMemoryPrismaStore } from '../database/in-memory-prisma';

describe('LocationService & CityService', () => {
  let locationService: LocationService;
  let cityService: CityService;
  let store: InMemoryPrismaStore;

  beforeEach(async () => {
    store = new InMemoryPrismaStore();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        CityService,
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, fallback?: string) => fallback ?? '3600',
          },
        },
        { provide: PrismaService, useValue: store },
      ],
    }).compile();

    locationService = module.get(LocationService);
    cityService = module.get(CityService);
  });

  it('lists active Indian cities from reference database', async () => {
    const res = await locationService.getIndiaCities();
    expect(res.data.length).toBeGreaterThanOrEqual(10);
    expect(res.data.map((c) => c.name)).toContain('Bengaluru');
  });

  it('snaps raw coordinates into a coarse geo-cell without exposing exact GPS', () => {
    const coarse = locationService.latLngToCoarseGeoCell(12.9715987, 77.5945627);
    expect(coarse.geo_cell).toBe('h3_in_12.95_77.60');
    expect(coarse.nearest_city.name).toBe('Bengaluru');
    expect(coarse.granularity).toBe('CELL_5KM');
  });

  it('checks location privacy threshold requiring >= 20 users for neighborhood granularity', () => {
    const below = locationService.checkLocationPrivacyThreshold('h3_cell_1', 12);
    expect(below.allow_neighborhood_precision).toBe(false);
    expect(below.effective_scope).toBe('CITY');

    const above = locationService.checkLocationPrivacyThreshold('h3_cell_1', 25);
    expect(above.allow_neighborhood_precision).toBe(true);
    expect(above.effective_scope).toBe('NEIGHBORHOOD');
  });

  it('stores ephemeral GPS with expiry and resolves user location accordingly', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919777777777' } });

    // Store ephemeral GPS near Mumbai
    await locationService.storeTemporaryGps(user.id, 19.076, 72.8777);

    const resolved = await locationService.resolveUserLocation(user.id);
    expect(resolved.source).toBe('GPS');
    expect(resolved.cityName).toBe('Mumbai');

    // Clear GPS
    await locationService.clearTemporaryGps(user.id);

    // Fallback to preference or default
    const fallback = await locationService.resolveUserLocation(user.id);
    expect(fallback.source).toBe('DEFAULT');
  });

  it('searches cities by name and alias', async () => {
    const searchByName = await cityService.searchCities('bengaluru');
    expect(searchByName.data.length).toBeGreaterThanOrEqual(1);
    expect(searchByName.data[0].name).toBe('Bengaluru');

    const searchByAlias = await cityService.searchCities('Bangalore');
    expect(searchByAlias.data.length).toBeGreaterThanOrEqual(1);
    expect(searchByAlias.data[0].name).toBe('Bengaluru');
  });

  it('detects impossible travel anomalies when location changes too quickly across large distances', async () => {
    const user = await store.user.create({ data: { authId: 'phone:+919888888888' } });

    // Initial location: Bengaluru
    await locationService.storeTemporaryGps(user.id, 12.9716, 77.5946);

    // Immediate second location: Delhi (~1,700 km away within 1 second)
    const anomaly = await locationService.storeTemporaryGps(user.id, 28.6139, 77.209);
    expect(anomaly.is_anomaly).toBe(true);
    expect(anomaly.anomaly_reason).toBe('IMPOSSIBLE_TRAVEL_SPEED');
  });
});
