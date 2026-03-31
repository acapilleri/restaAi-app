import client from './client';

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
export function scanDietPlan(formData: FormData): Promise<{ text: string }> {
  return client.post<{ text: string }>('/diet_plan/scan', formData).then((r) => r.data);
}
