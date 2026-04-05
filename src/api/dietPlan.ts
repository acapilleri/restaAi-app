import client from './client';
import {
  getPresignedUploadUrl,
  resolveUploadContentType,
  resolveUploadFilename,
  uploadToR2,
  type PresignedUploadTarget,
  type R2UploadAsset,
} from './r2Upload';

export type DietPlanMeal = {
  name: string;
  foods: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type DietPlanParsed = {
  days: Record<string, DietPlanMeal[]>;
  summary: {
    daily_calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
};

export type DietPlanRecord = {
  id: number;
  raw_text?: string;
  raw_content?: string;
  parsed: DietPlanParsed;
  total_calories?: number;
  active?: boolean;
  created_at: string;
};

export type DietPlanResponse = {
  diet_plan: DietPlanRecord;
};

export type DietPlansResponse = {
  diet_plans: DietPlanRecord[];
};

export type DietPlanScanAsset = R2UploadAsset;

export function getDietPlan(): Promise<DietPlanResponse> {
  return client.get<DietPlanResponse>('/diet_plan').then((r) => r.data);
}

export function getDietPlans(): Promise<DietPlansResponse> {
  return client.get<DietPlansResponse>('/diet_plans').then((r) => r.data);
}

export function createDietPlan(text: string): Promise<{ message: string; plan_id: number }> {
  return client.post<{ message: string; plan_id: number }>('/diet_plan', { text }).then((r) => r.data);
}

export function deleteDietPlan(): Promise<{ message: string }> {
  return client.delete<{ message: string }>('/diet_plan').then((r) => r.data);
}

export function reactivateDietPlan(id: number): Promise<{ message: string; diet_plan: DietPlanRecord }> {
  return client.patch<{ message: string; diet_plan: DietPlanRecord }>(`/diet_plans/${id}/reactivate`).then((r) => r.data);
}

/** Invia un'immagine del piano dieta; l'AI estrae il testo. Body: FormData con chiave 'image' (file). */
export function getDietPlanPresignedUrl(
  filename: string,
  contentType: string,
): Promise<PresignedUploadTarget> {
  return getPresignedUploadUrl('/diet_plan/presign', filename, contentType);
}

/** Invia la URL pubblica o la chiave R2 dell'immagine del piano dieta; l'AI estrae il testo dal file gia' caricato. */
export function scanDietPlan(imageUrl: string, r2Key?: string): Promise<{ text: string }> {
  return client.post<{ text: string }>('/diet_plan/scan', { image_url: imageUrl, r2_key: r2Key }).then((r) => r.data);
}

function mapDietPlanScanError(error: unknown): Error {
  const message = error instanceof Error ? error.message.trim() : '';
  if (message === 'Network Error' || /timeout/i.test(message)) {
    return new Error('Backend locale non raggiungibile. Verifica che Rails sia attivo e che l\'app punti all\'IP del Mac.');
  }
  if (message === 'Non trovato' || /404/.test(message)) {
    return new Error('Endpoint scansione dieta non trovato sul backend attuale.');
  }
  return error instanceof Error ? error : new Error('Scansione dieta non riuscita');
}

export async function uploadDietPlanImageAndScan(asset: DietPlanScanAsset): Promise<{ text: string }> {
  try {
    const filename = resolveUploadFilename(asset.fileName, 'diet.jpg');
    const contentType = resolveUploadContentType(asset.type);
    const { upload_url, public_url, key } = await getDietPlanPresignedUrl(filename, contentType);
    await uploadToR2(upload_url, asset.uri, contentType);
    return scanDietPlan(public_url, key);
  } catch (error) {
    throw mapDietPlanScanError(error);
  }
}
