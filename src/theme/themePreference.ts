import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREFERENCE_KEY = 'theme_preference';

export type ThemePreference = 'system' | 'light' | 'dark';

let memoryFallback: ThemePreference = 'system';
let storageAvailable: boolean | null = null;

async function isAsyncStorageAvailable(): Promise<boolean> {
  if (storageAvailable !== null) return storageAvailable;
  try {
    await AsyncStorage.getItem('__probe__');
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  return storageAvailable;
}

function parsePreference(raw: string | null): ThemePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    if (await isAsyncStorageAvailable()) {
      const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
      return parsePreference(value);
    }
  } catch {
    // ignore
  }
  return memoryFallback;
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  try {
    if (await isAsyncStorageAvailable()) {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
      return;
    }
  } catch {
    // ignore
  }
  memoryFallback = preference;
}
