import client from './client';

export type WeightEntry = { id: number; value: number; date: string; note?: string };

export type WeightsStats = {
  current: number;
  target: number;
  lost: number;
  progress: number;
};

export type WeightsResponse = {
  weights: WeightEntry[];
  stats?: WeightsStats;
};

/** Ultimo peso noto: preferisce stats.current se presente, altrimenti la pesata con data più recente. */
export function latestWeightKgFromResponse(data: WeightsResponse): number | null {
  const s = data.stats?.current;
  if (s != null && typeof s === 'number' && !Number.isNaN(s)) return s;
  const list = data.weights;
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const v = sorted[0]?.value;
  return v != null && !Number.isNaN(v) ? v : null;
}

/** Backend restituisce { weights: [ { id, value_kg, recorded_on } ] } */
function normalizeWeightsResponse(data: unknown): WeightsResponse {
  if (!data || typeof data !== 'object') return { weights: [] };
  const d = data as Record<string, unknown>;
  const raw = Array.isArray(d.weights) ? d.weights : [];
  const weights: WeightEntry[] = raw.map((w: unknown) => {
    const o = w && typeof w === 'object' ? (w as Record<string, unknown>) : {};
    const value = o.value_kg ?? o.value;
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    const date = o.recorded_on ?? o.date;
    const dateStr =
      typeof date === 'string' ? date : date instanceof Date ? date.toISOString().slice(0, 10) : '';
    return {
      id: Number(o.id) || 0,
      value: Number.isNaN(num) ? 0 : num,
      date: dateStr,
    };
  });
  return { weights, stats: d.stats as WeightsStats | undefined };
}

export function getWeights(): Promise<WeightsResponse> {
  return client.get<unknown>('/weights').then((r) => normalizeWeightsResponse(r.data));
}

export function createWeight(value: number, date?: string, note?: string): Promise<{ weight: WeightEntry }> {
  const body: Record<string, unknown> = { value_kg: value };
  if (date) body.recorded_on = date;
  return client
    .post<{ id: number; value_kg: number; recorded_on: string }>('/weights', body)
    .then((r) => ({
      weight: {
        id: r.data.id,
        value: Number(r.data.value_kg),
        date: (r.data.recorded_on || '').toString().slice(0, 10),
      },
    }));
}

export function deleteWeight(id: number): Promise<{ message: string }> {
  return client.delete<{ message: string }>(`/weights/${id}`).then((r) => r.data);
}
