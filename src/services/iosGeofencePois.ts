import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

const STORAGE_KEY = '@ios_geofence_pois_v1';

export type IosGeofencePoiInput = {
  id: string;
  name?: string;
  latitude: number;
  longitude: number;
  /** Clamped to at least 100 m on native. Default 150 m. */
  radiusMeters?: number;
  /** Higher value wins when more than 20 POIs exist. */
  priority?: number;
};

type NativeSyncResult = {
  total: number;
  monitored: number;
  capped: boolean;
};

type EmitterModule = {
  setMonitoredPois?: (pois: IosGeofencePoiInput[]) => Promise<NativeSyncResult>;
};

function getEmitter(): EmitterModule | undefined {
  return NativeModules.EatingRiskEventEmitter as EmitterModule | undefined;
}

/** Pushes POIs to iOS geofencing (persists natively). No-op on Android. */
export async function syncIosGeofencePoisToNative(
  pois: IosGeofencePoiInput[],
): Promise<NativeSyncResult> {
  if (Platform.OS !== 'ios') {
    return { total: pois.length, monitored: pois.length, capped: false };
  }
  const mod = getEmitter();
  if (typeof mod?.setMonitoredPois !== 'function') {
    return { total: pois.length, monitored: 0, capped: false };
  }
  return mod.setMonitoredPois(pois);
}

/** Persists in AsyncStorage and syncs to native. */
export async function persistAndSyncIosGeofencePois(
  pois: IosGeofencePoiInput[],
): Promise<NativeSyncResult> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pois));
  return syncIosGeofencePoisToNative(pois);
}

/** Loads last saved list and reapplies native monitoring (e.g. after app launch). */
export async function loadAndSyncIosGeofencePoisFromStorage(): Promise<NativeSyncResult> {
  if (Platform.OS !== 'ios') {
    return { total: 0, monitored: 0, capped: false };
  }
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  let pois: IosGeofencePoiInput[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        pois = parsed as IosGeofencePoiInput[];
      }
    } catch {
      pois = [];
    }
  }
  return syncIosGeofencePoisToNative(pois);
}
