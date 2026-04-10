/**
 * iOS — aggiungi a Info.plist le usage description:
 * - NSLocationAlwaysAndWhenInUseUsageDescription
 * - NSLocationWhenInUseUsageDescription
 * - NSBluetoothAlwaysUsageDescription
 * - NSCalendarsUsageDescription
 * - NSMicrophoneUsageDescription   (solo metering dB, nessuna registrazione persistente)
 * - NSMotionUsageDescription       (accelerometro, giroscopio, magnetometro, barometro)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { initLlama, type LlamaContext } from 'llama.rn';
import type { LLMType } from 'react-native-executorch';
import { AppState, Appearance, NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import CalendarEvents from 'react-native-calendar-events';
import DeviceInfo from 'react-native-device-info';
import type { TensorflowModel } from 'react-native-fast-tflite';

import apiClient from '../api/client';
import {
  fetchAppleHealthSnapshotCached,
  getHealthKitReadRequestLabel,
  type HealthKitReadRequestLabel,
} from './appleHealth';

// react-native-sensors: niente import top-level (può lanciare se i native module mancano).
let rnAccelerometer: any = null;
let rnGyroscope: any = null;
let rnMagnetometer: any = null;
let rnBarometer: any = null;
let rnSensorTypes: { accelerometer: string; gyroscope: string; magnetometer: string; barometer: string } | null =
  null;
let rnSetUpdateIntervalForType: ((type: string, updateInterval: number) => void) | null = null;

try {
  const sensors = require('react-native-sensors');
  rnAccelerometer = sensors.accelerometer;
  rnGyroscope = sensors.gyroscope;
  rnMagnetometer = sensors.magnetometer;
  rnBarometer = sensors.barometer;
  rnSensorTypes = sensors.SensorTypes;
  rnSetUpdateIntervalForType = sensors.setUpdateIntervalForType;
} catch (e: unknown) {
  if (__DEV__) {
    console.warn('[SensorBundle] react-native-sensors non disponibile:', e);
  }
}

// ── GRUPPO 1: dati grezzi da ogni collector ─────────────────────────────────

interface GpsData {
  latitude: number | null;
  longitude: number | null;
  speed_kmh: number | null;
  altitude_m: number | null;
  heading_deg: number | null;
  accuracy_m: number | null;
  /** Euristica locale (centroidi / bbox), senza geocoding esterno. */
  area_hint_it: string | null;
  coarse_region_it: string | null;
}

export type ImuCollectionStatus = 'ok' | 'module_unavailable' | 'no_samples' | 'error';

interface ImuData {
  acceleration_magnitude: number | null;
  rotation_rate_deg_s: number | null;
  magnetic_heading: number | null;
  pressure_hpa: number | null;
  estimated_floor: number | null;
  imu_status: ImuCollectionStatus;
  imu_status_detail: string | null;
}

export type AudioCollectionStatus =
  | 'ok'
  | 'skipped'
  | 'module_missing'
  | 'init_failed'
  | 'capture_failed'
  | 'no_mic_data';

interface AudioData {
  db_level: number | null;
  audio_output: 'speaker' | 'headphones' | 'car' | 'silent' | null;
  call_state: 'idle' | 'ringing' | 'connected' | 'disconnected' | null;
  system_volume: number | null;
  audio_scene: 'restaurant' | 'office' | 'traffic' | 'music' | 'home' | 'outdoor' | 'gym' | 'unknown' | null;
  audio_scene_confidence: number | null;
  voice_activity: boolean | null;
  voice_probability: number | null;
  audio_status: AudioCollectionStatus;
  audio_status_detail: string | null;
}

interface BluetoothData {
  enabled: boolean;
  connected_devices: Array<{ name: string; id: string }>;
  is_car_audio: boolean;
  is_headphones: boolean;
  is_smartwatch: boolean;
  car_device_name: string | null;
}

interface CalendarData {
  next_event_minutes: number | null;
  next_event_title: string | null;
  next_event_duration_min: number | null;
  next_event_is_online: boolean;
  next_event_attendees: number | null;
  events_in_next_2h: number;
  currently_in_event: boolean;
}

interface SystemData {
  /** null = lettura non disponibile o non affidabile (non confondere con 0%). */
  battery_level: number | null;
  is_charging: boolean;
  network_type: 'wifi' | 'cellular' | 'none' | 'unknown';
  /** `unavailable` se il modulo NetInfo non è nel binary o fetch fallita. */
  network_source: 'netinfo' | 'unavailable';
  wifi_ssid: string | null;
  app_state: 'active' | 'background' | 'inactive';
  screen_brightness: number;
  free_memory_mb: number;
  dark_mode: boolean;
  device_model: string;
}

interface HealthData {
  steps_today: number | null;
  resting_hr_bpm: number | null;
  hrv_ms: number | null;
  active_calories: number | null;
  sleep_hours: number | null;
  last_workout_type: string | null;
  last_workout_minutes_ago: number | null;
  stand_hours_today: number | null;
  healthkit_read_status: HealthKitReadRequestLabel;
}

interface TemporalData {
  hour: number;
  minute: number;
  day_of_week: number;
  is_weekend: boolean;
  time_of_day: 'night' | 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening';
  /** Etichetta italiana allineata a `time_of_day`. */
  time_of_day_it: string;
  /** Es. "14:18, pomeriggio" (timezone locale dispositivo). */
  local_time_label_it: string;
  timestamp_iso: string;
}

interface BehavioralData {
  time_since_last_app_open_min: number | null;
  meals_logged_today: number | null;
  last_meal_logged_min_ago: number | null;
  typical_lunch_hour: number | null;
}

// ── GRUPPO 2: bundle completo ──────────────────────────────────────────────

export interface RawSensorBundle {
  gps: GpsData;
  imu: ImuData;
  audio: AudioData;
  bluetooth: BluetoothData;
  calendar: CalendarData;
  system: SystemData;
  health: HealthData;
  temporal: TemporalData;
  behavioral: BehavioralData;
}

// ── GRUPPO 3: output LLM on-device ─────────────────────────────────────────

export interface ContextState {
  context:
    | 'driving'
    | 'restaurant'
    | 'gym'
    | 'office'
    | 'home'
    | 'commuting'
    | 'meeting'
    | 'resting'
    | 'unknown';
  available: 'yes' | 'partial' | 'no';
  stress_level: 'low' | 'medium' | 'high';
  meal_window: boolean;
  physical_state: 'sedentary' | 'light_activity' | 'post_workout' | 'exercising';
  social_context: 'alone' | 'with_others' | 'in_meeting' | 'unknown';
  key_insight: string;
  should_intervene: boolean;
  intervention_reason: string | null;
  confidence: number;
}

// ── GRUPPO 4: payload backend ───────────────────────────────────────────────

interface ContextSnapshotPayload {
  context_snapshot: {
    raw: RawSensorBundle;
    context: ContextState;
    collected_at: string;
  };
}

// ── Costanti e stato modulo ────────────────────────────────────────────────

const FALLBACK_CONTEXT: ContextState = {
  context: 'unknown',
  available: 'yes',
  stress_level: 'low',
  meal_window: false,
  physical_state: 'sedentary',
  social_context: 'unknown',
  key_insight: 'contesto non disponibile',
  should_intervene: false,
  intervention_reason: null,
  confidence: 0,
};

const GPS_TIMEOUT_MS = 4000;
const COLLECTOR_TIMEOUT_MS = 2000;
const LLM_INFERENCE_TIMEOUT_MS = 6000;

/** Se true, invia `POST /context_snapshots`. Se false, solo snapshot locale + log dev / schermata debug. */
export const SEND_CONTEXT_SNAPSHOTS_TO_SERVER = false;

export interface SensorBundleDebugSnapshot {
  collectedAt: string;
  raw: RawSensorBundle | null;
  context: ContextState | null;
  fuseError: string | null;
  collectionError: string | null;
}

let lastSensorBundleDebug: SensorBundleDebugSnapshot | null = null;

export function getLastSensorBundleDebug(): SensorBundleDebugSnapshot | null {
  return lastSensorBundleDebug;
}

/** Chiavi AsyncStorage: pattern comportamentali (pasti aggiornati da altre schermate). */
const AS_LAST_FOREGROUND_AT = 'sensor_bundle_last_foreground_at';
const AS_MEALS_LOGGED_TODAY = 'sensor_bundle_meals_logged_today';
const AS_LAST_MEAL_AT = 'sensor_bundle_last_meal_at';
const AS_TYPICAL_LUNCH_HOUR = 'sensor_bundle_typical_lunch_hour';

let llamaCtx: LlamaContext | null = null;
let yamnetModel: TensorflowModel | null = null;
let yamnetLoadFailed = false;
let bleManager: BleManager | null = null;
let refPressureHpa: number | null = null;

const CAR_RX = /carplay|android auto|bmw|audi|mercedes|ford|vw|volkswagen|car stereo|automotive/i;
const HP_RX = /airpods|bose|sony|jabra|sennheiser|beats|headphone|earbud/i;
const WATCH_RX = /watch|fitbit|garmin|polar/i;

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Centroidi approssimati + raggio: niente API esterne. */
const ITALY_CITY_HINTS: Array<{ label: string; lat: number; lon: number; radiusKm: number }> = [
  { label: 'Catania / Sicilia orientale', lat: 37.5079, lon: 15.083, radiusKm: 42 },
  { label: 'Messina', lat: 38.1938, lon: 15.554, radiusKm: 35 },
  { label: 'Siracusa', lat: 37.0755, lon: 15.2866, radiusKm: 38 },
  { label: 'Palermo', lat: 38.1157, lon: 13.3615, radiusKm: 45 },
  { label: 'Roma', lat: 41.9028, lon: 12.4964, radiusKm: 45 },
  { label: 'Milano', lat: 45.4642, lon: 9.19, radiusKm: 40 },
  { label: 'Napoli', lat: 40.8518, lon: 14.2681, radiusKm: 42 },
  { label: 'Torino', lat: 45.0703, lon: 7.6869, radiusKm: 38 },
  { label: 'Firenze', lat: 43.7696, lon: 11.2558, radiusKm: 35 },
  { label: 'Bologna', lat: 44.4949, lon: 11.3426, radiusKm: 35 },
  { label: 'Genova', lat: 44.4056, lon: 8.9463, radiusKm: 35 },
  { label: 'Venezia', lat: 45.4408, lon: 12.3155, radiusKm: 35 },
  { label: 'Bari', lat: 41.1177, lon: 16.8719, radiusKm: 40 },
  { label: 'Verona', lat: 45.4384, lon: 10.9916, radiusKm: 32 },
];

function inferGpsAreaHints(lat: number, lon: number): Pick<GpsData, 'area_hint_it' | 'coarse_region_it'> {
  let best: { label: string; d: number } | null = null;
  for (const c of ITALY_CITY_HINTS) {
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (d <= c.radiusKm && (!best || d < best.d)) {
      best = { label: c.label, d };
    }
  }
  if (best) {
    return {
      area_hint_it: `Probabile zona: ${best.label} (euristica su coordinate)`,
      coarse_region_it: best.label,
    };
  }
  if (lat >= 36.6 && lat <= 38.35 && lon >= 12.3 && lon <= 15.85) {
    return {
      area_hint_it: 'Coordinate in Sicilia (città non riconosciuta dalla tabella locale)',
      coarse_region_it: 'Sicilia',
    };
  }
  if (lat >= 35.5 && lat <= 47.1 && lon >= 6.6 && lon <= 18.5) {
    return {
      area_hint_it: 'Coordinate in Italia (area metropolitana non in tabella)',
      coarse_region_it: 'Italia',
    };
  }
  return { area_hint_it: null, coarse_region_it: null };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function emptyGps(): GpsData {
  return {
    latitude: null,
    longitude: null,
    speed_kmh: null,
    altitude_m: null,
    heading_deg: null,
    accuracy_m: null,
    area_hint_it: null,
    coarse_region_it: null,
  };
}

function emptyImu(): ImuData {
  return {
    acceleration_magnitude: null,
    rotation_rate_deg_s: null,
    magnetic_heading: null,
    pressure_hpa: null,
    estimated_floor: null,
    imu_status: 'module_unavailable',
    imu_status_detail: null,
  };
}

function emptyAudio(overrides?: Partial<Pick<AudioData, 'audio_status' | 'audio_status_detail'>>): AudioData {
  return {
    db_level: null,
    audio_output: null,
    call_state: null,
    system_volume: null,
    audio_scene: null,
    audio_scene_confidence: null,
    voice_activity: null,
    voice_probability: null,
    audio_status: overrides?.audio_status ?? 'module_missing',
    audio_status_detail: overrides?.audio_status_detail ?? null,
  };
}

function emptyBluetooth(): BluetoothData {
  return {
    enabled: false,
    connected_devices: [],
    is_car_audio: false,
    is_headphones: false,
    is_smartwatch: false,
    car_device_name: null,
  };
}

function emptyCalendar(): CalendarData {
  return {
    next_event_minutes: null,
    next_event_title: null,
    next_event_duration_min: null,
    next_event_is_online: false,
    next_event_attendees: null,
    events_in_next_2h: 0,
    currently_in_event: false,
  };
}

function defaultSystem(): SystemData {
  return {
    battery_level: null,
    is_charging: false,
    network_type: 'unknown',
    network_source: 'unavailable',
    wifi_ssid: null,
    app_state: 'active',
    screen_brightness: 0,
    free_memory_mb: 0,
    dark_mode: false,
    device_model: '',
  };
}

function emptyHealth(healthkit_read_status: HealthKitReadRequestLabel = 'unknown'): HealthData {
  return {
    steps_today: null,
    resting_hr_bpm: null,
    hrv_ms: null,
    active_calories: null,
    sleep_hours: null,
    last_workout_type: null,
    last_workout_minutes_ago: null,
    stand_hours_today: null,
    healthkit_read_status,
  };
}

function emptyBehavioral(): BehavioralData {
  return {
    time_since_last_app_open_min: null,
    meals_logged_today: null,
    last_meal_logged_min_ago: null,
    typical_lunch_hour: null,
  };
}

/** Euristica locale: il pacchetto npm @picovoice/react-native-cobra non è su registry; approssimazione da livello sonoro. */
function estimateVoiceFromDb(db: number | null): { voice_probability: number | null; voice_activity: boolean | null } {
  if (db == null || !Number.isFinite(db)) return { voice_probability: null, voice_activity: null };
  const p = Math.min(1, Math.max(0, (db - 32) / 38));
  return { voice_probability: p, voice_activity: p > 0.55 };
}

/** Mappa indice classe YAMNet (521) → scena richiesta; indici da AudioSet/yamnet_class_map. */
function mapYamnetIndexToScene(idx: number): AudioData['audio_scene'] {
  if (idx < 0 || idx > 520) return 'unknown';
  if (idx >= 300 && idx <= 322) return 'traffic';
  if (idx >= 132 && idx <= 270) return 'music';
  if ([378, 380, 381, 500].includes(idx)) return 'office';
  if ([64, 65, 358, 359, 360, 361, 502].includes(idx)) return 'restaurant';
  if (idx === 503 || idx === 504) return 'outdoor';
  if ([277, 278, 288, 289, 321].includes(idx)) return 'outdoor';
  if ([518, 519, 371].includes(idx)) return 'home';
  if ([459, 418, 157].includes(idx)) return 'gym';
  return 'unknown';
}

function pcmChunkToFloat(chunk: Buffer): Float32Array {
  const n = Math.floor(chunk.length / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = chunk.readInt16LE(i * 2) / 32768;
  }
  return out;
}

function concatFloat(a: Float32Array, b: Float32Array, maxLen: number): Float32Array {
  const total = Math.min(a.length + b.length, maxLen);
  const out = new Float32Array(total);
  let o = 0;
  for (let i = 0; i < a.length && o < total; i++) out[o++] = a[i];
  for (let i = 0; i < b.length && o < total; i++) out[o++] = b[i];
  return out;
}

/** Senza questo check, `require('react-native-fast-tflite')` esegue subito `getEnforcing('Tflite')` e può crashare. */
function hasTfliteNativeModule(): boolean {
  try {
    return TurboModuleRegistry.get('Tflite') != null;
  } catch {
    return false;
  }
}

async function ensureYamnetModel(): Promise<TensorflowModel | null> {
  if (yamnetLoadFailed) return null;
  if (yamnetModel) return yamnetModel;
  if (!hasTfliteNativeModule()) {
    yamnetLoadFailed = true;
    return null;
  }

  type LoadFn = (asset: number, delegate: string) => Promise<TensorflowModel>;
  let loadTensorflowModel: LoadFn;
  try {
    loadTensorflowModel = require('react-native-fast-tflite').loadTensorflowModel as LoadFn;
  } catch {
    yamnetLoadFailed = true;
    return null;
  }

  try {
    // Metro deve risolvere .tflite come asset (vedi metro.config.js).
    const asset = require('../../assets/models/yamnet.tflite') as number;
    yamnetModel = await loadTensorflowModel(asset, Platform.OS === 'ios' ? 'core-ml' : 'default');
  } catch {
    try {
      const asset = require('../../assets/models/yamnet.tflite') as number;
      yamnetModel = await loadTensorflowModel(asset, 'default');
    } catch {
      yamnetLoadFailed = true;
      return null;
    }
  }
  return yamnetModel;
}

function argmaxScores(scores: Float32Array | Int32Array | Int8Array | Uint8Array | Float64Array): { idx: number; conf: number } {
  let max = -Infinity;
  let idx = 0;
  for (let i = 0; i < scores.length; i++) {
    const v = scores[i];
    if (typeof v === 'number' && v > max) {
      max = v;
      idx = i;
    }
  }
  const conf = Number.isFinite(max) && max > 0 ? Math.min(1, max) : 0;
  return { idx, conf };
}

async function runYamnetScene(waveform: Float32Array): Promise<{ scene: AudioData['audio_scene']; conf: number }> {
  const model = await ensureYamnetModel();
  if (!model || waveform.length < 8) return { scene: 'unknown', conf: 0 };
  try {
    const inputTensor = model.inputs[0];
    const shape = inputTensor.shape;
    let input: Float32Array;
    if (shape.length === 1) {
      const need = shape[0];
      input = new Float32Array(need);
      for (let i = 0; i < need; i++) input[i] = waveform[i] ?? 0;
    } else if (shape.length === 2) {
      const need = shape[1] ?? waveform.length;
      input = new Float32Array(need);
      for (let i = 0; i < need; i++) input[i] = waveform[i] ?? 0;
    } else {
      input = waveform;
    }
    const outs = await model.run([input]);
    if (!outs.length) return { scene: 'unknown', conf: 0 };
    const scores = outs[outs.length - 1];
    const { idx, conf } = argmaxScores(scores as Float32Array);
    return { scene: mapYamnetIndexToScene(idx), conf };
  } catch {
    return { scene: 'unknown', conf: 0 };
  }
}

function getBle(): BleManager {
  if (!bleManager) bleManager = new BleManager();
  return bleManager;
}

/** `Geolocation.native.js` fa `new NativeEventEmitter(RNFusedLocation)` al load: require solo se il modulo nativo c'è. */
function getGeolocationModule(): {
  getCurrentPosition: (
    success: (pos: {
      coords: {
        latitude: number;
        longitude: number;
        speed: number | null;
        altitude: number | null;
        heading: number | null;
        accuracy: number | null;
      };
    }) => void,
    error?: (e: unknown) => void,
    options?: Record<string, unknown>,
  ) => void;
} | null {
  const nm = NativeModules as { RNFusedLocation?: unknown };
  if (!nm.RNFusedLocation) return null;
  try {
    return require('react-native-geolocation-service').default;
  } catch {
    return null;
  }
}

type AudioRecordModule = {
  init: (options: Record<string, unknown>) => void;
  start: () => void;
  stop: () => void;
  on: (event: string, callback: (data: string) => void) => { remove: () => void } | void;
};

/** `index.js` del pacchetto fa `new NativeEventEmitter(RNAudioRecord)` al load. */
function getAudioRecordModule(): AudioRecordModule | null {
  const nm = NativeModules as { RNAudioRecord?: unknown };
  if (!nm.RNAudioRecord) return null;
  try {
    return require('react-native-audio-record').default as AudioRecordModule;
  } catch {
    return null;
  }
}

type SystemSettingModule = {
  getBrightness: () => Promise<number>;
  getVolume: (kind: string) => Promise<number>;
};

/** `SystemSetting.js` fa `new NativeEventEmitter(SystemSettingNative)` al load. */
function getSystemSettingModule(): SystemSettingModule | null {
  const nm = NativeModules as { SystemSetting?: unknown };
  if (!nm.SystemSetting) return null;
  try {
    return require('react-native-system-setting').default as SystemSettingModule;
  } catch {
    return null;
  }
}

async function collectGps(): Promise<GpsData> {
  const empty = emptyGps();
  const Geolocation = getGeolocationModule();
  if (!Geolocation) return empty;
  try {
    return await new Promise<GpsData>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos) => {
          const s = pos.coords.speed;
          const speedKmh =
            s != null && Number.isFinite(s) && s >= 0 ? s * 3.6 : s != null && Number.isFinite(s) ? Math.abs(s) * 3.6 : null;
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const hints = inferGpsAreaHints(lat, lon);
          resolve({
            latitude: lat,
            longitude: lon,
            speed_kmh: speedKmh,
            altitude_m: pos.coords.altitude ?? null,
            heading_deg: pos.coords.heading ?? null,
            accuracy_m: pos.coords.accuracy ?? null,
            ...hints,
          });
        },
        (e) => reject(e),
        {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: GPS_TIMEOUT_MS - 200,
          forceRequestLocation: true,
          showLocationDialog: true,
        },
      );
    });
  } catch {
    return empty;
  }
}

async function collectImu(): Promise<ImuData> {
  const baseEmpty = emptyImu();

  if (!rnAccelerometer || !rnSetUpdateIntervalForType || !rnSensorTypes) {
    return {
      ...baseEmpty,
      imu_status: 'module_unavailable',
      imu_status_detail: 'react-native-sensors non disponibile o non linkato',
    };
  }

  try {
    try {
      rnSetUpdateIntervalForType(rnSensorTypes.accelerometer, 40);
      rnSetUpdateIntervalForType(rnSensorTypes.gyroscope, 40);
      rnSetUpdateIntervalForType(rnSensorTypes.magnetometer, 40);
      rnSetUpdateIntervalForType(rnSensorTypes.barometer, 200);
    } catch {
      /* sensor init */
    }

    let maxAcc = 0;
    let maxGyroRad = 0;
    let heading: number | null = null;
    let pressure: number | null = null;
    const subs: Array<{ unsubscribe: () => void }> = [];
    const deadline = Date.now() + 450;

    const noopSensorError = (): void => {
      /* Simulatore / hardware assente: l'observable emette error; senza handler va su console globale. */
    };

    try {
      subs.push(
        rnAccelerometer.subscribe({
          next: ({ x, y, z }: { x: number; y: number; z: number }) => {
            const m = Math.sqrt(x * x + y * y + z * z);
            if (m > maxAcc) maxAcc = m;
          },
          error: noopSensorError,
        }),
      );
      subs.push(
        rnGyroscope.subscribe({
          next: ({ x, y, z }: { x: number; y: number; z: number }) => {
            const m = Math.sqrt(x * x + y * y + z * z);
            if (m > maxGyroRad) maxGyroRad = m;
          },
          error: noopSensorError,
        }),
      );
      subs.push(
        rnMagnetometer.subscribe({
          next: ({ x, y }: { x: number; y: number }) => {
            const h = (radToDeg(Math.atan2(y, x)) + 360) % 360;
            heading = h;
          },
          error: noopSensorError,
        }),
      );
      subs.push(
        rnBarometer.subscribe({
          next: ({ pressure: p }: { pressure: number }) => {
            if (typeof p === 'number' && Number.isFinite(p)) pressure = p;
          },
          error: noopSensorError,
        }),
      );

      await new Promise<void>((r) => {
        const t = setInterval(() => {
          if (Date.now() >= deadline) {
            clearInterval(t);
            r();
          }
        }, 50);
      });
    } catch {
      /* ignore */
    } finally {
      for (const s of subs) {
        try {
          s.unsubscribe();
        } catch {
          /* ignore */
        }
      }
    }

    let floor: number | null = null;
    if (pressure != null) {
      if (refPressureHpa == null) refPressureHpa = pressure;
      else {
        const delta = refPressureHpa - pressure;
        floor = Math.round(delta / 3);
      }
    }

    const hasAnySample =
      maxAcc > 0 ||
      maxGyroRad > 0 ||
      heading != null ||
      (pressure != null && Number.isFinite(pressure));
    return {
      acceleration_magnitude: maxAcc > 0 ? maxAcc : null,
      rotation_rate_deg_s: maxGyroRad > 0 ? radToDeg(maxGyroRad) : null,
      magnetic_heading: heading,
      pressure_hpa: pressure,
      estimated_floor: floor,
      imu_status: hasAnySample ? 'ok' : 'no_samples',
      imu_status_detail: hasAnySample ? null : 'nessun campione nella finestra (~450ms); verifica permesso Motion e device fisico',
    };
  } catch (e) {
    return {
      ...baseEmpty,
      imu_status: 'error',
      imu_status_detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function collectAudio(): Promise<AudioData> {
  /* Stato chiamate: react-native-call-detection non è compatibile con RN recente (BatchedBridge.registerCallableModule). */

  const AudioRecord = getAudioRecordModule();
  if (!AudioRecord) {
    return emptyAudio({
      audio_status: 'module_missing',
      audio_status_detail: 'modulo RNAudioRecord assente dal binary',
    });
  }

  let dbLevel: number | null = null;
  const chunks: Buffer[] = [];
  let rmsAcc = 0;
  let rmsN = 0;
  let captureError: string | null = null;

  try {
    AudioRecord.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      wavFile: 'sensor_bundle_meter.wav',
    });
  } catch (e) {
    return emptyAudio({
      audio_status: 'init_failed',
      audio_status_detail: e instanceof Error ? e.message : String(e),
    });
  }

  let dataSub: { remove: () => void } | null = null;
  try {
    const sub = AudioRecord.on('data', (data: string) => {
      try {
        const buf = Buffer.from(data, 'base64');
        chunks.push(buf);
        const f = pcmChunkToFloat(buf);
        for (let i = 0; i < f.length; i++) {
          rmsAcc += f[i] * f[i];
          rmsN++;
        }
      } catch {
        /* ignore */
      }
    }) as { remove: () => void } | void;
    dataSub = sub && typeof sub === 'object' && 'remove' in sub ? sub : null;
    AudioRecord.start();
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 420));
  } catch (e) {
    captureError = e instanceof Error ? e.message : String(e);
  } finally {
    try {
      AudioRecord.stop();
    } catch {
      /* ignore */
    }
    try {
      dataSub?.remove();
    } catch {
      /* ignore */
    }
  }

  if (rmsN > 0) {
    const rms = Math.sqrt(rmsAcc / rmsN);
    const db = 20 * Math.log10(rms + 1e-10) + 90;
    dbLevel = Number.isFinite(db) ? db : null;
  }

  let vol: number | null = null;
  try {
    const SS = getSystemSettingModule();
    if (SS) {
      const v = await SS.getVolume('music');
      vol = typeof v === 'number' && v >= 0 ? Math.min(1, v) : null;
    }
  } catch {
    vol = null;
  }

  let waveform: Float32Array = new Float32Array(0);
  for (const c of chunks) {
    const f = pcmChunkToFloat(c);
    waveform = concatFloat(waveform, f, 16000);
  }
  const targetLen = 15600;
  if (waveform.length < targetLen) {
    const padded = new Float32Array(targetLen);
    for (let i = 0; i < waveform.length; i++) padded[i] = waveform[i];
    waveform = padded;
  } else if (waveform.length > targetLen) {
    waveform = Float32Array.from(waveform.subarray(0, targetLen));
  }

  const yam = await runYamnetScene(waveform);
  const { voice_probability, voice_activity } = estimateVoiceFromDb(dbLevel);

  let audio_status: AudioCollectionStatus;
  let audio_status_detail: string | null;
  if (rmsN > 0) {
    audio_status = 'ok';
    audio_status_detail = null;
  } else if (captureError) {
    audio_status = 'capture_failed';
    audio_status_detail = captureError;
  } else {
    audio_status = 'no_mic_data';
    audio_status_detail = 'nessun campione PCM nella finestra; verifica permesso microfono';
  }

  return {
    db_level: dbLevel,
    audio_output: null,
    call_state: null,
    system_volume: vol,
    audio_scene: yam.scene,
    audio_scene_confidence: yam.conf > 0 ? yam.conf : null,
    voice_activity,
    voice_probability,
    audio_status,
    audio_status_detail,
  };
}

async function collectBluetooth(): Promise<BluetoothData> {
  const empty = emptyBluetooth();
  try {
    const mgr = getBle();
    const on = await mgr.state().then((s) => s === 'PoweredOn');
    if (!on) return { ...empty, enabled: false };

    let devices: Array<{ name: string; id: string }> = [];
    try {
      const connected = await mgr.connectedDevices([]);
      devices = connected.map((d) => ({
        name: d.name ?? d.localName ?? 'device',
        id: d.id,
      }));
    } catch {
      try {
        const connected = await mgr.connectedDevices(['0000180f-0000-1000-8000-00805f9b34fb']);
        devices = connected.map((d) => ({
          name: d.name ?? d.localName ?? 'device',
          id: d.id,
        }));
      } catch {
        devices = [];
      }
    }

    let car = false;
    let hp = false;
    let watch = false;
    let carName: string | null = null;
    for (const d of devices) {
      const n = d.name;
      if (CAR_RX.test(n)) {
        car = true;
        carName = n;
      }
      if (HP_RX.test(n)) hp = true;
      if (WATCH_RX.test(n)) watch = true;
    }

    return {
      enabled: true,
      connected_devices: devices,
      is_car_audio: car,
      is_headphones: hp,
      is_smartwatch: watch,
      car_device_name: carName,
    };
  } catch {
    return empty;
  }
}

const ONLINE_RX = /zoom|meet|teams|webex|google meet|skype/i;

async function collectCalendar(): Promise<CalendarData> {
  const empty = emptyCalendar();
  try {
    const st = await CalendarEvents.requestPermissions();
    if (st !== 'authorized') return empty;

    const now = new Date();
    const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const events = await CalendarEvents.fetchAllEvents(now.toISOString(), end.toISOString());

    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    let eventsNext2h = 0;
    for (const e of events) {
      if (!e.startDate) continue;
      const sd = new Date(e.startDate);
      if (sd >= now && sd <= in2h) eventsNext2h++;
    }

    const future = events
      .filter((e) => Boolean(e.startDate && e.endDate))
      .map((e) => ({ e, start: new Date(e.startDate as string).getTime() }))
      .filter(({ start }) => start > now.getTime())
      .sort((a, b) => a.start - b.start);

    let next_event_minutes: number | null = null;
    let next_event_title: string | null = null;
    let next_event_duration_min: number | null = null;
    let next_event_is_online = false;
    let next_event_attendees: number | null = null;

    if (future.length) {
      const first = future[0].e;
      if (!first.startDate || !first.endDate) {
        /* skip incomplete event */
      } else {
      const start = new Date(first.startDate);
      next_event_minutes = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
      next_event_title = first.title ?? null;
      const endDt = new Date(first.endDate);
      next_event_duration_min = Math.max(0, Math.round((endDt.getTime() - start.getTime()) / 60000));
      const t = `${first.title ?? ''}`;
      next_event_is_online = ONLINE_RX.test(t);
      next_event_attendees = Array.isArray(first.attendees) ? first.attendees.length : null;
      }
    }

    let currently_in_event = false;
    for (const e of events) {
      if (!e.startDate || !e.endDate) continue;
      const s = new Date(e.startDate).getTime();
      const ed = new Date(e.endDate).getTime();
      if (now.getTime() >= s && now.getTime() <= ed) {
        currently_in_event = true;
        break;
      }
    }

    return {
      next_event_minutes,
      next_event_title,
      next_event_duration_min,
      next_event_is_online,
      next_event_attendees,
      events_in_next_2h: eventsNext2h,
      currently_in_event,
    };
  } catch {
    return empty;
  }
}

/** Evita import statico: se `RNCNetInfo` non è nel binary, il modulo lancia al load. */
async function fetchNetInfoState(): Promise<{ type: string; details: unknown } | null> {
  const nm = NativeModules as { RNCNetInfo?: unknown };
  if (!nm.RNCNetInfo) return null;
  try {
    const NetInfo = require('@react-native-community/netinfo').default as {
      fetch: () => Promise<{ type: string; details: unknown }>;
    };
    return await NetInfo.fetch();
  } catch {
    return null;
  }
}

async function collectSystem(): Promise<SystemData> {
  const d = defaultSystem();
  try {
    // `react-native-system-setting` (pod RCTSystemSetting / SystemSetting). Senza dipendenza nativa, SS è null → sempre 0.
    const brightnessP = (() => {
      const SS = getSystemSettingModule();
      return SS ? SS.getBrightness().catch(() => 0) : Promise.resolve(0);
    })();
    const [level, charging, netState, brightness, totalM, usedM, model] = await Promise.all([
      DeviceInfo.getBatteryLevel(),
      DeviceInfo.isBatteryCharging(),
      fetchNetInfoState(),
      brightnessP,
      DeviceInfo.getTotalMemory(),
      DeviceInfo.getUsedMemory(),
      DeviceInfo.getModel(),
    ]);

    const nm = NativeModules as { RNCNetInfo?: unknown };
    const netModuleOk = nm.RNCNetInfo != null;
    let network_type: SystemData['network_type'];
    let network_source: SystemData['network_source'];
    let ssid: string | null = null;

    if (!netModuleOk || netState == null) {
      network_type = 'unknown';
      network_source = 'unavailable';
    } else {
      network_source = 'netinfo';
      const type = String(netState.type ?? '').toLowerCase();
      if (type === 'wifi') network_type = 'wifi';
      else if (type === 'cellular') network_type = 'cellular';
      else if (type === 'none') network_type = 'none';
      else network_type = 'unknown';
      try {
        const di = netState.details as { ssid?: string } | null;
        if (di && typeof di.ssid === 'string') ssid = di.ssid;
      } catch {
        ssid = null;
      }
    }

    let battery_level: number | null = null;
    if (typeof level === 'number' && Number.isFinite(level) && level >= 0 && level <= 1) {
      battery_level = Math.round(Math.min(100, Math.max(0, level * 100)));
    }

    const as = AppState.currentState;
    const app_state: SystemData['app_state'] =
      as === 'background' || as === 'active' || as === 'inactive' ? as : 'active';

    const freeMb = (totalM - usedM) / (1024 * 1024);

    return {
      battery_level,
      is_charging: charging,
      network_type,
      network_source,
      wifi_ssid: ssid,
      app_state,
      screen_brightness: typeof brightness === 'number' ? Math.min(1, Math.max(0, brightness)) : 0,
      free_memory_mb: Number.isFinite(freeMb) ? freeMb : 0,
      dark_mode: Appearance.getColorScheme() === 'dark',
      device_model: model,
    };
  } catch {
    return d;
  }
}

async function collectHealth(): Promise<HealthData> {
  let hk: HealthKitReadRequestLabel = 'unknown';
  try {
    hk = await getHealthKitReadRequestLabel();
  } catch {
    hk = 'unknown';
  }
  const fallback = emptyHealth(hk);
  try {
    if (Platform.OS !== 'ios') return fallback;
    const s = await fetchAppleHealthSnapshotCached();
    return {
      steps_today: s.stepsToday,
      resting_hr_bpm: s.restingHeartRateBpm,
      hrv_ms: s.hrvSdnnMs,
      active_calories: s.activeEnergyKcalToday,
      sleep_hours: s.sleepAsleepHoursRecent,
      last_workout_type: null,
      last_workout_minutes_ago: null,
      stand_hours_today: null,
      healthkit_read_status: hk,
    };
  } catch {
    return fallback;
  }
}

const TIME_OF_DAY_IT: Record<TemporalData['time_of_day'], string> = {
  night: 'notte',
  morning: 'mattina',
  lunch: 'pranzo',
  afternoon: 'pomeriggio',
  dinner: 'cena',
  evening: 'sera',
};

function collectTemporal(): TemporalData {
  const d = new Date();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const day = d.getDay();
  const isWeekend = day === 0 || day === 6;

  let time_of_day: TemporalData['time_of_day'] = 'morning';
  if (hour >= 23 || hour < 5) time_of_day = 'night';
  else if (hour < 11) time_of_day = 'morning';
  else if (hour < 14) time_of_day = 'lunch';
  else if (hour < 17) time_of_day = 'afternoon';
  else if (hour < 20) time_of_day = 'dinner';
  else time_of_day = 'evening';

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const time_of_day_it = TIME_OF_DAY_IT[time_of_day];
  const local_time_label_it = `${hh}:${mm}, ${time_of_day_it}`;

  return {
    hour,
    minute,
    day_of_week: day,
    is_weekend: isWeekend,
    time_of_day,
    time_of_day_it,
    local_time_label_it,
    timestamp_iso: d.toISOString(),
  };
}

async function collectBehavioral(): Promise<BehavioralData> {
  const empty = emptyBehavioral();
  try {
    const now = Date.now();
    const [lastFgRaw, mealsRaw, lastMealRaw, lunchRaw] = await Promise.all([
      AsyncStorage.getItem(AS_LAST_FOREGROUND_AT),
      AsyncStorage.getItem(AS_MEALS_LOGGED_TODAY),
      AsyncStorage.getItem(AS_LAST_MEAL_AT),
      AsyncStorage.getItem(AS_TYPICAL_LUNCH_HOUR),
    ]);

    const lastFgMs = lastFgRaw ? Number(lastFgRaw) : NaN;
    const timeSinceOpen =
      Number.isFinite(lastFgMs) ? Math.max(0, (now - lastFgMs) / 60000) : null;

    let mealsLogged: number | null = null;
    if (mealsRaw != null && mealsRaw !== '') {
      const n = Number(mealsRaw);
      mealsLogged = Number.isFinite(n) ? n : null;
    }

    let lastMealMin: number | null = null;
    if (lastMealRaw != null && lastMealRaw !== '') {
      const t = Number(lastMealRaw);
      if (Number.isFinite(t)) lastMealMin = Math.max(0, (now - t) / 60000);
    }

    let typicalLunch: number | null = null;
    const lh = lunchRaw;
    if (lh != null && lh !== '') {
      const n = Number(lh);
      typicalLunch = Number.isFinite(n) ? n : null;
    }

    return {
      time_since_last_app_open_min: timeSinceOpen,
      meals_logged_today: mealsLogged,
      last_meal_logged_min_ago: lastMealMin,
      typical_lunch_hour: typicalLunch,
    };
  } catch {
    return empty;
  }
}

/** LLM spesso emette camelCase; accetta alias comuni. */
function pickContextField(o: Record<string, unknown>, snake: string, ...camelAliases: string[]): unknown {
  if (Object.prototype.hasOwnProperty.call(o, snake)) return o[snake];
  for (const k of camelAliases) {
    if (Object.prototype.hasOwnProperty.call(o, k)) return o[k];
  }
  return undefined;
}

export function parseContextStateFromHammerText(raw: string): ContextState | null {
  let t = raw.trim();
  const start = t.indexOf('{');
  if (start < 0) return null;
  t = t.slice(start);
  if (!t.endsWith('}')) t += '}';
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const keyInsightRaw = pickContextField(o, 'key_insight', 'keyInsight', 'insight', 'summary');
    const interventionRaw = pickContextField(o, 'intervention_reason', 'interventionReason');
    const mealRaw = pickContextField(o, 'meal_window', 'mealWindow');
    const interveneRaw = pickContextField(o, 'should_intervene', 'shouldIntervene');
    return {
      context: pickContextField(o, 'context') as ContextState['context'],
      available: pickContextField(o, 'available') as ContextState['available'],
      stress_level: pickContextField(o, 'stress_level', 'stressLevel') as ContextState['stress_level'],
      meal_window: Boolean(mealRaw),
      physical_state: pickContextField(o, 'physical_state', 'physicalState') as ContextState['physical_state'],
      social_context: pickContextField(o, 'social_context', 'socialContext') as ContextState['social_context'],
      key_insight: keyInsightRaw == null ? '' : String(keyInsightRaw),
      should_intervene: Boolean(interveneRaw),
      intervention_reason: interventionRaw == null ? null : String(interventionRaw),
      confidence:
        typeof o.confidence === 'number'
          ? o.confidence
          : Number(pickContextField(o, 'confidence')) || 0,
    };
  } catch {
    return null;
  }
}

// ── Esportazioni pubbliche ─────────────────────────────────────────────────

export type InitSensorBundleOptions = {
  /** Modello incluso nel bundle Metro (`require(...).toString()` o path numerico asset). */
  isModelAsset?: boolean;
  /** Chiudi contesto esistente e ricarica (es. dopo cambio path in AsyncStorage). */
  forceReinit?: boolean;
};

export function isLlmContextReady(): boolean {
  return llamaCtx != null;
}

export async function clearSensorBundleLlm(): Promise<void> {
  if (!llamaCtx) return;
  try {
    await llamaCtx.release();
  } catch {
    /* ignore */
  }
  llamaCtx = null;
}

export async function initSensorBundle(
  modelPath: string,
  options?: InitSensorBundleOptions,
): Promise<void> {
  if (!modelPath?.trim()) return;
  if (llamaCtx && !options?.forceReinit) return;
  if (llamaCtx && options?.forceReinit) {
    try {
      await llamaCtx.release();
    } catch {
      /* ignore */
    }
    llamaCtx = null;
  }
  try {
    llamaCtx = await initLlama({
      model: modelPath.trim(),
      is_model_asset: options?.isModelAsset ?? false,
      n_ctx: 512,
      n_threads: 4,
      n_gpu_layers: 1,
    });
    if (__DEV__) {
      console.log('[SensorBundle] LLM inizializzato');
    }
  } catch {
    llamaCtx = null;
  }
}

/** Evita due raccolte in parallelo (mic/BLE/sensori + LLM sul device → crash o dati vuoti). */
let collectRawBundleInFlight: Promise<RawSensorBundle> | null = null;
let collectRawBundleLiteInFlight: Promise<RawSensorBundle> | null = null;

type CollectBundleMode = { /** Salta mic + YAMNet: uso per tick live (meno crash iOS). */ skipAudio: boolean };

async function collectRawBundleImpl(mode: CollectBundleMode): Promise<RawSensorBundle> {
  const audioP = mode.skipAudio
    ? Promise.resolve(
        emptyAudio({
          audio_status: 'skipped',
          audio_status_detail: 'modalità lite: microfono e YAMNet non richiesti',
        }),
      )
    : withTimeout(collectAudio(), COLLECTOR_TIMEOUT_MS, 'audio');

  const settled = await Promise.allSettled([
    withTimeout(collectGps(), GPS_TIMEOUT_MS, 'gps'),
    withTimeout(collectImu(), COLLECTOR_TIMEOUT_MS, 'imu'),
    audioP,
    withTimeout(collectBluetooth(), COLLECTOR_TIMEOUT_MS, 'bt'),
    withTimeout(collectCalendar(), COLLECTOR_TIMEOUT_MS, 'cal'),
    withTimeout(collectSystem(), COLLECTOR_TIMEOUT_MS, 'sys'),
    withTimeout(collectHealth(), COLLECTOR_TIMEOUT_MS, 'health'),
    Promise.resolve(collectTemporal()),
    withTimeout(collectBehavioral(), COLLECTOR_TIMEOUT_MS, 'behav'),
  ]);

  const gps = settled[0].status === 'fulfilled' ? settled[0].value : emptyGps();
  const imu = settled[1].status === 'fulfilled' ? settled[1].value : emptyImu();
  const audio = settled[2].status === 'fulfilled' ? settled[2].value : emptyAudio();
  const bluetooth = settled[3].status === 'fulfilled' ? settled[3].value : emptyBluetooth();
  const calendar = settled[4].status === 'fulfilled' ? settled[4].value : emptyCalendar();
  const system = settled[5].status === 'fulfilled' ? settled[5].value : defaultSystem();
  const health = settled[6].status === 'fulfilled' ? settled[6].value : emptyHealth();
  const temporal = settled[7].status === 'fulfilled' ? settled[7].value : collectTemporal();
  const behavioral = settled[8].status === 'fulfilled' ? settled[8].value : emptyBehavioral();

  const bundle: RawSensorBundle = {
    gps,
    imu,
    audio,
    bluetooth,
    calendar,
    system,
    health,
    temporal,
    behavioral,
  };

  return bundle;
}

/** Raccolta completa (include audio / livello sonoro e YAMNet se disponibili). */
export async function collectRawBundle(): Promise<RawSensorBundle> {
  if (!collectRawBundleInFlight) {
    collectRawBundleInFlight = collectRawBundleImpl({ skipAudio: false }).finally(() => {
      collectRawBundleInFlight = null;
    });
  }
  return collectRawBundleInFlight;
}

/**
 * Stesso schema di `collectRawBundle` ma senza toccare il microfono né TFLite (tick UI frequenti).
 * Riduce crash nativi su iOS quando il live è attivo.
 */
export async function collectRawBundleLite(): Promise<RawSensorBundle> {
  if (!collectRawBundleLiteInFlight) {
    collectRawBundleLiteInFlight = collectRawBundleImpl({ skipAudio: true }).finally(() => {
      collectRawBundleLiteInFlight = null;
    });
  }
  return collectRawBundleLiteInFlight;
}

/**
 * Fallback deterministico quando ExecuTorch / LLM non è disponibile.
 */
export function fuseContextWithRules(bundle: RawSensorBundle): ContextState {
  const { gps, bluetooth, calendar, audio, health, system, temporal } = bundle;

  let context: ContextState['context'] = 'unknown';
  let available: ContextState['available'] = 'yes';
  let stress_level: ContextState['stress_level'] = 'low';
  let meal_window = false;
  let physical_state: ContextState['physical_state'] = 'sedentary';
  let social_context: ContextState['social_context'] = 'unknown';
  // should_intervene: false di default, true solo se c'è motivo predittivo concreto
  let should_intervene = false;
  let intervention_reason: string | null = null;

  const speed = gps.speed_kmh ?? 0;

  if (speed > 20 || bluetooth.is_car_audio) {
    context = 'driving';
    available = 'no';
  } else if (
    calendar.currently_in_event ||
    (calendar.next_event_minutes != null && calendar.next_event_minutes < 15)
  ) {
    context = 'meeting';
    available = 'no';
    social_context = 'in_meeting';
  } else if (
    audio.audio_scene === 'restaurant' &&
    (temporal.time_of_day === 'lunch' || temporal.time_of_day === 'dinner')
  ) {
    context = 'restaurant';
  } else if (audio.audio_scene === 'gym') {
    context = 'gym';
  }

  if ((health.hrv_ms != null && health.hrv_ms < 30) || (health.resting_hr_bpm != null && health.resting_hr_bpm > 90)) {
    stress_level = 'high';
  } else if (health.sleep_hours != null && health.sleep_hours < 6) {
    stress_level = 'medium';
  }

  if (health.last_workout_minutes_ago != null && health.last_workout_minutes_ago < 60) {
    physical_state = 'post_workout';
  }

  if (temporal.time_of_day === 'lunch' || temporal.time_of_day === 'dinner') {
    meal_window = true;
  }

  const batteryCritical = system.battery_level != null && system.battery_level < 15;

  if (!batteryCritical) {
    // 1. Finestra pasto imminente + utente disponibile
    if (meal_window && context !== 'driving' && context !== 'meeting') {
      should_intervene = true;
      intervention_reason = `Sono le ${temporal.local_time_label_it} — momento pasto`;
    }

    // 2. Troppo tempo dall'ultimo pasto (> 5 ore)
    if (
      bundle.behavioral.last_meal_logged_min_ago != null &&
      bundle.behavioral.last_meal_logged_min_ago > 300
    ) {
      should_intervene = true;
      intervention_reason = `Non mangi da ${Math.round(bundle.behavioral.last_meal_logged_min_ago / 60)} ore`;
    }

    // 3. Vicino all'ora tipica di pranzo dell'utente (± 20 min)
    if (bundle.behavioral.typical_lunch_hour != null) {
      const diffMin = Math.abs(
        temporal.hour * 60 + temporal.minute - bundle.behavioral.typical_lunch_hour * 60,
      );
      if (diffMin <= 20 && context !== 'driving' && context !== 'meeting') {
        should_intervene = true;
        intervention_reason = `Di solito pranzi intorno a quest'ora`;
      }
    }
  }

  const key_insight =
    context === 'unknown'
      ? 'contesto non determinato dalle regole'
      : `Contesto ${context}, disponibilità ${available}`;

  return {
    context,
    available,
    stress_level,
    meal_window,
    physical_state,
    social_context,
    key_insight: key_insight.slice(0, 120),
    should_intervene,
    intervention_reason,
    confidence: 0.5,
  };
}

/**
 * Payload ridotto per ExecuTorch: il bundle grezzo completo satura il contesto e tronca la risposta a metà frase.
 */
export function compactSensorBundleForLlm(bundle: RawSensorBundle): {
  inferred: ContextState;
  snapshot: Record<string, unknown>;
} {
  const inferred = fuseContextWithRules(bundle);
  const devNames = bundle.bluetooth.connected_devices
    .slice(0, 4)
    .map((d) => (d.name && d.name.length > 36 ? `${d.name.slice(0, 33)}…` : d.name ?? ''));
  return {
    inferred,
    snapshot: {
      temporal: bundle.temporal,
      system: {
        battery: bundle.system.battery_level,
        charging: bundle.system.is_charging,
        network: bundle.system.network_type,
        network_source: bundle.system.network_source,
        app_state: bundle.system.app_state,
        brightness: bundle.system.screen_brightness,
      },
      gps:
        bundle.gps.latitude != null && bundle.gps.longitude != null
          ? {
              lat: Math.round(bundle.gps.latitude * 1e4) / 1e4,
              lon: Math.round(bundle.gps.longitude * 1e4) / 1e4,
              speed_kmh: bundle.gps.speed_kmh,
              accuracy_m: bundle.gps.accuracy_m,
              area_hint_it: bundle.gps.area_hint_it,
              coarse_region_it: bundle.gps.coarse_region_it,
            }
          : null,
      imu: {
        acceleration_magnitude: bundle.imu.acceleration_magnitude,
        rotation_rate_deg_s: bundle.imu.rotation_rate_deg_s,
        pressure_hpa: bundle.imu.pressure_hpa,
        imu_status: bundle.imu.imu_status,
        imu_status_detail: bundle.imu.imu_status_detail,
      },
      audio: {
        db_level: bundle.audio.db_level,
        audio_scene: bundle.audio.audio_scene,
        audio_output: bundle.audio.audio_output,
        voice_activity: bundle.audio.voice_activity,
        audio_status: bundle.audio.audio_status,
        audio_status_detail: bundle.audio.audio_status_detail,
      },
      bluetooth: {
        enabled: bundle.bluetooth.enabled,
        is_car_audio: bundle.bluetooth.is_car_audio,
        is_headphones: bundle.bluetooth.is_headphones,
        device_names_sample: devNames,
      },
      calendar: {
        currently_in_event: bundle.calendar.currently_in_event,
        next_event_minutes: bundle.calendar.next_event_minutes,
        next_event_title: bundle.calendar.next_event_title
          ? bundle.calendar.next_event_title.slice(0, 80)
          : null,
        events_in_next_2h: bundle.calendar.events_in_next_2h,
      },
      health: {
        steps_today: bundle.health.steps_today,
        resting_hr_bpm: bundle.health.resting_hr_bpm,
        hrv_ms: bundle.health.hrv_ms,
        sleep_hours: bundle.health.sleep_hours,
        last_workout_minutes_ago: bundle.health.last_workout_minutes_ago,
        healthkit_read_status: bundle.health.healthkit_read_status,
      },
      behavioral: bundle.behavioral,
    },
  };
}

/**
 * Fonde i segnali grezzi in un ContextState semantico.
 * Se llm non è pronto → fallback a regole deterministiche.
 * Mai lancia eccezioni verso l'esterno.
 */
export async function fuseContext(
  bundle: RawSensorBundle,
  llm?: LLMType | null,
): Promise<ContextState> {
  if (!llm || !llm.isReady) {
    if (__DEV__) console.log('[SensorBundle] LLM non pronto → regole');
    return fuseContextWithRules(bundle);
  }

  try {
    const bundleJson = JSON.stringify(bundle);

    const response = await withTimeout(
      llm.generate([
        {
          role: 'system',
          content: `Sei un sensore contestuale per un'app di nutrizione.
Ricevi dati grezzi dal telefono dell'utente.
Restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo,
senza markdown, senza spiegazioni. Inizia con { e finisci con }.

Regole di inferenza:
- speed_kmh > 20 OR bluetooth.is_car_audio=true → context: driving, available: no
- calendar.currently_in_event=true OR next_event_minutes < 15 → context: meeting, available: no
- audio.audio_scene=restaurant AND time_of_day in [lunch,dinner] → context: restaurant, meal_window: true
- health.hrv_ms < 30 OR resting_hr_bpm > 90 → stress_level: high
- health.sleep_hours < 6 → stress_level: medium (minimo)
- health.last_workout_minutes_ago < 60 → physical_state: post_workout
- system.battery_level not null and < 15 → should_intervene: false sempre
- time_of_day in [lunch,dinner] → meal_window: true

JSON richiesto (tutti i campi, nessuno aggiuntivo):
{
  "context": "driving|restaurant|gym|office|home|commuting|meeting|resting|unknown",
  "available": "yes|partial|no",
  "stress_level": "low|medium|high",
  "meal_window": true_o_false,
  "physical_state": "sedentary|light_activity|post_workout|exercising",
  "social_context": "alone|with_others|in_meeting|unknown",
  "key_insight": "max 15 parole in italiano",
  "should_intervene": true_o_false,
  "intervention_reason": "stringa oppure null",
  "confidence": 0.0-1.0
}`,
        },
        {
          role: 'user',
          content: bundleJson,
        },
      ]),
      LLM_INFERENCE_TIMEOUT_MS,
      'llm',
    );

    const start = response.indexOf('{');
    const end = response.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('JSON non trovato');

    const parsed = parseContextStateFromHammerText(response.slice(start, end + 1));
    if (parsed) {
      if (__DEV__) console.log('[SensorBundle] context LLM:', parsed);
      return parsed;
    }
    throw new Error('parse contesto fallito');
  } catch (e) {
    if (__DEV__) console.warn('[SensorBundle] LLM fallito → regole:', e);
    return fuseContextWithRules(bundle);
  }
}

function commitDebugSnapshot(snapshot: SensorBundleDebugSnapshot): void {
  lastSensorBundleDebug = snapshot;
  if (__DEV__) {
    console.log('[SensorBundle]', JSON.stringify(snapshot, null, 2));
  }
}

/** Snapshot in background: non usa l'LLM (solo regole) per evitare `generate` concorrente sullo stesso modello. */
export async function collectAndSend(_llm?: LLMType | null): Promise<ContextState | null> {
  try {
    const bundle = await collectRawBundle();

    let ctx: ContextState = fuseContextWithRules(bundle);
    const fuseError: string | null = null;

    const collectedAt = new Date().toISOString();
    commitDebugSnapshot({
      collectedAt,
      raw: bundle,
      context: ctx,
      fuseError,
      collectionError: null,
    });

    if (SEND_CONTEXT_SNAPSHOTS_TO_SERVER) {
      const payload: ContextSnapshotPayload = {
        context_snapshot: {
          raw: bundle,
          context: ctx,
          collected_at: collectedAt,
        },
      };
      await apiClient.post('/context_snapshots', payload);
      if (__DEV__) {
        console.log('[SensorBundle] inviato OK');
        console.log('[SensorBundle] context:', JSON.stringify(ctx, null, 2));
      }
    } else if (__DEV__) {
      console.log('[SensorBundle] snapshot locale (server disattivato)');
      console.log('[SensorBundle] context:', JSON.stringify(ctx, null, 2));
    }
    return ctx;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    commitDebugSnapshot({
      collectedAt: new Date().toISOString(),
      raw: null,
      context: null,
      fuseError: null,
      collectionError: msg,
    });
    return null;
  }
}

/*
 * ── Incolla in App.tsx dentro il componente sotto AuthProvider (es. AppWithNavigationTheme),
 *    dopo gli altri useEffect, con useAuth e AsyncStorage:
 *
 * import AsyncStorage from '@react-native-async-storage/async-storage';
 * import { AppState } from 'react-native';
 * import { useAuth } from './src/context/AuthContext';
 * import { collectAndSend, initSensorBundle } from './src/services/SensorBundleService';
 *
 * const { token, user } = useAuth();
 * const isAuthenticated = Boolean(token && user);
 *
 * useEffect(() => {
 *   if (!isAuthenticated) return;
 *   const sub = AppState.addEventListener('change', (next) => {
 *     if (next === 'active') {
 *       void AsyncStorage.setItem('sensor_bundle_last_foreground_at', String(Date.now()));
 *     }
 *   });
 *   return () => sub.remove();
 * }, [isAuthenticated]);
 *
 * useEffect(() => {
 *   if (!isAuthenticated) return;
 *   let cancelled = false;
 *   let intervalId: ReturnType<typeof setInterval> | undefined;
 *   void (async () => {
 *     const modelPath = (await AsyncStorage.getItem('llm_model_path')) ?? '';
 *     if (modelPath.trim()) {
 *       try {
 *         await initSensorBundle(modelPath);
 *       } catch { /* ignore *\/ }
 *     }
 *     if (cancelled) return;
 *     void collectAndSend();
 *     intervalId = setInterval(() => {
 *       void collectAndSend();
 *     }, 5 * 60 * 1000);
 *   })();
 *   return () => {
 *     cancelled = true;
 *     if (intervalId) clearInterval(intervalId);
 *   };
 * }, [isAuthenticated]);
 */
