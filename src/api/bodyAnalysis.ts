import client from './client';

export interface BodyReading {
  posture_score: number;
  posture_notes: string;
  body_fat_estimate: string;
  muscle_distribution: string;
  strong_areas: string[];
  areas_to_improve: string[];
  notes: string;
}

export interface BodyAnalysis {
  id: number;
  taken_on: string;
  photo_url: string;
  readings: BodyReading;
  ai_summary: string;
}

export interface BodyAnalysesCompareDelta {
  posture_score_delta: number;
  days_elapsed: number;
}

export interface BodyAnalysesCompareResponse {
  analyses: BodyAnalysis[];
  delta: BodyAnalysesCompareDelta;
}

export interface BodyAnalysisUploadAsset {
  uri: string;
  fileName?: string | null;
  type?: string | null;
}

type PresignedUrlResponse = {
  upload_url?: unknown;
  public_url?: unknown;
};

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function normalizeBodyReading(value: unknown): BodyReading {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    posture_score: toSafeNumber(raw.posture_score),
    posture_notes: toSafeString(raw.posture_notes),
    body_fat_estimate: toSafeString(raw.body_fat_estimate),
    muscle_distribution: toSafeString(raw.muscle_distribution),
    strong_areas: toStringArray(raw.strong_areas),
    areas_to_improve: toStringArray(raw.areas_to_improve),
    notes: toSafeString(raw.notes),
  };
}

export function normalizeBodyAnalysis(value: unknown): BodyAnalysis {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: toSafeNumber(raw.id),
    taken_on: toSafeString(raw.taken_on),
    photo_url: toSafeString(raw.photo_url),
    readings: normalizeBodyReading(raw.readings),
    ai_summary: toSafeString(raw.ai_summary),
  };
}

export function normalizeBodyAnalysesResponse(value: unknown): BodyAnalysis[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(normalizeBodyAnalysis);
}

export function normalizeCompareBodyAnalysesResponse(value: unknown): BodyAnalysesCompareResponse {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const deltaRaw =
    raw.delta && typeof raw.delta === 'object' ? (raw.delta as Record<string, unknown>) : {};

  return {
    analyses: normalizeBodyAnalysesResponse(raw.analyses),
    delta: {
      posture_score_delta: toSafeNumber(deltaRaw.posture_score_delta),
      days_elapsed: toSafeNumber(deltaRaw.days_elapsed),
    },
  };
}

export async function getPresignedUrl(
  filename: string,
  contentType: string,
): Promise<{ upload_url: string; public_url: string }> {
  const res = await client.get<PresignedUrlResponse>('/body_analyses/presign', {
    params: { filename, content_type: contentType },
  });

  const upload_url = toSafeString(res.data?.upload_url);
  const public_url = toSafeString(res.data?.public_url);

  if (!upload_url || !public_url) {
    throw new Error('Presigned URL non valida');
  }

  return { upload_url, public_url };
}

export async function uploadToR2(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const fileResponse = await fetch(fileUri);
  if ('ok' in fileResponse && fileResponse.ok === false) {
    throw new Error('Impossibile leggere il file selezionato');
  }

  const blob = await fileResponse.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload R2 fallito: ${uploadResponse.status}`);
  }
}

export async function createBodyAnalysis(photoUrl: string, date?: string): Promise<BodyAnalysis> {
  const res = await client.post('/body_analyses', {
    photo_url: photoUrl,
    date: date ?? new Date().toISOString().split('T')[0],
  });
  return normalizeBodyAnalysis(res.data);
}

export async function uploadAndAnalyze(asset: BodyAnalysisUploadAsset): Promise<BodyAnalysis> {
  const filename = asset.fileName ?? 'photo.jpg';
  const contentType = asset.type ?? 'image/jpeg';
  const { upload_url, public_url } = await getPresignedUrl(filename, contentType);
  await uploadToR2(upload_url, asset.uri, contentType);
  return createBodyAnalysis(public_url);
}

export async function getBodyAnalyses(): Promise<BodyAnalysis[]> {
  const res = await client.get('/body_analyses');
  return normalizeBodyAnalysesResponse(res.data);
}

export async function compareBodyAnalyses(ids: number[]): Promise<BodyAnalysesCompareResponse> {
  const res = await client.get('/body_analyses/compare', {
    params: { ids },
  });
  return normalizeCompareBodyAnalysesResponse(res.data);
}
