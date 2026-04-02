import type {
  NearbyMenuAlternative,
  NearbyMenuPick,
  NearbyRestaurantRecommendationData,
} from '../types/chat';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Normalizza il payload card `nearby_restaurant_recommendation` da history o WS. */
export function parseNearbyRestaurantRecommendationData(
  raw: unknown,
): NearbyRestaurantRecommendationData | null {
  if (!isRecord(raw)) return null;

  const primaryRaw = raw.primary_recommendations;
  if (!Array.isArray(primaryRaw)) return null;

  const primary_recommendations: NearbyMenuPick[] = [];
  for (const p of primaryRaw) {
    if (!isRecord(p)) continue;
    const restaurant_name = typeof p.restaurant_name === 'string' ? p.restaurant_name.trim() : '';
    const menu_item_name = typeof p.menu_item_name === 'string' ? p.menu_item_name.trim() : '';
    if (!restaurant_name || !menu_item_name) continue;

    const distanceRaw = p.distance_m;
    const distance_m = distanceRaw === null ? null : numOrUndef(distanceRaw) ?? null;

    primary_recommendations.push({
      restaurant_name,
      menu_item_name,
      distance_m,
      section: p.section === null ? null : typeof p.section === 'string' ? p.section : undefined,
      notes: typeof p.notes === 'string' ? p.notes : undefined,
      diet_fit_summary: typeof p.diet_fit_summary === 'string' ? p.diet_fit_summary : undefined,
      cautions: Array.isArray(p.cautions)
        ? p.cautions.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
        : undefined,
      confidence: numOrUndef(p.confidence),
    });
  }

  let alternatives: NearbyMenuAlternative[] | undefined;
  const altRaw = raw.alternatives;
  if (Array.isArray(altRaw)) {
    const alts: NearbyMenuAlternative[] = [];
    for (const a of altRaw) {
      if (!isRecord(a)) continue;
      const restaurant_name = typeof a.restaurant_name === 'string' ? a.restaurant_name.trim() : '';
      const menu_item_name = typeof a.menu_item_name === 'string' ? a.menu_item_name.trim() : '';
      if (!restaurant_name || !menu_item_name) continue;
      const distanceRaw = a.distance_m;
      alts.push({
        restaurant_name,
        menu_item_name,
        distance_m: distanceRaw === null ? null : numOrUndef(distanceRaw) ?? null,
        notes: typeof a.notes === 'string' ? a.notes : undefined,
      });
    }
    if (alts.length > 0) alternatives = alts;
  }

  const assistant_summary_hint =
    typeof raw.assistant_summary_hint === 'string' ? raw.assistant_summary_hint.trim() : undefined;

  const hasContent =
    primary_recommendations.length > 0 ||
    (alternatives && alternatives.length > 0) ||
    (assistant_summary_hint && assistant_summary_hint.length > 0);

  if (!hasContent) return null;

  return {
    primary_recommendations,
    alternatives,
    assistant_summary_hint: assistant_summary_hint || undefined,
  };
}
