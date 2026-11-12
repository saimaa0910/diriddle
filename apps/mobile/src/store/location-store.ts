import { create } from 'zustand';
import { INDIA_CITIES, IndiaCity } from '../utils/location';
import { safeStorage } from '../utils/storage';

const LOCATION_STORAGE_KEY = 'diriddle_location_state_v1';

interface PersistedLocationState {
  selectedCity: string | null;
  selectedState: string | null;
  selectedCommunityId: string | null;
  locationPermissionGranted: boolean;
}

interface LocationStore extends PersistedLocationState {
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  setCity: (city: IndiaCity, permissionGranted?: boolean) => Promise<void>;
  clearLocation: () => Promise<void>;
}

const DEFAULT_LOCATION: PersistedLocationState = {
  selectedCity: null,
  selectedState: null,
  selectedCommunityId: null,
  locationPermissionGranted: false,
};

export const useLocationStore = create<LocationStore>((set, get) => ({
  ...DEFAULT_LOCATION,
  isHydrated: false,

  async hydrate() {
    if (get().isHydrated) return;
    try {
      const raw = await safeStorage.getItem(LOCATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedLocationState>;
        set({
          ...DEFAULT_LOCATION,
          ...parsed,
          isHydrated: true,
        });
        return;
      }
    } catch {
      // Ignore corrupt storage
    }
    set({ isHydrated: true });
  },

  async setCity(city: IndiaCity, permissionGranted?: boolean) {
    const next: PersistedLocationState = {
      selectedCity: city.name,
      selectedState: city.state,
      selectedCommunityId: city.communityId,
      locationPermissionGranted: permissionGranted ?? get().locationPermissionGranted,
    };
    set(next);
    await safeStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
  },

  async clearLocation() {
    set(DEFAULT_LOCATION);
    await safeStorage.deleteItem(LOCATION_STORAGE_KEY);
  },
}));

export function getActiveCityFallback(selectedCity: string | null): IndiaCity {
  return (
    INDIA_CITIES.find((c) => c.name === selectedCity) ??
    INDIA_CITIES[2] // Bengaluru default
  );
}
