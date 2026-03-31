import { Platform } from 'react-native';
import {
  AuthorizationRequestStatus,
  CategoryValueSleepAnalysis,
  getPreferredUnits,
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type {
  ObjectTypeIdentifier,
  QuantityTypeIdentifier,
  QueryStatisticsResponse,
} from '@kingstinct/react-native-healthkit';

const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass' as const;
const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;
const ACTIVE_ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned' as const;
const HEART_RATE = 'HKQuantityTypeIdentifierHeartRate' as const;
const RESTING_HR = 'HKQuantityTypeIdentifierRestingHeartRate' as const;
const HRV_SDNN = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN' as const;
const BODY_FAT_PCT = 'HKQuantityTypeIdentifierBodyFatPercentage' as const;
const LEAN_MASS = 'HKQuantityTypeIdentifierLeanBodyMass' as const;
const BMI = 'HKQuantityTypeIdentifierBodyMassIndex' as const;
const SPO2 = 'HKQuantityTypeIdentifierOxygenSaturation' as const;
const SLEEP_CAT = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const DISTANCE_WALK = 'HKQuantityTypeIdentifierDistanceWalkingRunning' as const;
const FLIGHTS = 'HKQuantityTypeIdentifierFlightsClimbed' as const;
const BASAL_ENERGY = 'HKQuantityTypeIdentifierBasalEnergyBurned' as const;
const DIETARY_ENERGY = 'HKQuantityTypeIdentifierDietaryEnergyConsumed' as const;

const READ_TYPES_ESSENTIAL = [BODY_MASS, STEP_COUNT, ACTIVE_ENERGY] as const satisfies readonly ObjectTypeIdentifier[];

const READ_TYPES_EXTENDED = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierFlightsClimbed',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
] as const satisfies readonly ObjectTypeIdentifier[];

function dedupeReadTypes(
  first: readonly ObjectTypeIdentifier[],
  second: readonly ObjectTypeIdentifier[],
): ObjectTypeIdentifier[] {
  const seen = new Set<string>();
  const out: ObjectTypeIdentifier[] = [];
  for (const id of [...first, ...second]) {
    const k = String(id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(id);
  }
  return out;
}

const READ_TYPES_ALL = dedupeReadTypes(READ_TYPES_ESSENTIAL, READ_TYPES_EXTENDED);

/** Chiavi AsyncStorage per collegamento Salute (usate anche da HealthScreen). */
export const APPLE_HEALTH_STORAGE_KEYS = {
  linked: 'apple_health_linked',
  readAuthPrompted: 'apple_health_read_auth_prompted_v2',
} as const;

const SNAPSHOT_QUANTITY_IDS = [
  STEP_COUNT,
  ACTIVE_ENERGY,
  BODY_MASS,
  HEART_RATE,
  RESTING_HR,
  HRV_SDNN,
  BODY_FAT_PCT,
  LEAN_MASS,
  BMI,
  SPO2,
  DISTANCE_WALK,
  FLIGHTS,
  BASAL_ENERGY,
  DIETARY_ENERGY,
] as const satisfies readonly QuantityTypeIdentifier[];

export type AppleHealthSnapshot = {
  stepsToday: number | null;
  activeEnergyKcalToday: number | null;
  lastWeightKg: number | null;
  lastWeightDate: Date | null;
  heartRateBpm: number | null;
  restingHeartRateBpm: number | null;
  hrvSdnnMs: number | null;
  bodyFatPercent: number | null;
  leanBodyMassKg: number | null;
  bmi: number | null;
  oxygenSaturationPercent: number | null;
  sleepAsleepHoursRecent: number | null;
  distanceWalkingRunningKmToday: number | null;
  flightsClimbedToday: number | null;
  basalEnergyKcalToday: number | null;
  dietaryEnergyKcalToday: number | null;
};

/** Snapshot serializzabile per JSON (es. `POST /chat` `health_data`). */
export type AppleHealthSnapshotPayload = {
  steps_today: number | null;
  active_energy_kcal_today: number | null;
  last_weight_kg: number | null;
  last_weight_date: string | null;
  heart_rate_bpm: number | null;
  resting_heart_rate_bpm: number | null;
  hrv_sdnn_ms: number | null;
  body_fat_percent: number | null;
  lean_body_mass_kg: number | null;
  bmi: number | null;
  oxygen_saturation_percent: number | null;
  sleep_asleep_hours_recent: number | null;
  distance_walking_running_km_today: number | null;
  flights_climbed_today: number | null;
  basal_energy_kcal_today: number | null;
  dietary_energy_kcal_today: number | null;
};

/** Payload inviato in chat: solo chiavi con valore definito (no null/undefined/NaN). */
export type AppleHealthSnapshotPayloadWire = Partial<{
  [K in keyof AppleHealthSnapshotPayload]: Exclude<AppleHealthSnapshotPayload[K], null | undefined>;
}>;

export function serializeAppleHealthSnapshot(snapshot: AppleHealthSnapshot): AppleHealthSnapshotPayload {
  return {
    steps_today: snapshot.stepsToday,
    active_energy_kcal_today: snapshot.activeEnergyKcalToday,
    last_weight_kg: snapshot.lastWeightKg,
    last_weight_date: snapshot.lastWeightDate?.toISOString() ?? null,
    heart_rate_bpm: snapshot.heartRateBpm,
    resting_heart_rate_bpm: snapshot.restingHeartRateBpm,
    hrv_sdnn_ms: snapshot.hrvSdnnMs,
    body_fat_percent: snapshot.bodyFatPercent,
    lean_body_mass_kg: snapshot.leanBodyMassKg,
    bmi: snapshot.bmi,
    oxygen_saturation_percent: snapshot.oxygenSaturationPercent,
    sleep_asleep_hours_recent: snapshot.sleepAsleepHoursRecent,
    distance_walking_running_km_today: snapshot.distanceWalkingRunningKmToday,
    flights_climbed_today: snapshot.flightsClimbedToday,
    basal_energy_kcal_today: snapshot.basalEnergyKcalToday,
    dietary_energy_kcal_today: snapshot.dietaryEnergyKcalToday,
  };
}

export function compactAppleHealthPayload(payload: AppleHealthSnapshotPayload): AppleHealthSnapshotPayloadWire {
  const out: AppleHealthSnapshotPayloadWire = {};
  (Object.keys(payload) as (keyof AppleHealthSnapshotPayload)[]).forEach((key) => {
    const v = payload[key];
    if (v == null) return;
    if (typeof v === 'number' && Number.isNaN(v)) return;
    out[key] = v as AppleHealthSnapshotPayloadWire[typeof key];
  });
  return out;
}

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

async function sumTodayQuantityMulti(
  identifier: QuantityTypeIdentifier,
  dateFilter: { startDate: Date; endDate: Date },
  unitCandidates: string[],
): Promise<number | null> {
  for (const unit of unitCandidates) {
    try {
      const res = await queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
        filter: { date: dateFilter },
        unit,
      });
      const v = sumFromStats(res);
      if (v != null) return v;
    } catch {
      // try next unit
    }
    try {
      const v = await sumQuantitySamplesInRange(identifier, unit, dateFilter);
      if (v != null) return v;
    } catch {
      // try next unit
    }
  }
  return null;
}

/** Converte energia nel valore restituito in kcal (approx). */
function quantityToKcal(quantity: number, unit: string): number | null {
  const u = unit.trim();
  if (u === 'kcal' || u === 'Cal') return quantity;
  if (u === 'cal') return quantity * 0.001;
  if (u === 'J' || u === 'kJ') return u === 'kJ' ? quantity / 4.184 : quantity / 4184;
  return null;
}

async function sumTodayEnergyKcal(
  identifier: QuantityTypeIdentifier,
  preferred: string | undefined,
  dateFilter: { startDate: Date; endDate: Date },
): Promise<number | null> {
  const units = uniqueUnitCandidates(preferred, ['kcal', 'Cal', 'cal', 'J', 'kJ']);
  for (const unit of units) {
    try {
      const res = await queryStatisticsForQuantity(identifier, ['cumulativeSum'], {
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
      const samples = await queryQuantitySamples(identifier, {
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

/** Distanza camminata oggi in km. */
function quantityToKm(quantity: number, unit: string): number | null {
  const u = unit.trim();
  if (u === 'm') return quantity / 1000;
  if (u === 'km') return quantity;
  if (u === 'mi') return quantity * 1.609344;
  if (u === 'ft') return quantity * 0.0003048;
  if (u === 'yd') return quantity * 0.0009144;
  return null;
}

async function sumTodayDistanceKm(
  preferred: string | undefined,
  dateFilter: { startDate: Date; endDate: Date },
): Promise<number | null> {
  const units = uniqueUnitCandidates(preferred, ['m', 'km', 'mi']);
  for (const unit of units) {
    try {
      const res = await queryStatisticsForQuantity(DISTANCE_WALK, ['cumulativeSum'], {
        filter: { date: dateFilter },
        unit,
      });
      const q = res.sumQuantity;
      if (q && typeof q.quantity === 'number' && Number.isFinite(q.quantity)) {
        const km = quantityToKm(q.quantity, q.unit ?? unit);
        if (km != null) return km;
      }
    } catch {
      // continue
    }
    try {
      const samples = await queryQuantitySamples(DISTANCE_WALK, {
        limit: -1,
        unit,
        filter: { date: dateFilter },
        ascending: false,
      });
      if (!samples.length) continue;
      let sumKm = 0;
      for (const s of samples) {
        if (typeof s.quantity !== 'number' || !Number.isFinite(s.quantity)) continue;
        const km = quantityToKm(s.quantity, s.unit ?? unit);
        if (km == null) {
          sumKm = NaN;
          break;
        }
        sumKm += km;
      }
      if (Number.isFinite(sumKm)) return sumKm;
    } catch {
      // continue
    }
  }
  return null;
}

async function latestQuantityMulti(
  identifier: QuantityTypeIdentifier,
  unitCandidates: string[],
): Promise<number | null> {
  for (const unit of unitCandidates) {
    try {
      const samples = await queryQuantitySamples(identifier, {
        limit: 1,
        unit,
        ascending: false,
      });
      const q = samples[0]?.quantity;
      if (typeof q === 'number' && Number.isFinite(q)) return q;
    } catch {
      // continue
    }
  }
  return null;
}

async function latestBmiMulti(preferred: string | undefined): Promise<number | null> {
  const a = await latestQuantityMulti(BMI, uniqueUnitCandidates(preferred, ['kg/m^2', 'count']));
  if (a != null) return a;
  return null;
}

const ASLEEP_SLEEP_VALUES = new Set<number>([
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
]);

async function sleepAsleepHoursRecent(): Promise<number | null> {
  const end = new Date();
  const start = new Date(end.getTime() - 36 * 60 * 60 * 1000);
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

function sampleQuantityToKg(quantity: number, unit: string): number | null {
  const u = unit.trim();
  if (u === 'kg' || u === 'g') return u === 'g' ? quantity / 1000 : quantity;
  if (u === 'lb') return quantity * 0.45359237;
  if (u === 'st') return quantity * 6.35029;
  return null;
}

async function latestLeanBodyMassKgMulti(preferred: string | undefined): Promise<number | null> {
  const units = uniqueUnitCandidates(preferred, ['kg', 'lb', 'g']);
  for (const unit of units) {
    try {
      const samples = await queryQuantitySamples(LEAN_MASS, {
        limit: 1,
        unit,
        ascending: false,
      });
      const s = samples[0];
      if (!s || typeof s.quantity !== 'number' || !Number.isFinite(s.quantity)) continue;
      const kg = sampleQuantityToKg(s.quantity, (s.unit ?? unit).trim());
      if (kg != null) return kg;
    } catch {
      // continue
    }
  }
  return null;
}

async function getMostRecentWeightKgMulti(preferred: string | undefined): Promise<{ kg: number; end: Date } | null> {
  const units = uniqueUnitCandidates(preferred, ['kg', 'lb', 'g']);
  for (const unit of units) {
    try {
      const samples = await queryQuantitySamples(BODY_MASS, {
        limit: 1,
        unit,
        ascending: false,
      });
      const s = samples[0];
      if (!s || typeof s.quantity !== 'number' || !Number.isFinite(s.quantity)) continue;
      const u = (s.unit ?? unit).trim();
      const kg = sampleQuantityToKg(s.quantity, u);
      if (kg == null) continue;
      const rawEnd = s.endDate as unknown;
      const end =
        rawEnd instanceof Date
          ? rawEnd
          : typeof rawEnd === 'string' || typeof rawEnd === 'number'
            ? new Date(rawEnd)
            : null;
      if (!end || !Number.isFinite(end.getTime())) continue;
      return { kg, end };
    } catch {
      // continue
    }
  }
  return null;
}

async function preferredUnitMap(): Promise<Partial<Record<string, string>>> {
  try {
    const rows = await getPreferredUnits([...SNAPSHOT_QUANTITY_IDS]);
    const m: Partial<Record<string, string>> = {};
    for (const r of rows) {
      if (r.typeIdentifier && r.unit) m[r.typeIdentifier] = r.unit;
    }
    return m;
  } catch {
    return {};
  }
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

/**
 * Richiede in un solo foglio l’accesso in lettura a tutti i tipi usati dalla scheda Salute.
 */
export async function requestAppleHealthReadAccess(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await requestAuthorization({ toRead: READ_TYPES_ALL });
  } catch {
    return false;
  }
}

/**
 * Stato richiesta permessi per passi, energia e peso (più affidabile del solo authorizationStatusFor in lettura).
 */
export async function getEssentialReadAuthRequestStatus(): Promise<AuthorizationRequestStatus | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    return await getRequestStatusForAuthorization({ toRead: [...READ_TYPES_ESSENTIAL] });
  } catch {
    return null;
  }
}

/** Dati aggregati per oggi + ultimo peso. Richiede autorizzazione già concessa. */
export async function fetchAppleHealthSnapshot(): Promise<AppleHealthSnapshot> {
  const empty: AppleHealthSnapshot = {
    stepsToday: null,
    activeEnergyKcalToday: null,
    lastWeightKg: null,
    lastWeightDate: null,
    heartRateBpm: null,
    restingHeartRateBpm: null,
    hrvSdnnMs: null,
    bodyFatPercent: null,
    leanBodyMassKg: null,
    bmi: null,
    oxygenSaturationPercent: null,
    sleepAsleepHoursRecent: null,
    distanceWalkingRunningKmToday: null,
    flightsClimbedToday: null,
    basalEnergyKcalToday: null,
    dietaryEnergyKcalToday: null,
  };
  if (Platform.OS !== 'ios') return empty;

  const pref = await preferredUnitMap();
  const start = startOfToday();
  const end = new Date();
  const dateFilter = { startDate: start, endDate: end };

  const [
    stepsToday,
    activeEnergyKcalToday,
    lastWeight,
    heartRateBpm,
    restingHeartRateBpm,
    hrvSdnnMs,
    bodyFatPercent,
    leanBodyMassKg,
    bmi,
    oxygenSaturationPercent,
    sleepAsleepHoursRecentVal,
    distanceKmToday,
    flightsClimbedToday,
    basalEnergyKcalToday,
    dietaryEnergyKcalToday,
  ] = await Promise.all([
    sumTodayQuantityMulti(STEP_COUNT, dateFilter, uniqueUnitCandidates(pref[STEP_COUNT], ['count'])),
    sumTodayEnergyKcal(ACTIVE_ENERGY, pref[ACTIVE_ENERGY], dateFilter),
    getMostRecentWeightKgMulti(pref[BODY_MASS]).catch(() => null),
    latestQuantityMulti(HEART_RATE, uniqueUnitCandidates(pref[HEART_RATE], ['count/min'])),
    latestQuantityMulti(RESTING_HR, uniqueUnitCandidates(pref[RESTING_HR], ['count/min'])),
    latestQuantityMulti(HRV_SDNN, uniqueUnitCandidates(pref[HRV_SDNN], ['ms'])),
    latestQuantityMulti(BODY_FAT_PCT, uniqueUnitCandidates(pref[BODY_FAT_PCT], ['%'])),
    latestLeanBodyMassKgMulti(pref[LEAN_MASS]),
    latestBmiMulti(pref[BMI]),
    latestQuantityMulti(SPO2, uniqueUnitCandidates(pref[SPO2], ['%'])),
    sleepAsleepHoursRecent(),
    sumTodayDistanceKm(pref[DISTANCE_WALK], dateFilter),
    sumTodayQuantityMulti(FLIGHTS, dateFilter, uniqueUnitCandidates(pref[FLIGHTS], ['count'])),
    sumTodayEnergyKcal(BASAL_ENERGY, pref[BASAL_ENERGY], dateFilter),
    sumTodayEnergyKcal(DIETARY_ENERGY, pref[DIETARY_ENERGY], dateFilter),
  ]);

  let lastWeightKg: number | null = null;
  let lastWeightDate: Date | null = null;
  if (lastWeight) {
    lastWeightKg = lastWeight.kg;
    lastWeightDate = lastWeight.end;
  }

  return {
    stepsToday,
    activeEnergyKcalToday,
    lastWeightKg,
    lastWeightDate,
    heartRateBpm,
    restingHeartRateBpm,
    hrvSdnnMs,
    bodyFatPercent,
    leanBodyMassKg,
    bmi,
    oxygenSaturationPercent,
    sleepAsleepHoursRecent: sleepAsleepHoursRecentVal,
    distanceWalkingRunningKmToday: distanceKmToday,
    flightsClimbedToday,
    basalEnergyKcalToday,
    dietaryEnergyKcalToday,
  };
}

const SNAPSHOT_FETCH_CACHE_TTL_MS = 90_000;
let snapshotFetchCache: { fetchedAt: number; snapshot: AppleHealthSnapshot } | null = null;

/** Come `fetchAppleHealthSnapshot` con cache in memoria breve (riduce latenza invio chat). */
export async function fetchAppleHealthSnapshotCached(): Promise<AppleHealthSnapshot> {
  const now = Date.now();
  if (snapshotFetchCache && now - snapshotFetchCache.fetchedAt < SNAPSHOT_FETCH_CACHE_TTL_MS) {
    return snapshotFetchCache.snapshot;
  }
  const snapshot = await fetchAppleHealthSnapshot();
  snapshotFetchCache = { fetchedAt: now, snapshot };
  return snapshot;
}

export type BodyMassHistoryEntry = {
  kg: number;
  date: Date;
  uuid: string;
};

/** Ultimi campioni peso nel periodo (deduplicati per uuid), dal più recente. */
export async function fetchBodyMassHistory(options?: {
  days?: number;
  maxSamples?: number;
}): Promise<BodyMassHistoryEntry[]> {
  const days = options?.days ?? 30;
  const maxSamples = options?.maxSamples ?? 60;
  if (Platform.OS !== 'ios') return [];

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const dateFilter = { startDate: start, endDate: end };

  let pref: Partial<Record<string, string>> = {};
  try {
    pref = await preferredUnitMap();
  } catch {
    pref = {};
  }
  const units = uniqueUnitCandidates(pref[BODY_MASS], ['kg', 'lb', 'g']);
  const byUuid = new Map<string, BodyMassHistoryEntry>();

  for (const unit of units) {
    try {
      const samples = await queryQuantitySamples(BODY_MASS, {
        limit: -1,
        unit,
        filter: { date: dateFilter },
        ascending: false,
      });
      for (const s of samples) {
        if (typeof s.quantity !== 'number' || !Number.isFinite(s.quantity)) continue;
        const u = (s.unit ?? unit).trim();
        const kg = sampleQuantityToKg(s.quantity, u);
        if (kg == null) continue;
        const rawEnd = s.endDate as unknown;
        const date =
          rawEnd instanceof Date
            ? rawEnd
            : typeof rawEnd === 'string' || typeof rawEnd === 'number'
              ? new Date(rawEnd)
              : null;
        if (!date || !Number.isFinite(date.getTime())) continue;
        const uuid = s.uuid;
        if (!uuid || byUuid.has(uuid)) continue;
        byUuid.set(uuid, { kg, date, uuid });
      }
    } catch {
      // try next unit
    }
  }

  const out = [...byUuid.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  return out.slice(0, maxSamples);
}

export type DailyEnergyKcalRow = {
  dateKey: string;
  dietaryKcal: number | null;
  activeKcal: number | null;
};

/** Totali giornalieri kcal (introdotte + attiva) per gli ultimi `days` giorni, oggi per primo. */
export async function fetchDailyEnergyKcalLastDays(days = 14): Promise<DailyEnergyKcalRow[]> {
  if (Platform.OS !== 'ios') return [];

  let pref: Partial<Record<string, string>> = {};
  try {
    pref = await preferredUnitMap();
  } catch {
    pref = {};
  }

  const now = new Date();
  const rowPromises: Promise<DailyEnergyKcalRow>[] = [];

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 23, 59, 59, 999);
    const dateFilter = { startDate: dayStart, endDate: dayEnd };
    const dateKey = dateLocalYmd(dayStart);

    rowPromises.push(
      (async (): Promise<DailyEnergyKcalRow> => {
        try {
          const [dietaryKcal, activeKcal] = await Promise.all([
            sumTodayEnergyKcal(DIETARY_ENERGY, pref[DIETARY_ENERGY], dateFilter),
            sumTodayEnergyKcal(ACTIVE_ENERGY, pref[ACTIVE_ENERGY], dateFilter),
          ]);
          return { dateKey, dietaryKcal, activeKcal };
        } catch {
          return { dateKey, dietaryKcal: null, activeKcal: null };
        }
      })(),
    );
  }

  return Promise.all(rowPromises);
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

export function dateLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localDayStartEnd(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset, 23, 59, 59, 999);
  return { start, end };
}

function fmtStoricoNum(n: number): string {
  if (Number.isNaN(n)) return '—';
  return Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

function dayLabelIt(d: Date): string {
  try {
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return dateLocalYmd(d);
  }
}

export const SALUTE_METRIC_IDS = [
  'bodyMass',
  'stepCount',
  'activeEnergy',
  'distanceWalkingRunning',
  'flightsClimbed',
  'basalEnergy',
  'dietaryEnergy',
  'heartRate',
  'restingHeartRate',
  'hrvSdnn',
  'oxygenSaturation',
  'bodyFat',
  'leanBodyMass',
  'bmi',
  'sleep',
] as const;

export type SaluteMetricId = (typeof SALUTE_METRIC_IDS)[number];

const SALUTE_METRIC_ID_SET = new Set<string>(SALUTE_METRIC_IDS);

export function parseSaluteMetricId(s: string): SaluteMetricId | null {
  return SALUTE_METRIC_ID_SET.has(s) ? (s as SaluteMetricId) : null;
}

const SALUTE_METRIC_TITLES: Record<SaluteMetricId, string> = {
  bodyMass: 'Peso',
  stepCount: 'Passi',
  activeEnergy: 'Energia attiva',
  distanceWalkingRunning: 'Distanza camminata/corsa',
  flightsClimbed: 'Piani saliti',
  basalEnergy: 'Energia basale',
  dietaryEnergy: 'Calorie introdotte',
  heartRate: 'Frequenza cardiaca',
  restingHeartRate: 'Frequenza a riposo',
  hrvSdnn: 'Variabilità (HRV SDNN)',
  oxygenSaturation: 'Saturazione ossigeno',
  bodyFat: 'Massa grassa',
  leanBodyMass: 'Massa magra',
  bmi: 'BMI',
  sleep: 'Sonno effettivo',
};

export function saluteMetricTitle(metric: SaluteMetricId): string {
  return SALUTE_METRIC_TITLES[metric];
}

export type StoricoRow = {
  date: Date;
  primaryLine: string;
  secondaryLine?: string;
};

async function fetchDailySumStoricoRows(
  days: number,
  getValue: (dateFilter: { startDate: Date; endDate: Date }) => Promise<number | null>,
  formatPrimary: (n: number) => string,
): Promise<StoricoRow[]> {
  const rows: StoricoRow[] = [];
  for (let i = 0; i < days; i++) {
    const { start, end } = localDayStartEnd(i);
    const dateFilter = { startDate: start, endDate: end };
    let v: number | null = null;
    try {
      v = await getValue(dateFilter);
    } catch {
      v = null;
    }
    rows.push({
      date: start,
      primaryLine: v == null || Number.isNaN(v) ? '—' : formatPrimary(v),
      secondaryLine: dayLabelIt(start),
    });
  }
  return rows;
}

/** Sonno asleep aggregato per «giorno di fine» segmento (sveglia in quel giorno locale). */
async function fetchDailySleepAsleepHoursStorico(days: number): Promise<StoricoRow[]> {
  if (Platform.OS !== 'ios') return [];
  const end = new Date();
  const start = new Date(end.getTime() - (days + 3) * 24 * 60 * 60 * 1000);
  let samples: Awaited<ReturnType<typeof queryCategorySamples>>;
  try {
    samples = await queryCategorySamples(SLEEP_CAT, {
      limit: -1,
      filter: { date: { startDate: start, endDate: end } },
      ascending: false,
    });
  } catch {
    return [];
  }
  const msByWakeDay = new Map<string, number>();
  for (const s of samples) {
    const v = s.value as number;
    if (!ASLEEP_SLEEP_VALUES.has(v)) continue;
    const rawEd = s.endDate as unknown;
    const ed = rawEd instanceof Date ? rawEd : new Date(rawEd as string);
    const rawSd = s.startDate as unknown;
    const sd = rawSd instanceof Date ? rawSd : new Date(rawSd as string);
    if (!Number.isFinite(ed.getTime()) || !Number.isFinite(sd.getTime()) || ed <= sd) continue;
    const key = dateLocalYmd(ed);
    msByWakeDay.set(key, (msByWakeDay.get(key) ?? 0) + (ed.getTime() - sd.getTime()));
  }
  const rows: StoricoRow[] = [];
  for (let i = 0; i < days; i++) {
    const { start: dayStart } = localDayStartEnd(i);
    const key = dateLocalYmd(dayStart);
    const ms = msByWakeDay.get(key) ?? 0;
    const hours = ms > 0 ? ms / (1000 * 60 * 60) : null;
    rows.push({
      date: dayStart,
      primaryLine: hours == null || hours <= 0 ? '—' : `${fmtStoricoNum(hours)} h`,
      secondaryLine: dayLabelIt(dayStart),
    });
  }
  return rows;
}

async function fetchQuantitySampleStorico(
  identifier: QuantityTypeIdentifier,
  unitCandidates: string[],
  sampleDays: number,
  sampleLimit: number,
  formatSample: (quantity: number, unit: string) => { primary: string; secondary?: string },
): Promise<StoricoRow[]> {
  if (Platform.OS !== 'ios') return [];
  let pref: Partial<Record<string, string>> = {};
  try {
    pref = await preferredUnitMap();
  } catch {
    pref = {};
  }
  const units = uniqueUnitCandidates(pref[identifier as string], unitCandidates);
  const end = new Date();
  const start = new Date(end.getTime() - sampleDays * 24 * 60 * 60 * 1000);
  const byUuid = new Map<string, StoricoRow>();

  for (const unit of units) {
    try {
      const samples = await queryQuantitySamples(identifier, {
        limit: sampleLimit,
        unit,
        filter: { date: { startDate: start, endDate: end } },
        ascending: false,
      });
      for (const s of samples) {
        if (!s.uuid || byUuid.has(s.uuid)) continue;
        if (typeof s.quantity !== 'number' || !Number.isFinite(s.quantity)) continue;
        const rawEnd = s.endDate as unknown;
        const d =
          rawEnd instanceof Date
            ? rawEnd
            : typeof rawEnd === 'string' || typeof rawEnd === 'number'
              ? new Date(rawEnd)
              : null;
        if (!d || !Number.isFinite(d.getTime())) continue;
        const u = (s.unit ?? unit).trim();
        const { primary, secondary } = formatSample(s.quantity, u);
        byUuid.set(s.uuid, {
          date: d,
          primaryLine: primary,
          secondaryLine: secondary ?? formatWeightDate(d),
        });
      }
    } catch {
      // next unit
    }
  }

  return [...byUuid.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Storico per una metrica Salute (14 giorni per somme giornaliere / sonno; campioni recenti per il resto). */
export async function fetchSaluteMetricHistory(metric: SaluteMetricId): Promise<StoricoRow[]> {
  if (Platform.OS !== 'ios') return [];

  let pref: Partial<Record<string, string>> = {};
  try {
    pref = await preferredUnitMap();
  } catch {
    pref = {};
  }

  const dailyDays = 14;
  const sampleDays = 14;
  const sampleLimit = 64;

  switch (metric) {
    case 'bodyMass': {
      const entries = await fetchBodyMassHistory({ days: 90, maxSamples: 120 });
      return entries.map((e) => ({
        date: e.date,
        primaryLine: `${fmtStoricoNum(e.kg)} kg`,
        secondaryLine: formatWeightDate(e.date),
      }));
    }
    case 'stepCount':
      return fetchDailySumStoricoRows(
        dailyDays,
        (df) => sumTodayQuantityMulti(STEP_COUNT, df, uniqueUnitCandidates(pref[STEP_COUNT], ['count'])),
        (n) => `${fmtStoricoNum(n)} passi`,
      );
    case 'activeEnergy':
      return fetchDailySumStoricoRows(
        dailyDays,
        (df) => sumTodayEnergyKcal(ACTIVE_ENERGY, pref[ACTIVE_ENERGY], df),
        (n) => `${fmtStoricoNum(n)} kcal`,
      );
    case 'distanceWalkingRunning':
      return fetchDailySumStoricoRows(
        dailyDays,
        (df) => sumTodayDistanceKm(pref[DISTANCE_WALK], df),
        (n) => `${fmtStoricoNum(n)} km`,
      );
    case 'flightsClimbed':
      return fetchDailySumStoricoRows(
        dailyDays,
        (df) => sumTodayQuantityMulti(FLIGHTS, df, uniqueUnitCandidates(pref[FLIGHTS], ['count'])),
        (n) => `${fmtStoricoNum(n)} piani`,
      );
    case 'basalEnergy':
      return fetchDailySumStoricoRows(
        dailyDays,
        (df) => sumTodayEnergyKcal(BASAL_ENERGY, pref[BASAL_ENERGY], df),
        (n) => `${fmtStoricoNum(n)} kcal`,
      );
    case 'dietaryEnergy':
      return fetchDailySumStoricoRows(
        dailyDays,
        (df) => sumTodayEnergyKcal(DIETARY_ENERGY, pref[DIETARY_ENERGY], df),
        (n) => `${fmtStoricoNum(n)} kcal`,
      );
    case 'heartRate':
      return fetchQuantitySampleStorico(HEART_RATE, ['count/min'], sampleDays, sampleLimit, (q) => ({
        primary: `${fmtStoricoNum(q)} bpm`,
      }));
    case 'restingHeartRate':
      return fetchQuantitySampleStorico(RESTING_HR, ['count/min'], sampleDays, sampleLimit, (q) => ({
        primary: `${fmtStoricoNum(q)} bpm`,
      }));
    case 'hrvSdnn':
      return fetchQuantitySampleStorico(HRV_SDNN, ['ms'], sampleDays, sampleLimit, (q) => ({
        primary: `${fmtStoricoNum(q)} ms`,
      }));
    case 'oxygenSaturation':
      return fetchQuantitySampleStorico(SPO2, ['%'], sampleDays, sampleLimit, (q) => {
        const pct = q <= 1 && q > 0 ? q * 100 : q;
        return { primary: `${fmtStoricoNum(pct)} %` };
      });
    case 'bodyFat':
      return fetchQuantitySampleStorico(BODY_FAT_PCT, ['%'], sampleDays, sampleLimit, (q) => ({
        primary: `${fmtStoricoNum(q)} %`,
      }));
    case 'leanBodyMass':
      return fetchQuantitySampleStorico(LEAN_MASS, ['kg', 'lb', 'g'], sampleDays, sampleLimit, (q, u) => {
        const kg = sampleQuantityToKg(q, u);
        return { primary: kg != null ? `${fmtStoricoNum(kg)} kg` : `${fmtStoricoNum(q)} ${u}` };
      });
    case 'bmi':
      return fetchQuantitySampleStorico(BMI, ['kg/m^2', 'count'], sampleDays, sampleLimit, (q) => ({
        primary: fmtStoricoNum(q),
      }));
    case 'sleep':
      return fetchDailySleepAsleepHoursStorico(dailyDays);
    default:
      return [];
  }
}
