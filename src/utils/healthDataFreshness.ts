const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/** True se `health_data` ha un timestamp recente (< 8h). */
export function isHealthDataFresh(healthData: Record<string, unknown> | undefined): boolean {
  if (!healthData) return false;
  const ts =
    healthData.recorded_at ??
    healthData.snapshot_at ??
    healthData.startDate ??
    healthData.date ??
    healthData.last_weight_date;
  if (!ts || typeof ts !== 'string') return false;
  const t = new Date(ts).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < EIGHT_HOURS_MS;
}
