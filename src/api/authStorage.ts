import AsyncStorage from '@react-native-async-storage/async-storage';

const JWT_KEY = 'dietaai_jwt';
const APP_LANGUAGE_KEY = 'dietaai_app_language';
export type AppLanguage = 'it' | 'en';

/** Fallback in-memory se il modulo nativo AsyncStorage non è disponibile (es. app non ricompilata dopo npm install). */
let memoryFallback: string | null = null;
let languageMemoryFallback: AppLanguage | null = null;
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

export async function getStoredToken(): Promise<string | null> {
  try {
    if (await isAsyncStorageAvailable()) {
      return await AsyncStorage.getItem(JWT_KEY);
    }
  } catch {
    // ignore
  }
  return memoryFallback;
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    if (await isAsyncStorageAvailable()) {
      await AsyncStorage.setItem(JWT_KEY, token);
      return;
    }
  } catch {
    // fallback
  }
  memoryFallback = token;
}

export async function removeStoredToken(): Promise<void> {
  try {
    if (await isAsyncStorageAvailable()) {
      await AsyncStorage.removeItem(JWT_KEY);
    }
  } catch {
    // ignore
  }
  memoryFallback = null;
}

export async function getStoredLanguage(): Promise<AppLanguage> {
  try {
    if (await isAsyncStorageAvailable()) {
      const value = await AsyncStorage.getItem(APP_LANGUAGE_KEY);
      if (value === 'it' || value === 'en') return value;
    }
  } catch {
    // ignore
  }
  return languageMemoryFallback ?? 'it';
}

export async function setStoredLanguage(language: AppLanguage): Promise<void> {
  try {
    if (await isAsyncStorageAvailable()) {
      await AsyncStorage.setItem(APP_LANGUAGE_KEY, language);
      return;
    }
  } catch {
    // fallback
  }
  languageMemoryFallback = language;
}
