import messaging from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { checkNotifications, requestNotifications, RESULTS } from 'react-native-permissions';

function messagingInstance(): ReturnType<typeof messaging> | null {
  try {
    return messaging();
  } catch {
    return null;
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await checkNotifications();
  if (current.status === RESULTS.GRANTED || current.status === RESULTS.LIMITED) {
    return true;
  }
  if (current.status === RESULTS.UNAVAILABLE) {
    return false;
  }
  const requested = await requestNotifications(['alert', 'sound', 'badge']);
  return requested.status === RESULTS.GRANTED || requested.status === RESULTS.LIMITED;
}

export async function getNotificationPermissionStatus() {
  const { status } = await checkNotifications();
  return status;
}

export async function getFcmToken(): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;
  const m = messagingInstance();
  if (!m) return null;
  try {
    return await m.getToken();
  } catch {
    return null;
  }
}

export function subscribeForegroundMessages(
  handler: (message: FirebaseMessagingTypes.RemoteMessage) => void,
) {
  const m = messagingInstance();
  if (!m) return () => {};
  try {
    return m.onMessage(handler);
  } catch {
    return () => {};
  }
}

export function subscribeTokenRefresh(handler: (token: string) => void) {
  const m = messagingInstance();
  if (!m) return () => {};
  try {
    return m.onTokenRefresh(handler);
  } catch {
    return () => {};
  }
}
