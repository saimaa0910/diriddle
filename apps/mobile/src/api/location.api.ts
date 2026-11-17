import { apiClient, isDemoSession, shouldUseDemoFallback } from './client';
import { INDIA_CITIES, IndiaCity } from '../utils/location';

export interface LocationPreferencePayload {
  selected_city: string;
  selected_state?: string;
  lat?: number;
  lng?: number;
  location_permission_granted?: boolean;
}

export const locationApi = {
  async getCities(): Promise<IndiaCity[]> {
    if (isDemoSession()) return INDIA_CITIES;
    try {
      const res = await apiClient.get<IndiaCity[]>('/location/cities');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
      return INDIA_CITIES;
    } catch (error) {
      if (shouldUseDemoFallback(error)) return INDIA_CITIES;
      throw error;
    }
  },

  async setPreference(payload: LocationPreferencePayload): Promise<{ saved: boolean }> {
    if (isDemoSession()) return { saved: true };
    try {
      const res = await apiClient.put('/location/preference', payload);
      return res.data ?? { saved: true };
    } catch (error) {
      if (shouldUseDemoFallback(error)) return { saved: true };
      throw error;
    }
  },

  async resolveCell(lat: number, lng: number): Promise<{
    geo_cell: string;
    nearest_city: string;
    nearest_state: string;
    granularity: string;
  }> {
    if (isDemoSession()) {
      return {
        geo_cell: 'cell_bengaluru_approx',
        nearest_city: 'Bengaluru',
        nearest_state: 'Karnataka',
        granularity: 'COARSE_5KM',
      };
    }
    try {
      const res = await apiClient.post('/location/resolve-cell', { lat, lng });
      return res.data;
    } catch (error) {
      if (shouldUseDemoFallback(error)) {
        return {
          geo_cell: 'cell_bengaluru_approx',
          nearest_city: 'Bengaluru',
          nearest_state: 'Karnataka',
          granularity: 'COARSE_5KM',
        };
      }
      throw error;
    }
  },

  async storeEphemeralGps(lat: number, lng: number): Promise<void> {
    if (isDemoSession()) return;
    try {
      await apiClient.post('/location/gps', { lat, lng });
    } catch {
      // Ephemeral update failure is non-blocking
    }
  },

  async clearEphemeralGps(): Promise<void> {
    if (isDemoSession()) return;
    try {
      await apiClient.delete('/location/gps');
    } catch {
      // Ignore
    }
  },
};
