import client from './client';

export interface HealthSnapshotPayload {
  snapshot_date?: string;
  snapshot_type?: 'daily_summary' | 'context';
  active_calories?: number | null;
  steps?: number | null;
  sleep_hours?: number | null;
  resting_hr?: number | null;
  weight_kg?: number | null;
  body_fat_percent?: number | null;
  /** Allineato a `AppleHealthSnapshotPayload` per colonne Rails oltre a `raw_data`. */
  heart_rate_bpm?: number | null;
  hrv_sdnn_ms?: number | null;
  basal_energy_kcal_today?: number | null;
  distance_walking_running_km_today?: number | null;
  oxygen_saturation_percent?: number | null;
  dietary_energy_kcal_today?: number | null;
  flights_climbed_today?: number | null;
  lean_body_mass_kg?: number | null;
  bmi?: number | null;
  last_weight_date?: string | null;
  recorded_at?: string;
  raw_data?: Record<string, unknown>;
}

export async function syncHealthSnapshot(payload: HealthSnapshotPayload): Promise<boolean> {
  try {
    await client.post('/health_snapshots', payload);
    return true;
  } catch (error) {
    console.warn('[HealthSnapshot] sync failed:', error);
    return false;
  }
}

export async function syncHealthSnapshotBulk(
  snapshots: HealthSnapshotPayload[],
): Promise<{ count: number; ok: boolean }> {
  try {
    const response = await client.post('/health_snapshots/bulk_create', { snapshots });
    return { count: response.data?.count ?? 0, ok: true };
  } catch (error) {
    console.warn('[HealthSnapshot] bulk sync failed:', error);
    return { count: 0, ok: false };
  }
}
