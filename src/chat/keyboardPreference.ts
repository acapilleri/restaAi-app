import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_KEYBOARD_AUTO_CLOSE_KEY = 'chat_keyboard_auto_close';

let memoryFallback = true;
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

export async function getChatKeyboardAutoClose(): Promise<boolean> {
  try {
    if (await isAsyncStorageAvailable()) {
      const value = await AsyncStorage.getItem(CHAT_KEYBOARD_AUTO_CLOSE_KEY);
      if (value == null) return true;
      return value === '1';
    }
  } catch {
    // ignore and fallback
  }
  return memoryFallback;
}

export async function setChatKeyboardAutoClose(enabled: boolean): Promise<void> {
  try {
    if (await isAsyncStorageAvailable()) {
      await AsyncStorage.setItem(CHAT_KEYBOARD_AUTO_CLOSE_KEY, enabled ? '1' : '0');
      return;
    }
  } catch {
    // ignore and fallback
  }
  memoryFallback = enabled;
}
