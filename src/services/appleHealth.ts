import { Platform } from 'react-native';
import {
  getMostRecentQuantitySample,
  isHealthDataAvailableAsync,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { QueryStatisticsResponse } from '@kingstinct/react-native-healthkit';

const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass' as const;
const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;
const ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;

const READ_TYPES = [BODY_MASS, STEP_COUNT, ACTIVE_ENERGY] as const;

export type AppleHealthSnapshot = {
  stepsToday: number | null;
  activeEnergyKcalToday: number | null;
  lastWeightKg: number | null;
  lastWeightDate: Date | null;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sumFromStats(res: QueryStatisticsResponse): number | null {
  const q = res.sumQuantity;
  if (!q || typeof q.quantity !== 'number' || Number.isNaN(q.quantity)) return null;
  return q.quantity;
}

/** true se siamo su iOS e HealthKit è disponibile sul dispositivo. */
export async function isAppleHealthSupported(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}

/** Richiede lettura peso, passi e energia attiva. Chiamare prima di qualsiasi query. */
export async function requestAppleHealthReadAccess(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await requestAuthorization({ toRead: [...READ_TYPES] });
  } catch {
    return false;
  }
}

/** Dati aggregati per oggi + ultimo peso. Richiede autorizzazione già concessa. */
export async function fetchAppleHealthSnapshot(): Promise<AppleHealthSnapshot> {
  const empty: AppleHealthSnapshot = {
    stepsToday: null,
    activeEnergyKcalToday: null,
    lastWeightKg: null,
    lastWeightDate: null,
  };
  if (Platform.OS !== 'ios') return empty;

  const start = startOfToday();
  const end = new Date();
  const dateFilter = { startDate: start, endDate: end };

  let stepsToday: number | null = null;
  let activeEnergyKcalToday: number | null = null;

  try {
    const stepsRes = await queryStatisticsForQuantity(STEP_COUNT, ['cumulativeSum'], {
      filter: { date: dateFilter },
    });
    stepsToday = sumFromStats(stepsRes);
  } catch {
    // permesso negato o errore HealthKit
  }

  try {
    const kcalRes = await queryStatisticsForQuantity(ACTIVE_ENERGY, ['cumulativeSum'], {
      filter: { date: dateFilter },
    });
    activeEnergyKcalToday = sumFromStats(kcalRes);
  } catch {
    // ignore
  }

  let lastWeightKg: number | null = null;
  let lastWeightDate: Date | null = null;
  try {
    const sample = await getMostRecentQuantitySample(BODY_MASS, 'kg');
    if (sample && typeof sample.quantity === 'number' && Number.isFinite(sample.quantity)) {
      lastWeightKg = sample.quantity;
      const rawEnd = sample.endDate as unknown;
      lastWeightDate =
        rawEnd instanceof Date ? rawEnd : typeof rawEnd === 'string' || typeof rawEnd === 'number' ? new Date(rawEnd) : null;
    }
  } catch {
    // ignore
  }

  return { stepsToday, activeEnergyKcalToday, lastWeightKg, lastWeightDate };
}

export function formatWeightDate(d: Date | null): string {
  if (!d || !Number.isFinite(d.getTime())) return '';
  try {
    return d.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString();
  }
}

/** Data locale YYYY-MM-DD per createWeight. */
export function dateLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
