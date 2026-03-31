import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'dietaai_onboarding_done_v1:';

export async function getOnboardingCompleted(userKey: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PREFIX + userKey);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingCompleted(userKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + userKey, '1');
  } catch {
    // ignore
  }
}
