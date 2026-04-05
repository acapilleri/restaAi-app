import client from './client';
import {
  getPresignedUploadUrl,
  resolveUploadContentType,
  resolveUploadFilename,
  uploadToR2,
  type PresignedUploadTarget,
} from './r2Upload';
export { uploadToR2 } from './r2Upload';

export interface BodyAnalysisComparison {
  comparison_summary: string;
  progress_summary: string;
  /** Valori tipici: miglioramento | stabile | peggioramento | non_determinabile */
  progress_trend: string;
}

export interface BodyReading {
  posture_score: number;
  posture_notes: string;
  body_fat_estimate: string;
  waist_to_hip_ratio_estimate: string;
  waist_to_shoulder_ratio_estimate: string;
  body_shape_note: string;
  muscle_distribution: string;
  strong_areas: string[];
  areas_to_improve: string[];
  overall_progress_note: string;
  suggested_focus: string;
  notes: string;
}

export interface BodyAnalysis {
  id: number;
  taken_on: string;
  photo_url: string;
  readings: BodyReading;
  comparison: BodyAnalysisComparison;
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
    waist_to_hip_ratio_estimate: toSafeString(raw.waist_to_hip_ratio_estimate),
    waist_to_shoulder_ratio_estimate: toSafeString(raw.waist_to_shoulder_ratio_estimate),
    body_shape_note: toSafeString(raw.body_shape_note),
    muscle_distribution: toSafeString(raw.muscle_distribution),
    strong_areas: toStringArray(raw.strong_areas),
    areas_to_improve: toStringArray(raw.areas_to_improve),
    overall_progress_note: toSafeString(raw.overall_progress_note),
    suggested_focus: toSafeString(raw.suggested_focus),
    notes: toSafeString(raw.notes),
  };
}

export function normalizeBodyComparison(value: unknown): BodyAnalysisComparison {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const trend = toSafeString(raw.progress_trend).toLowerCase();
  return {
    comparison_summary: toSafeString(raw.comparison_summary),
    progress_summary: toSafeString(raw.progress_summary),
    progress_trend: trend || 'non_determinabile',
  };
}

export function normalizeBodyAnalysis(value: unknown): BodyAnalysis {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: toSafeNumber(raw.id),
    taken_on: toSafeString(raw.taken_on),
    photo_url: toSafeString(raw.photo_url),
    readings: normalizeBodyReading(raw.readings),
    comparison: normalizeBodyComparison(raw.comparison),
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
): Promise<PresignedUploadTarget> {
  return getPresignedUploadUrl('/body_analyses/presign', filename, contentType);
}

export async function createBodyAnalysis(photoUrl: string, date?: string, r2Key?: string): Promise<BodyAnalysis> {
  const res = await client.post('/body_analyses', {
    photo_url: photoUrl,
    r2_key: r2Key,
    date: date ?? new Date().toISOString().split('T')[0],
  });
  return normalizeBodyAnalysis(res.data);
}

export async function uploadAndAnalyze(asset: BodyAnalysisUploadAsset): Promise<BodyAnalysis> {
  const filename = resolveUploadFilename(asset.fileName, 'photo.jpg');
  const contentType = resolveUploadContentType(asset.type);
  const { upload_url, public_url, key } = await getPresignedUrl(filename, contentType);
  await uploadToR2(upload_url, asset.uri, contentType);
  return createBodyAnalysis(public_url, undefined, key);
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

export async function deleteBodyAnalysis(id: number): Promise<{ message: string }> {
  const res = await client.delete<{ message: string }>(`/body_analyses/${id}`);
  return res.data;
}
