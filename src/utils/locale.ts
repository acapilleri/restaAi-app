import type { AppLanguage } from '../api/authStorage';

const WEEKDAY_LABELS: Record<AppLanguage, { short: string[]; long: string[] }> = {
  it: {
    short: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'],
    long: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
  },
  en: {
    short: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    long: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
};

const DAY_ALIASES: Record<string, number> = {
  lunedi: 0, lunedì: 0, lun: 0, monday: 0, mon: 0,
  martedi: 1, martedì: 1, mar: 1, tuesday: 1, tue: 1,
  mercoledi: 2, mercoledì: 2, mer: 2, wednesday: 2, wed: 2,
  giovedi: 3, giovedì: 3, gio: 3, thursday: 3, thu: 3,
  venerdi: 4, venerdì: 4, ven: 4, friday: 4, fri: 4,
  sabato: 5, sab: 5, saturday: 5, sat: 5,
  domenica: 6, dom: 6, sunday: 6, sun: 6,
};

export function getLocaleTag(language: AppLanguage): 'it-IT' | 'en-US' {
  return language === 'en' ? 'en-US' : 'it-IT';
}

export function normalizeDayIndex(dayKey: string): number | null {
  const key = dayKey.trim().toLowerCase();
  if (!key) return null;

  if (/^\d+$/.test(key)) {
    const n = Number(key);
    if (n >= 0 && n <= 6) return n;
    if (n >= 1 && n <= 7) return n - 1;
  }

  if (DAY_ALIASES[key] != null) return DAY_ALIASES[key];

  const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (DAY_ALIASES[normalized] != null) return DAY_ALIASES[normalized];
  return null;
}

export function formatWeekday(dayKey: string, language: AppLanguage, mode: 'short' | 'long'): string {
  const idx = normalizeDayIndex(dayKey);
  if (idx == null) return dayKey.slice(0, 3);
  return WEEKDAY_LABELS[language][mode][idx];
}
