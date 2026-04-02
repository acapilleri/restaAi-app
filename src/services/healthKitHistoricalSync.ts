import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  CategoryValueSleepAnalysis,
  getPreferredUnits,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsForQuantity,
} from '@kingstinct/react-native-healthkit';
import type { QuantityTypeIdentifier, QueryStatisticsResponse } from '@kingstinct/react-native-healthkit';
import { syncHealthSnapshotBulk, type HealthSnapshotPayload } from '../api/healthSnapshots';
import { dateLocalYmd } from './appleHealth';

export const HEALTHKIT_HISTORICAL_SYNC_STORAGE_KEY = 'healthkit_historical_synced_v1';

/** ISO timestamp ultimo `bulk_create` riuscito (UI Salute). */
export const HEALTH_LAST_BULK_SYNC_AT_KEY = 'health_last_bulk_sync_at';

const DAYS_TO_SYNC = 90;

const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;
const ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const RESTING_HR = 'HKQuantityTypeIdentifierRestingHeartRate' as const;
const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass' as const;
const BODY_FAT_PCT = 'HKQuantityTypeIdentifierBodyFatPercentage' as const;
const SLEEP_CAT = 'HKCategoryTypeIdentifierSleepAnalysis' as const;

const ASLEEP_SLEEP_VALUES = new Set<number>([
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
]);

function uniqueUnitCandidates(preferred: string | undefined, fallbacks: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of [preferred, ...fallbacks]) {
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function sumFromStats(res: QueryStatisticsResponse): number | null {
  const q = res.sumQuantity;
  if (!q || typeof q.quantity !== 'number' || Number.isNaN(q.quantity)) return null;
  return q.quantity;
}

function quantityToKcal(quantity: number, unit: string): number | null {
  const u = unit.trim();
  if (u === 'kcal' || u === 'Cal') return quantity;
  if (u === 'cal') return quantity * 0.001;
  if (u === 'J' || u === 'kJ') return u === 'kJ' ? quantity / 4.184 : quantity / 4184;
  return null;
}

function sampleQuantityToKg(quantity: number, unit: string): number | null {
  const u = unit.trim();
  if (u === 'kg' || u === 'g') return u === 'g' ? quantity / 1000 : quantity;
  if (u === 'lb') return quantity * 0.45359237;
  if (u === 'st') return quantity * 6.35029;
  return null;
}

async function sumQuantitySamplesInRange(
  identifier: QuantityTypeIdentifier,
  unit: string,
  dateFilter: { startDate: Date; endDate: Date },
): Promise<number | null> {
  const samples = await queryQuantitySamples(identifier, {
    limit: -1,
    unit,
    filter: { date: dateFilter },
    ascending: false,
  });
  if (!samples.length) return null;
  let sum = 0;
  for (const s of samples) {
    if (typeof s.quantity === 'number' && Number.isFinite(s.quantity)) sum += s.quantity;
  }
  return sum;
}

async function sumDayQuantityMulti(
  identifier: QuantityTypeIdentifier,
  preferred: string | undefined,
  dateFilter: { startDate: Date; endDate: Date },
  fallbackUnits: string[],
): Promise<number | null> {
  const units = uniqueUnitCandidates(preferred, fallbackUnits);
  for (const unit of units) {
    try {
      const res = await queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
        filter: { date: dateFilter },
        unit,
      });
      const v = sumFromStats(res);
      if (v != null) return v;
    } catch {
      // try next
    }
    try {
      const v = await sumQuantitySamplesInRange(identifier, unit, dateFilter);
      if (v != null) return v;
    } catch {
      // try next
    }
  }
  return null;
}

async function sumDayEnergyKcal(
  preferred: string | undefined,
  dateFilter: { startDate: Date; endDate: Date },
): Promise<number | null> {
  const units = uniqueUnitCandidates(preferred, ['kcal', 'Cal', 'cal', 'J', 'kJ']);
  for (const unit of units) {
    try {
      const res = await queryStatisticsForQuantity(ACTIVE_ENERGY, ['cumulativeSum'], {
        filter: { date: dateFilter },
        unit,
      });
      const q = res.sumQuantity;
      if (q && typeof q.quantity === 'number' && Number.isFinite(q.quantity)) {
        const kcal = quantityToKcal(q.quantity, q.unit ?? unit);
        if (kcal != null) return kcal;
      }
    } catch {
      // continue
    }
    try {
      const samples = await queryQuantitySamples(ACTIVE_ENERGY, {
        limit: -1,
        unit,
        filter: { date: dateFilter },
        ascending: false,
      });
      if (!samples.length) continue;
      let sum = 0;
      for (const s of samples) {
        if (typeof s.quantity !== 'number' || !Number.isFinite(s.quantity)) continue;
        const k = quantityToKcal(s.quantity, s.unit ?? unit);
        if (k == null) {
          sum = NaN;
          break;
        }
        sum += k;
      }
      if (Number.isFinite(sum)) return sum;
    } catch {
      // continue
    }
  }
  return null;
}

async function avgDayRestingHr(
  preferred: string | undefined,
  dateFilter: { startDate: Date; endDate: Date },
): Promise<number | null> {
  const units = uniqueUnitCandidates(preferred, ['count/min']);
  for (const unit of units) {
    try {
      const res = await queryStatisticsForQuantity(RESTING_HR, ['discreteAverage'], {
        filter: { date: dateFilter },
        unit,
      });
      const q = res.averageQuantity;
      if (q && typeof q.quantity === 'number' && Number.isFinite(q.quantity) && q.quantity > 0) {
        return Math.round(q.quantity);
      }
    } catch {
      // try next
    }
  }
  return null;
}

async function sleepAsleepHoursForRange(start: Date, end: Date): Promise<number | null> {
  try {
    const samples = await queryCategorySamples(SLEEP_CAT, {
      limit: -1,
      filter: { date: { startDate: start, endDate: end } },
      ascending: false,
    });
    let ms = 0;
    for (const s of samples) {
      const v = s.value as number;
      if (!ASLEEP_SLEEP_VALUES.has(v)) continue;
      const sd = s.startDate;
      const ed = s.endDate;
      const a = sd instanceof Date ? sd.getTime() : new Date(sd as unknown as string).getTime();
      const b = ed instanceof Date ? ed.getTime() : new Date(ed as unknown as string).getTime();
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) ms += b - a;
    }
    if (ms <= 0) return null;
    return ms / (1000 * 60 * 60);
  } catch {
    return null;
  }
}

async function latestQuantityInDay(
  identifier: QuantityTypeIdentifier,
  unitCandidates: string[],
  dateFilter: { startDate: Date; endDate: Date },
  toKg: boolean,
): Promise<number | null> {
  for (const unit of unitCandidates) {
    try {
      const samples = await queryQuantitySamples(identifier, {
        limit: 1,
        unit,
        filter: { date: dateFilter },
        ascending: false,
      });
      const s = samples[0];
      if (!s || typeof s.quantity !== 'number' || !Number.isFinite(s.quantity)) continue;
      const u = (s.unit ?? unit).trim();
      if (toKg) {
        const kg = sampleQuantityToKg(s.quantity, u);
        if (kg != null) return kg;
      } else {
        let p = s.quantity;
        if (u === '%' || u === 'count') {
          if (p > 0 && p <= 1) p *= 100;
        }
        return p;
      }
    } catch {
      // next unit
    }
  }
  return null;
}

function dayStartEnd(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

async function buildDaySnapshot(
  date: Date,
  pref: Partial<Record<string, string>>,
): Promise<HealthSnapshotPayload | null> {
  const { start, end } = dayStartEnd(date);
  const dateFilter = { startDate: start, endDate: end };

  const [steps, calories, hr, sleep, weight, bodyFat] = await Promise.all([
    sumDayQuantityMulti(STEP_COUNT, pref[STEP_COUNT], dateFilter, ['count']),
    sumDayEnergyKcal(pref[ACTIVE_ENERGY], dateFilter),
    avgDayRestingHr(pref[RESTING_HR], dateFilter),
    sleepAsleepHoursForRange(start, end),
    latestQuantityInDay(BODY_MASS, uniqueUnitCandidates(pref[BODY_MASS], ['kg', 'lb', 'g']), dateFilter, true),
    latestQuantityInDay(BODY_FAT_PCT, uniqueUnitCandidates(pref[BODY_FAT_PCT], ['%']), dateFilter, false),
  ]);

  if (!steps && !calories && !hr && !sleep && !weight && !bodyFat) {
    return null;
  }

  return {
    snapshot_date: dateLocalYmd(date),
    snapshot_type: 'daily_summary',
    steps: steps ?? undefined,
    active_calories: calories ?? undefined,
    resting_hr: hr ?? undefined,
    sleep_hours: sleep ?? undefined,
    weight_kg: weight ?? undefined,
    body_fat_percent: bodyFat ?? undefined,
    recorded_at: end.toISOString(),
  };
}

export async function syncHistoricalHealthData(): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;

  let pref: Partial<Record<string, string>> = {};
  try {
    const rows = await getPreferredUnits([
      STEP_COUNT,
      ACTIVE_ENERGY,
      RESTING_HR,
      BODY_MASS,
      BODY_FAT_PCT,
    ] as QuantityTypeIdentifier[]);
    for (const r of rows) {
      if (r.typeIdentifier && r.unit) pref[r.typeIdentifier] = r.unit;
    }
  } catch {
    pref = {};
  }

  const snapshots: HealthSnapshotPayload[] = [];
  const today = new Date();

  for (let i = 1; i <= DAYS_TO_SYNC; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const snapshot = await buildDaySnapshot(date, pref);
    if (snapshot) snapshots.push(snapshot);

    if (i % 7 === 0) {
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 100);
      });
    }
  }

  if (snapshots.length === 0) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[HealthKit] no historical data found');
    }
    return true;
  }

  const result = await syncHealthSnapshotBulk(snapshots);
  if (!result.ok) {
    return false;
  }
  try {
    await AsyncStorage.setItem(HEALTH_LAST_BULK_SYNC_AT_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[HealthKit] synced ${result.count} historical snapshots`);
  }
  return true;
}

export async function syncHistoricalIfNeeded(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const alreadySynced = await AsyncStorage.getItem(HEALTHKIT_HISTORICAL_SYNC_STORAGE_KEY);
    if (alreadySynced === 'true') return;

    const ok = await syncHistoricalHealthData();
    if (ok) {
      await AsyncStorage.setItem(HEALTHKIT_HISTORICAL_SYNC_STORAGE_KEY, 'true');
    }
  } catch (error) {
    console.warn('[HealthKit] historical sync error:', error);
  }
}
