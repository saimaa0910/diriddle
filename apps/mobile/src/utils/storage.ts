import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryFallback = new Map<string, string>();

function isWebLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (isWebLocalStorageAvailable()) {
        return window.localStorage.getItem(key);
      }
      return memoryFallback.get(key) ?? null;
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (isWebLocalStorageAvailable()) {
        window.localStorage.setItem(key, value);
        return;
      }
      memoryFallback.set(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },

  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (isWebLocalStorageAvailable()) {
        window.localStorage.removeItem(key);
        return;
      }
      memoryFallback.delete(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      memoryFallback.delete(key);
    }
  },
};

