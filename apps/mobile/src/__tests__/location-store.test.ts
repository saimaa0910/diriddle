import { useLocationStore, getActiveCityFallback } from '../store/location-store';
import { INDIA_CITIES } from '../utils/location';

describe('useLocationStore', () => {
  beforeEach(async () => {
    await useLocationStore.getState().clearLocation();
  });

  it('initializes with default location values', () => {
    const state = useLocationStore.getState();
    expect(state.selectedCity).toBeNull();
    expect(state.selectedState).toBeNull();
    expect(state.locationPermissionGranted).toBe(false);
  });

  it('updates city and community when setCity is called', async () => {
    const mumbai = INDIA_CITIES.find((c) => c.name === 'Mumbai')!;
    await useLocationStore.getState().setCity(mumbai, true);

    const state = useLocationStore.getState();
    expect(state.selectedCity).toBe('Mumbai');
    expect(state.selectedState).toBe('Maharashtra');
    expect(state.selectedCommunityId).toBe('city-mumbai');
    expect(state.locationPermissionGranted).toBe(true);
  });

  it('clears location state on clearLocation', async () => {
    const delhi = INDIA_CITIES.find((c) => c.name === 'Delhi')!;
    await useLocationStore.getState().setCity(delhi, false);
    await useLocationStore.getState().clearLocation();

    const state = useLocationStore.getState();
    expect(state.selectedCity).toBeNull();
    expect(state.selectedState).toBeNull();
    expect(state.selectedCommunityId).toBeNull();
  });

  it('returns Bengaluru fallback when no city is selected', () => {
    const fallback = getActiveCityFallback(null);
    expect(fallback.name).toBe('Bengaluru');
  });

  it('returns matched city when a valid city is selected', () => {
    const city = getActiveCityFallback('Chennai');
    expect(city.name).toBe('Chennai');
    expect(city.state).toBe('Tamil Nadu');
  });
});
