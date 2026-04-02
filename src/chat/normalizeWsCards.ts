import type { CardData } from '../types/chat';
import { parseNearbyRestaurantRecommendationData } from './nearbyRestaurantCard';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Normalizza le card ricevute via Action Cable (chiavi stringa, booleani come stringa).
 */
export function normalizeChatCardsFromWire(raw: unknown): CardData[] {
  if (!Array.isArray(raw)) return [];
  const out: CardData[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const type = item.type;
    if (type === 'weight_confirm' && isRecord(item.data)) {
      const d = item.data;
      const kg = Number(d.kg);
      if (!Number.isFinite(kg)) continue;
      const dateStr =
        typeof d.data === 'string' && d.data
          ? d.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const dm = d.display_as_modal;
      const displayModal = dm === true || dm === 'true' || dm === 1;
      out.push({
        type: 'weight_confirm',
        data: {
          kg,
          data: dateStr,
          title: typeof d.title === 'string' ? d.title : undefined,
          body: typeof d.body === 'string' ? d.body : undefined,
          intent_id: typeof d.intent_id === 'string' ? d.intent_id : undefined,
          confirm_token: typeof d.confirm_token === 'string' ? d.confirm_token : undefined,
          confirm_label: typeof d.confirm_label === 'string' ? d.confirm_label : undefined,
          cancel_label: typeof d.cancel_label === 'string' ? d.cancel_label : undefined,
          display_as_modal: displayModal,
        },
      });
      continue;
    }
    if (type === 'waist_confirm' && isRecord(item.data)) {
      const d = item.data;
      const value = Number(d.value);
      if (!Number.isFinite(value)) continue;
      const u = typeof d.unit === 'string' ? d.unit.toLowerCase() : 'cm';
      const unit = u === 'in' ? 'in' : 'cm';
      const dateStr =
        typeof d.data === 'string' && d.data
          ? d.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const dm = d.display_as_modal;
      const displayModal = dm === true || dm === 'true' || dm === 1;
      out.push({
        type: 'waist_confirm',
        data: {
          value,
          unit,
          data: dateStr,
          title: typeof d.title === 'string' ? d.title : undefined,
          body: typeof d.body === 'string' ? d.body : undefined,
          intent_id: typeof d.intent_id === 'string' ? d.intent_id : undefined,
          confirm_token: typeof d.confirm_token === 'string' ? d.confirm_token : undefined,
          confirm_label: typeof d.confirm_label === 'string' ? d.confirm_label : undefined,
          cancel_label: typeof d.cancel_label === 'string' ? d.cancel_label : undefined,
          display_as_modal: displayModal,
        },
      });
      continue;
    }
    if (type === 'body_fat_confirm' && isRecord(item.data)) {
      const d = item.data;
      const value_percent = Number(d.value_percent);
      if (!Number.isFinite(value_percent)) continue;
      const dateStr =
        typeof d.data === 'string' && d.data
          ? d.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const dm = d.display_as_modal;
      const displayModal = dm === true || dm === 'true' || dm === 1;
      out.push({
        type: 'body_fat_confirm',
        data: {
          value_percent,
          data: dateStr,
          title: typeof d.title === 'string' ? d.title : undefined,
          body: typeof d.body === 'string' ? d.body : undefined,
          intent_id: typeof d.intent_id === 'string' ? d.intent_id : undefined,
          confirm_token: typeof d.confirm_token === 'string' ? d.confirm_token : undefined,
          confirm_label: typeof d.confirm_label === 'string' ? d.confirm_label : undefined,
          cancel_label: typeof d.cancel_label === 'string' ? d.cancel_label : undefined,
          display_as_modal: displayModal,
        },
      });
      continue;
    }
    if (type === 'goal_weight_confirm' && isRecord(item.data)) {
      const d = item.data;
      const goal_kg = Number(d.goal_kg);
      if (!Number.isFinite(goal_kg)) continue;
      const dateStr =
        typeof d.data === 'string' && d.data
          ? d.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const dm = d.display_as_modal;
      const displayModal = dm === true || dm === 'true' || dm === 1;
      out.push({
        type: 'goal_weight_confirm',
        data: {
          goal_kg,
          data: dateStr,
          title: typeof d.title === 'string' ? d.title : undefined,
          body: typeof d.body === 'string' ? d.body : undefined,
          intent_id: typeof d.intent_id === 'string' ? d.intent_id : undefined,
          confirm_token: typeof d.confirm_token === 'string' ? d.confirm_token : undefined,
          confirm_label: typeof d.confirm_label === 'string' ? d.confirm_label : undefined,
          cancel_label: typeof d.cancel_label === 'string' ? d.cancel_label : undefined,
          display_as_modal: displayModal,
        },
      });
      continue;
    }
    if (type === 'height_confirm' && isRecord(item.data)) {
      const d = item.data;
      const height_cm = Number(d.height_cm);
      if (!Number.isFinite(height_cm)) continue;
      const dateStr =
        typeof d.data === 'string' && d.data
          ? d.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const dm = d.display_as_modal;
      const displayModal = dm === true || dm === 'true' || dm === 1;
      out.push({
        type: 'height_confirm',
        data: {
          height_cm,
          data: dateStr,
          title: typeof d.title === 'string' ? d.title : undefined,
          body: typeof d.body === 'string' ? d.body : undefined,
          intent_id: typeof d.intent_id === 'string' ? d.intent_id : undefined,
          confirm_token: typeof d.confirm_token === 'string' ? d.confirm_token : undefined,
          confirm_label: typeof d.confirm_label === 'string' ? d.confirm_label : undefined,
          cancel_label: typeof d.cancel_label === 'string' ? d.cancel_label : undefined,
          display_as_modal: displayModal,
        },
      });
      continue;
    }
    if (type === 'birth_date_confirm' && isRecord(item.data)) {
      const d = item.data;
      const birthRaw = typeof d.birth_date === 'string' && d.birth_date ? d.birth_date.slice(0, 10) : '';
      if (!birthRaw) continue;
      const dateStr =
        typeof d.data === 'string' && d.data
          ? d.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const dm = d.display_as_modal;
      const displayModal = dm === true || dm === 'true' || dm === 1;
      out.push({
        type: 'birth_date_confirm',
        data: {
          birth_date: birthRaw,
          data: dateStr,
          title: typeof d.title === 'string' ? d.title : undefined,
          body: typeof d.body === 'string' ? d.body : undefined,
          intent_id: typeof d.intent_id === 'string' ? d.intent_id : undefined,
          confirm_token: typeof d.confirm_token === 'string' ? d.confirm_token : undefined,
          confirm_label: typeof d.confirm_label === 'string' ? d.confirm_label : undefined,
          cancel_label: typeof d.cancel_label === 'string' ? d.cancel_label : undefined,
          display_as_modal: displayModal,
        },
      });
      continue;
    }
    if (type === 'intolerances_confirm' && isRecord(item.data)) {
      const d = item.data;
      const text = typeof d.text === 'string' ? d.text : '';
      const dateStr =
        typeof d.data === 'string' && d.data
          ? d.data.slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      const dm = d.display_as_modal;
      const displayModal = dm === true || dm === 'true' || dm === 1;
      const mergeRaw = d.merge;
      const merge = mergeRaw === false || mergeRaw === 'false' || mergeRaw === 0 ? false : true;
      out.push({
        type: 'intolerances_confirm',
        data: {
          text,
          merge,
          data: dateStr,
          title: typeof d.title === 'string' ? d.title : undefined,
          body: typeof d.body === 'string' ? d.body : undefined,
          intent_id: typeof d.intent_id === 'string' ? d.intent_id : undefined,
          confirm_token: typeof d.confirm_token === 'string' ? d.confirm_token : undefined,
          confirm_label: typeof d.confirm_label === 'string' ? d.confirm_label : undefined,
          cancel_label: typeof d.cancel_label === 'string' ? d.cancel_label : undefined,
          display_as_modal: displayModal,
        },
      });
      continue;
    }
    if (type === 'pending_action_confirm' && isRecord(item.data)) {
      out.push(item as CardData);
      continue;
    }

    if (type === 'nearby_restaurant_recommendation' && isRecord(item.data)) {
      const parsed = parseNearbyRestaurantRecommendationData(item.data);
      if (parsed) {
        out.push({ type: 'nearby_restaurant_recommendation', data: parsed });
      }
      continue;
    }
    if (
      type === 'macro_summary' ||
      type === 'meal_progress' ||
      type === 'recipe_alternative'
    ) {
      out.push(item as CardData);
    }
  }
  return out;
}
