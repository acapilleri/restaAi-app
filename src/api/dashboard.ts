import client from './client';
import type { BriefingResponse } from './chat';

export type DashboardUser = {
  name?: string;
  first_name?: string;
  /** Peso attuale (backend può usare current_weight o weight) */
  current_weight?: number | null;
  weight?: number | null;
  /** Obiettivo in kg (backend può usare target_weight o goal_weight_kg) */
  target_weight?: number | null;
  goal_weight_kg?: number | null;
  progress?: number | null;
  weight_lost?: number | null;
};

export type PlanSummary = {
  calories: number;
  day: string;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
} | null;

export type DashboardToday = {
  date: string;
  has_diet: boolean;
  plan_summary: PlanSummary;
  weighed_today: boolean;
};

export type DashboardStats = {
  memories_count: number;
  photos_count: number;
  days_on_diet: number;
};

export type DashboardTodayMeal = {
  name: string;
  foods: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const DEFAULT_BRIEFING: BriefingResponse = {
  message: '',
  highlight: '',
  suggestion_today: 'Nessun suggerimento per oggi.',
  quick_chips: [],
  generated_at: new Date().toISOString(),
  context: { weight: 0, target: 0, progress: 0, plan_day: '' },
};

export type DashboardResponse = {
  user: DashboardUser;
  today: DashboardToday;
  stats: DashboardStats;
  briefing?: BriefingResponse | null;
  today_meals?: DashboardTodayMeal[];
};

function toNum(v: unknown): number | null | undefined {
  if (v == null) return v as null | undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** Backend DietaAI: { latest_weight, goal_weight_kg, progress_percent, diet_plan_active, ... } */
function normalizeDashboardResponse(data: unknown): DashboardResponse {
  if (!data || typeof data !== 'object') {
    return { user: {}, today: {} as DashboardToday, stats: {} as DashboardStats };
  }
  const d = data as Record<string, unknown>;
  const payload = (d.data && typeof d.data === 'object' ? d.data : d) as Record<string, unknown>;
  const rawWeight =
    payload.current_weight ??
    payload.weight ??
    payload.latest_weight ??
    (payload as Record<string, unknown>).latestWeight;
  const pl = payload as Record<string, unknown>;
  const rawGoal =
    payload.target_weight ??
    payload.goal_weight_kg ??
    pl.goalWeightKg ??
    pl.goal_weight ??
    pl.targetWeight;
  const rootWeight = toNum(rawWeight);
  const rootGoal = toNum(rawGoal);

  let user: DashboardUser;
  if (payload.user && typeof payload.user === 'object') {
    /** Se c'è `user` annidato, il backend spesso mette peso/obiettivo solo sulla radice: uniamo. */
    const u = payload.user as Record<string, unknown>;
    const nestedW = toNum(u.current_weight ?? u.weight ?? u.latest_weight);
    const nestedG = toNum(u.target_weight ?? u.goal_weight_kg ?? u.goal_weight ?? u.goalWeightKg ?? u.targetWeight);
    user = {
      ...(u as DashboardUser),
      current_weight: nestedW ?? rootWeight,
      weight: toNum(u.weight ?? u.current_weight ?? u.latest_weight) ?? nestedW ?? rootWeight,
      target_weight: nestedG ?? rootGoal,
      goal_weight_kg: nestedG ?? rootGoal,
      weight_lost: toNum(u.weight_lost ?? u.weightLost) ?? toNum(payload.weight_lost ?? pl.weightLost),
      progress:
        toNum(u.progress ?? u.progress_percent ?? u.progressPercent) ??
        toNum(payload.progress ?? payload.progress_percent ?? pl.progressPercent),
    };
  } else {
    user = {
      name: (payload.name as string) ?? (d.name as string) ?? undefined,
      current_weight: rootWeight,
      weight: rootWeight,
      target_weight: rootGoal,
      goal_weight_kg: rootGoal,
      weight_lost: toNum(payload.weight_lost ?? pl.weightLost),
      progress: toNum(payload.progress ?? payload.progress_percent ?? pl.progressPercent),
    };
  }
  const planSummaryRaw = payload.plan_summary ?? (payload.today as Record<string, unknown>)?.plan_summary ?? d.plan_summary ?? (d.today as Record<string, unknown>)?.plan_summary;
  const planSummary: PlanSummary =
    planSummaryRaw && typeof planSummaryRaw === 'object' && 'calories' in planSummaryRaw && 'day' in planSummaryRaw
      ? {
          calories: toNum((planSummaryRaw as { calories: unknown }).calories) ?? 0,
          day: String((planSummaryRaw as { day: unknown }).day ?? ''),
          protein_g: toNum((planSummaryRaw as { protein_g?: unknown }).protein_g) ?? undefined,
          carbs_g: toNum((planSummaryRaw as { carbs_g?: unknown }).carbs_g) ?? undefined,
          fat_g: toNum((planSummaryRaw as { fat_g?: unknown }).fat_g) ?? undefined,
        }
      : null;
  const briefingRaw = payload.briefing ?? d.briefing;
  let briefing: BriefingResponse | null = null;
  if (briefingRaw && typeof briefingRaw === 'object') {
    const b = briefingRaw as Record<string, unknown>;
    briefing = {
      ...DEFAULT_BRIEFING,
      message: String(b.message ?? ''),
      highlight: String(b.highlight ?? ''),
      suggestion_today: String(b.suggestion_today ?? DEFAULT_BRIEFING.suggestion_today),
      quick_chips: Array.isArray(b.quick_chips) ? b.quick_chips.map(String) : [],
      generated_at: String(b.generated_at ?? new Date().toISOString()),
      context:
        b.context && typeof b.context === 'object'
          ? {
              weight: toNum((b.context as Record<string, unknown>).weight) ?? 0,
              target: toNum((b.context as Record<string, unknown>).target) ?? 0,
              progress: toNum((b.context as Record<string, unknown>).progress) ?? 0,
              plan_day: String((b.context as Record<string, unknown>).plan_day ?? ''),
            }
          : DEFAULT_BRIEFING.context,
    };
  }

  const todayMealsRaw = payload.today_meals ?? d.today_meals;
  let today_meals: DashboardTodayMeal[] = [];
  if (Array.isArray(todayMealsRaw)) {
    today_meals = todayMealsRaw.map((m: unknown) => {
      const x = m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
      return {
        name: String(x.name ?? ''),
        foods: String(x.foods ?? ''),
        calories: toNum(x.calories) ?? 0,
        protein: toNum(x.protein) ?? 0,
        carbs: toNum(x.carbs) ?? 0,
        fat: toNum(x.fat) ?? 0,
      };
    });
  }

  return {
    user,
    today: (payload.today as DashboardToday) ?? (d.today as DashboardToday) ?? ({
      has_diet: !!(payload.diet_plan_active ?? d.diet_plan_active),
      date: (payload.latest_weight_date as string) ?? (d.latest_weight_date as string) ?? new Date().toISOString().slice(0, 10),
      plan_summary: planSummary,
      weighed_today: !!(payload.latest_weight_date ?? d.latest_weight_date),
    } as DashboardToday),
    stats: (payload.stats as DashboardStats) ?? (d.stats as DashboardStats) ?? ({} as DashboardStats),
    briefing: briefing ?? undefined,
    today_meals,
  };
}

export function getDashboard(): Promise<DashboardResponse> {
  return client.get<unknown>('/dashboard').then((r) => normalizeDashboardResponse(r.data));
}
