import client from './client';

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
  if (profile && typeof profile === 'object') return { profile: profile as Profile };
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
