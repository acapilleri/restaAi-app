import client from './client';

function toNum(v: unknown): number | null | undefined {
  if (v == null) return v as null | undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** Formato restituito dal backend GET /profile */
export type Profile = {
  id: number;
  email: string;
  name: string;
  age?: number | null;
  height_cm?: number | null;
  goal_weight_kg?: number | null;
  intolerances?: string[] | null;
  plan_type?: string | null;
  measurements_last?: unknown;
  weight_lost?: number | null;
  current_weight?: number | null;
  memories_count?: number;
  premium?: boolean;
};

export type ProfileResponse = { profile: Profile };

/** Backend può restituire { profile }, { user }, oppure l'oggetto alla radice */
function normalizeProfileResponse(data: unknown): ProfileResponse {
  if (!data || typeof data !== 'object') return { profile: {} as Profile };
  const d = data as Record<string, unknown>;
  const profile =
    d.profile && typeof d.profile === 'object' ? d.profile
    : d.user && typeof d.user === 'object' ? d.user
    : d.id != null && d.email != null ? d
    : null;
  if (profile && typeof profile === 'object') {
    const o = profile as Record<string, unknown>;
    const goal =
      toNum(o.goal_weight_kg) ?? toNum(o.target_weight) ?? toNum(o.goal_weight) ?? toNum(o.goalWeightKg);
    const current =
      toNum(o.current_weight) ??
      toNum(o.latest_weight) ??
      toNum(o.weight) ??
      toNum(o.latestWeight);
    const p = { ...(profile as Profile) };
    if (goal != null) p.goal_weight_kg = goal;
    if (current != null) p.current_weight = current;
    return { profile: p };
  }
  return { profile: data as Profile };
}

export function getProfile(): Promise<ProfileResponse> {
  return client.get<unknown>('/profile').then((r) => normalizeProfileResponse(r.data));
}

export type ProfilePatchPayload = {
  name?: string;
  age?: number;
  height_cm?: number;
  goal_weight_kg?: number;
  intolerances?: string[];
  plan_type?: string;
};

export function updateProfile(payload: ProfilePatchPayload): Promise<ProfileResponse> {
  return client.patch<unknown>('/profile', payload).then((r) => normalizeProfileResponse(r.data));
}
