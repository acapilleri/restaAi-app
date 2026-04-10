import { NativeModules, Platform } from 'react-native';

type EmitterModule = {
  getNotificationScheduleLog?: () => Promise<string>;
  clearNotificationScheduleLog?: () => Promise<boolean>;
};

function getModule(): EmitterModule | null {
  if (Platform.OS !== 'ios') return null;
  const m = NativeModules.EatingRiskEventEmitter as EmitterModule | undefined;
  if (!m?.getNotificationScheduleLog || !m?.clearNotificationScheduleLog) return null;
  return m;
}

export type NotificationScheduleLogRow = {
  loggedAtIso: string;
  notificationId: string;
  score: number;
  title: string;
  body: string;
  source: string;
  outcome: string;
  error?: string | null;
};

export function isNotificationScheduleLogSupported(): boolean {
  return getModule() != null;
}

export async function fetchNotificationScheduleLogJsonl(): Promise<string> {
  const mod = getModule();
  if (!mod) return '';
  return mod.getNotificationScheduleLog!();
}

export function parseNotificationScheduleLogJsonl(jsonl: string): NotificationScheduleLogRow[] {
  const lines = jsonl.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows: NotificationScheduleLogRow[] = [];
  for (const line of lines) {
    try {
      const o = JSON.parse(line) as NotificationScheduleLogRow;
      if (typeof o.loggedAtIso === 'string' && typeof o.notificationId === 'string') {
        rows.push(o);
      }
    } catch {
      // skip corrupt line
    }
  }
  return rows;
}

export async function clearNotificationScheduleLog(): Promise<void> {
  const mod = getModule();
  if (!mod) return;
  await mod.clearNotificationScheduleLog!();
}
