/**
 * Estrae un vettore numerico fisso da uno snapshot contesto (allineato a training/json_features.py).
 * Copia allineata a ml_food/rn/contextSnapshotFeatures.ts.
 */

export const TIME_OF_DAY = ['unknown', 'night', 'morning', 'lunch', 'afternoon', 'evening'] as const;

/** Il bundle sensori usa anche `dinner` (17–20); il modello linear è addestrato solo sulle 7 fasce sopra. */
const TIME_OF_DAY_TO_MODEL: Record<string, string> = {
  dinner: 'evening',
};

/**
 * `SensorBundleService` usa `network_source: 'netinfo'` quando NetInfo risponde; il modello ha solo
 * unknown | unavailable | core_telephony | reachability — senza alias finiva tutto in `unknown`.
 */
const NETWORK_SOURCE_TO_MODEL: Record<string, string> = {
  netinfo: 'reachability',
};

/** Stati IMU/audio extra rispetto al vocabolario training → slot più vicino (stessa cardinalità one-hot). */
const IMU_STATUS_TO_MODEL: Record<string, string> = {
  module_unavailable: 'error',
};

const AUDIO_STATUS_TO_MODEL: Record<string, string> = {
  init_failed: 'error',
  capture_failed: 'error',
  no_mic_data: 'denied',
  skipped: 'unknown',
};
export const APP_STATE = ['unknown', 'active', 'background', 'inactive'] as const;
export const NETWORK_TYPE = ['unknown', 'wifi', 'cellular', 'none', 'other'] as const;
export const NETWORK_SOURCE = ['unknown', 'unavailable', 'core_telephony', 'reachability'] as const;
export const IMU_STATUS = ['unknown', 'ok', 'no_samples', 'denied', 'error'] as const;
export const AUDIO_STATUS = ['unknown', 'ok', 'module_missing', 'denied', 'error'] as const;

export type ContextSnapshot = Record<string, unknown>;

function get(obj: unknown, ...keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || typeof cur !== 'object' || !(k in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function oneHot(value: string | undefined | null, vocab: readonly string[]): number[] {
  let v = (value ?? 'unknown').toString().trim().toLowerCase();
  if (!vocab.includes(v)) v = vocab.includes('unknown') ? 'unknown' : vocab[0];
  return vocab.map((k) => (k === v ? 1 : 0));
}

function nz(x: unknown, scale: number): number {
  if (x === null || x === undefined) return 0;
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return n / scale;
}

/** `SensorBundleService` espone la luminosità iOS in [0, 1]; il modello si allena su percentuale/100. */
function screenBrightnessPercentForModel(x: unknown): number {
  if (x === null || x === undefined) return 0;
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  if (n >= 0 && n <= 1) return n * 100;
  return Math.min(n, 100);
}

/** Volume sistema spesso in [0, 1] su iOS; allinea a percentuale/100 come in training. */
function systemVolumePercentForModel(x: unknown): number {
  if (x === null || x === undefined) return 0;
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  if (n >= 0 && n <= 1) return n * 100;
  return Math.min(n, 100);
}

export interface SnapshotFeatureResult {
  vector: number[];
  featureNames: string[];
  missingByGroup: Record<string, number>;
  qualityScore: number;
}

/** qualityScore: 1 = tutti i gruppi hanno dati principali, 0 = tutti mancanti */
export function extractSnapshotFeatures(snapshot: ContextSnapshot): SnapshotFeatureResult {
  const g = (get(snapshot, 'gps') as Record<string, unknown> | undefined) ?? {};
  const imu = (get(snapshot, 'imu') as Record<string, unknown> | undefined) ?? {};
  const audio = (get(snapshot, 'audio') as Record<string, unknown> | undefined) ?? {};
  const bt = (get(snapshot, 'bluetooth') as Record<string, unknown> | undefined) ?? {};
  const cal = (get(snapshot, 'calendar') as Record<string, unknown> | undefined) ?? {};
  const sys = (get(snapshot, 'system') as Record<string, unknown> | undefined) ?? {};
  const tmp = (get(snapshot, 'temporal') as Record<string, unknown> | undefined) ?? {};
  const bh = (get(snapshot, 'behavioral') as Record<string, unknown> | undefined) ?? {};
  const h = (get(snapshot, 'health') as Record<string, unknown> | undefined) ?? {};

  const head = g.heading_deg;
  const headingValid = head !== null && head !== undefined && Number(head) >= 0 ? 1 : 0;
  const headingNorm = headingValid ? Number(head) / 360 : 0;

  const nums = [
    (Number(g.latitude ?? 0) + 90) / 180,
    (Number(g.longitude ?? 0) + 180) / 360,
    Math.min(nz(g.speed_kmh, 200), 1),
    Math.min(nz(g.altitude_m, 9000), 1),
    Math.min(nz(g.accuracy_m, 500), 1),
    headingValid,
    headingNorm,
    Math.min(nz(imu.acceleration_magnitude, 50), 1),
    Math.min(nz(imu.rotation_rate_deg_s, 720), 1),
    Math.min(nz(imu.pressure_hpa, 1100), 1),
    Math.min(nz(audio.db_level, 120), 1),
    Math.min(nz(systemVolumePercentForModel(audio.system_volume), 100), 1),
    Math.min(nz(audio.voice_probability, 1), 1),
    bt.enabled ? 1 : 0,
    bt.is_car_audio ? 1 : 0,
    bt.is_headphones ? 1 : 0,
    bt.is_smartwatch ? 1 : 0,
    Math.min(Number(cal.events_in_next_2h ?? 0) / 20, 1),
    cal.currently_in_event ? 1 : 0,
    cal.next_event_is_online ? 1 : 0,
    sys.is_charging ? 1 : 0,
    Math.min(nz(screenBrightnessPercentForModel(sys.screen_brightness), 100), 1),
    Math.min(nz(sys.free_memory_mb, 65536), 1),
    sys.dark_mode ? 1 : 0,
    nz(tmp.hour, 24),
    nz(tmp.minute, 60),
    nz(tmp.day_of_week, 7),
    tmp.is_weekend ? 1 : 0,
    Math.min(nz(bh.time_since_last_app_open_min, 10080), 1),
    Math.min(nz(bh.meals_logged_today, 10), 1),
    Math.min(nz(bh.last_meal_logged_min_ago, 10080), 1),
    Math.min(nz(bh.typical_lunch_hour, 24), 1),
  ];

  const namesNum = [
    'gps_lat_norm',
    'gps_lon_norm',
    'gps_speed_norm',
    'gps_alt_norm',
    'gps_accuracy_norm',
    'gps_heading_valid',
    'gps_heading_norm',
    'imu_accel_norm',
    'imu_gyro_norm',
    'imu_pressure_norm',
    'audio_db_norm',
    'audio_volume_norm',
    'audio_voice_prob_norm',
    'bt_enabled',
    'bt_car',
    'bt_headphones',
    'bt_watch',
    'cal_events_2h_norm',
    'cal_in_event',
    'cal_next_online',
    'sys_charging',
    'sys_brightness_norm',
    'sys_mem_norm',
    'sys_dark',
    'tmp_hour_norm',
    'tmp_minute_norm',
    'tmp_dow_norm',
    'tmp_weekend',
    'beh_app_open_norm',
    'beh_meals_norm',
    'beh_last_meal_norm',
    'beh_typical_lunch_norm',
  ];

  let tod = String(tmp.time_of_day ?? 'unknown').trim().toLowerCase();
  tod = TIME_OF_DAY_TO_MODEL[tod] ?? tod;
  let nsrc = String(sys.network_source ?? 'unknown').trim().toLowerCase();
  nsrc = NETWORK_SOURCE_TO_MODEL[nsrc] ?? nsrc;
  let imuSt = String(imu.imu_status ?? 'unknown').trim().toLowerCase();
  imuSt = IMU_STATUS_TO_MODEL[imuSt] ?? imuSt;
  let audSt = String(audio.audio_status ?? 'unknown').trim().toLowerCase();
  audSt = AUDIO_STATUS_TO_MODEL[audSt] ?? audSt;
  const cats = [
    ...oneHot(tod, TIME_OF_DAY),
    ...oneHot(sys.app_state as string, APP_STATE),
    ...oneHot(sys.network_type as string, NETWORK_TYPE),
    ...oneHot(nsrc, NETWORK_SOURCE),
    ...oneHot(imuSt, IMU_STATUS),
    ...oneHot(audSt, AUDIO_STATUS),
  ];

  const catNames = [
    ...TIME_OF_DAY.map((k) => `tod_${k}`),
    ...APP_STATE.map((k) => `app_${k}`),
    ...NETWORK_TYPE.map((k) => `net_${k}`),
    ...NETWORK_SOURCE.map((k) => `nsrc_${k}`),
    ...IMU_STATUS.map((k) => `imu_${k}`),
    ...AUDIO_STATUS.map((k) => `aud_${k}`),
  ];

  const missingGroups = {
    gps: g.latitude == null || g.longitude == null ? 1 : 0,
    imu: imu.acceleration_magnitude == null ? 1 : 0,
    audio: audio.db_level == null ? 1 : 0,
    health: h.steps_today == null ? 1 : 0,
  };

  const qual = [
    missingGroups.gps,
    missingGroups.imu,
    missingGroups.audio,
    missingGroups.health,
    (missingGroups.gps + missingGroups.imu + missingGroups.audio + missingGroups.health) / 4,
  ];
  const qualNames = ['miss_gps', 'miss_imu', 'miss_audio', 'miss_health', 'miss_avg'];

  const vector = [...nums, ...cats, ...qual];
  const featureNames = [...namesNum, ...catNames, ...qualNames];
  const qualityScore = 1 - qual[4];

  return { vector, featureNames, missingByGroup: missingGroups, qualityScore };
}

export interface GatedPrediction {
  label: string;
  confidence: number;
  lowConfidence: boolean;
  reason?: string;
}

/** Applica una soglia su confidence e su qualità segnali (es. IMU/audio assenti). */
export function gatePrediction(
  label: string,
  confidence: number,
  qualityScore: number,
  opts?: { minConfidence?: number; minQuality?: number },
): GatedPrediction {
  const minConfidence = opts?.minConfidence ?? 0.35;
  const minQuality = opts?.minQuality ?? 0.25;
  if (qualityScore < minQuality) {
    return { label: 'unknown', confidence, lowConfidence: true, reason: 'low_signal_quality' };
  }
  if (confidence < minConfidence) {
    return { label: 'unknown', confidence, lowConfidence: true, reason: 'low_model_confidence' };
  }
  return { label, confidence, lowConfidence: false };
}
