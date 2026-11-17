import { Platform } from 'react-native';
import * as Location from 'expo-location';

export interface IndiaCity {
  name: string;
  state: string;
  slug: string;
  lat: number;
  lng: number;
  communityId: string;
}

export const INDIA_CITIES: IndiaCity[] = [
  { name: 'Mumbai', state: 'Maharashtra', slug: 'mumbai', lat: 19.076, lng: 72.8777, communityId: 'city-mumbai' },
  { name: 'Delhi', state: 'Delhi', slug: 'delhi', lat: 28.6139, lng: 77.209, communityId: 'city-delhi' },
  { name: 'Bengaluru', state: 'Karnataka', slug: 'bengaluru', lat: 12.9716, lng: 77.5946, communityId: 'city-bengaluru' },
  { name: 'Hyderabad', state: 'Telangana', slug: 'hyderabad', lat: 17.385, lng: 78.4867, communityId: 'city-hyderabad' },
  { name: 'Chennai', state: 'Tamil Nadu', slug: 'chennai', lat: 13.0827, lng: 80.2707, communityId: 'city-chennai' },
  { name: 'Kolkata', state: 'West Bengal', slug: 'kolkata', lat: 22.5726, lng: 88.3639, communityId: 'city-kolkata' },
  { name: 'Pune', state: 'Maharashtra', slug: 'pune', lat: 18.5204, lng: 73.8567, communityId: 'city-pune' },
  { name: 'Ahmedabad', state: 'Gujarat', slug: 'ahmedabad', lat: 23.0225, lng: 72.5714, communityId: 'city-ahmedabad' },
  { name: 'Jaipur', state: 'Rajasthan', slug: 'jaipur', lat: 26.9124, lng: 75.7873, communityId: 'city-jaipur' },
  { name: 'Lucknow', state: 'Uttar Pradesh', slug: 'lucknow', lat: 26.8467, lng: 80.9462, communityId: 'city-lucknow' },
];

function findNearestCity(lat: number, lng: number): IndiaCity {
  let nearest = INDIA_CITIES[2]; // Default Bengaluru
  let minDistance = Number.POSITIVE_INFINITY;
  for (const city of INDIA_CITIES) {
    const dLat = city.lat - lat;
    const dLng = city.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDistance) {
      minDistance = dist;
      nearest = city;
    }
  }
  return nearest;
}

export async function detectApproximateCity(): Promise<{
  granted: boolean;
  city: IndiaCity | null;
}> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { granted: false, city: null };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            granted: true,
            city: findNearestCity(pos.coords.latitude, pos.coords.longitude),
          });
        },
        () => resolve({ granted: false, city: null }),
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
      );
    });
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { granted: false, city: null };
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      granted: true,
      city: findNearestCity(loc.coords.latitude, loc.coords.longitude),
    };
  } catch {
    return { granted: false, city: null };
  }
}

