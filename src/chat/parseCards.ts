import type { CardData } from '../types/chat';
import { parseNearbyRestaurantRecommendationData } from './nearbyRestaurantCard';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Normalizza le card provenienti da GET /chat/history (JSON) verso CardData[].
 */
export function parseCardsFromHistory(raw: unknown): CardData[] {
  if (!Array.isArray(raw)) return [];
  const out: CardData[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const type = item.type;
    const data = item.data;
    if (typeof type !== 'string' || data === undefined) continue;

    switch (type) {
      case 'macro_summary': {
        if (!isRecord(data)) continue;
        const kcal = Number(data.kcal);
        const proteine = Number(data.proteine);
        const carboidrati = Number(data.carboidrati);
        const grassi = Number(data.grassi);
        const pasti = Array.isArray(data.pasti) ? data.pasti : [];
        if (![kcal, proteine, carboidrati, grassi].every((n) => Number.isFinite(n))) continue;
        out.push({
          type: 'macro_summary',
          data: {
            kcal,
            proteine,
            carboidrati,
            grassi,
            pasti: pasti.filter(isRecord).map((p) => ({
              nome: typeof p.nome === 'string' ? p.nome : '',
              orario: typeof p.orario === 'string' ? p.orario : '',
              kcal: Number(p.kcal) || 0,
            })),
          },
        });
        break;
      }
      case 'meal_progress': {
        if (!isRecord(data)) continue;
        const kcal_consumate = Number(data.kcal_consumate);
        const kcal_totali = Number(data.kcal_totali);
        if (!Number.isFinite(kcal_consumate) || !Number.isFinite(kcal_totali)) continue;
        out.push({
          type: 'meal_progress',
          data: {
            kcal_consumate,
            kcal_totali,
            prossimo_pasto: typeof data.prossimo_pasto === 'string' ? data.prossimo_pasto : '',
            orario_prossimo: typeof data.orario_prossimo === 'string' ? data.orario_prossimo : '',
            percentuale: Number(data.percentuale) || 0,
          },
        });
        break;
      }
      case 'weight_confirm': {
        if (!isRecord(data)) continue;
        const kg = Number(data.kg);
        if (!Number.isFinite(kg)) continue;
        const dateStr =
          typeof data.data === 'string' && data.data
            ? data.data
            : new Date().toISOString().slice(0, 10);
        out.push({
          type: 'weight_confirm',
          data: {
            kg,
            data: dateStr,
            title: typeof data.title === 'string' ? data.title : undefined,
            body: typeof data.body === 'string' ? data.body : undefined,
            intent_id: typeof data.intent_id === 'string' ? data.intent_id : undefined,
            confirm_token: typeof data.confirm_token === 'string' ? data.confirm_token : undefined,
            confirm_label: typeof data.confirm_label === 'string' ? data.confirm_label : undefined,
            cancel_label: typeof data.cancel_label === 'string' ? data.cancel_label : undefined,
            display_as_modal: data.display_as_modal === true,
          },
        });
        break;
      }
      case 'waist_confirm': {
        if (!isRecord(data)) continue;
        const value = Number(data.value);
        if (!Number.isFinite(value)) continue;
        const unitRaw = typeof data.unit === 'string' ? data.unit.toLowerCase() : 'cm';
        const unit = unitRaw === 'in' ? 'in' : 'cm';
        const dateStr =
          typeof data.data === 'string' && data.data
            ? data.data
            : new Date().toISOString().slice(0, 10);
        out.push({
          type: 'waist_confirm',
          data: {
            value,
            unit,
            data: dateStr,
            title: typeof data.title === 'string' ? data.title : undefined,
            body: typeof data.body === 'string' ? data.body : undefined,
            intent_id: typeof data.intent_id === 'string' ? data.intent_id : undefined,
            confirm_token: typeof data.confirm_token === 'string' ? data.confirm_token : undefined,
            confirm_label: typeof data.confirm_label === 'string' ? data.confirm_label : undefined,
            cancel_label: typeof data.cancel_label === 'string' ? data.cancel_label : undefined,
            display_as_modal: data.display_as_modal === true,
          },
        });
        break;
      }
      case 'body_fat_confirm': {
        if (!isRecord(data)) continue;
        const value_percent = Number(data.value_percent);
        if (!Number.isFinite(value_percent)) continue;
        const dateStr =
          typeof data.data === 'string' && data.data
            ? data.data
            : new Date().toISOString().slice(0, 10);
        out.push({
          type: 'body_fat_confirm',
          data: {
            value_percent,
            data: dateStr,
            title: typeof data.title === 'string' ? data.title : undefined,
            body: typeof data.body === 'string' ? data.body : undefined,
            intent_id: typeof data.intent_id === 'string' ? data.intent_id : undefined,
            confirm_token: typeof data.confirm_token === 'string' ? data.confirm_token : undefined,
            confirm_label: typeof data.confirm_label === 'string' ? data.confirm_label : undefined,
            cancel_label: typeof data.cancel_label === 'string' ? data.cancel_label : undefined,
            display_as_modal: data.display_as_modal === true,
          },
        });
        break;
      }
      case 'goal_weight_confirm': {
        if (!isRecord(data)) continue;
        const goal_kg = Number(data.goal_kg);
        if (!Number.isFinite(goal_kg)) continue;
        const dateStr =
          typeof data.data === 'string' && data.data
            ? data.data
            : new Date().toISOString().slice(0, 10);
        out.push({
          type: 'goal_weight_confirm',
          data: {
            goal_kg,
            data: dateStr,
            title: typeof data.title === 'string' ? data.title : undefined,
            body: typeof data.body === 'string' ? data.body : undefined,
            intent_id: typeof data.intent_id === 'string' ? data.intent_id : undefined,
            confirm_token: typeof data.confirm_token === 'string' ? data.confirm_token : undefined,
            confirm_label: typeof data.confirm_label === 'string' ? data.confirm_label : undefined,
            cancel_label: typeof data.cancel_label === 'string' ? data.cancel_label : undefined,
            display_as_modal: data.display_as_modal === true,
          },
        });
        break;
      }
      case 'height_confirm': {
        if (!isRecord(data)) continue;
        const height_cm = Number(data.height_cm);
        if (!Number.isFinite(height_cm)) continue;
        const dateStr =
          typeof data.data === 'string' && data.data
            ? data.data
            : new Date().toISOString().slice(0, 10);
        out.push({
          type: 'height_confirm',
          data: {
            height_cm,
            data: dateStr,
            title: typeof data.title === 'string' ? data.title : undefined,
            body: typeof data.body === 'string' ? data.body : undefined,
            intent_id: typeof data.intent_id === 'string' ? data.intent_id : undefined,
            confirm_token: typeof data.confirm_token === 'string' ? data.confirm_token : undefined,
            confirm_label: typeof data.confirm_label === 'string' ? data.confirm_label : undefined,
            cancel_label: typeof data.cancel_label === 'string' ? data.cancel_label : undefined,
            display_as_modal: data.display_as_modal === true,
          },
        });
        break;
      }
      case 'birth_date_confirm': {
        if (!isRecord(data)) continue;
        const birthRaw =
          typeof data.birth_date === 'string' && data.birth_date ? data.birth_date.slice(0, 10) : '';
        if (!birthRaw) continue;
        const dateStr =
          typeof data.data === 'string' && data.data
            ? data.data
            : new Date().toISOString().slice(0, 10);
        out.push({
          type: 'birth_date_confirm',
          data: {
            birth_date: birthRaw,
            data: dateStr,
            title: typeof data.title === 'string' ? data.title : undefined,
            body: typeof data.body === 'string' ? data.body : undefined,
            intent_id: typeof data.intent_id === 'string' ? data.intent_id : undefined,
            confirm_token: typeof data.confirm_token === 'string' ? data.confirm_token : undefined,
            confirm_label: typeof data.confirm_label === 'string' ? data.confirm_label : undefined,
            cancel_label: typeof data.cancel_label === 'string' ? data.cancel_label : undefined,
            display_as_modal: data.display_as_modal === true,
          },
        });
        break;
      }
      case 'intolerances_confirm': {
        if (!isRecord(data)) continue;
        const dateStr =
          typeof data.data === 'string' && data.data
            ? data.data
            : new Date().toISOString().slice(0, 10);
        out.push({
          type: 'intolerances_confirm',
          data: {
            text: typeof data.text === 'string' ? data.text : '',
            merge: data.merge !== false,
            data: dateStr,
            title: typeof data.title === 'string' ? data.title : undefined,
            body: typeof data.body === 'string' ? data.body : undefined,
            intent_id: typeof data.intent_id === 'string' ? data.intent_id : undefined,
            confirm_token: typeof data.confirm_token === 'string' ? data.confirm_token : undefined,
            confirm_label: typeof data.confirm_label === 'string' ? data.confirm_label : undefined,
            cancel_label: typeof data.cancel_label === 'string' ? data.cancel_label : undefined,
            display_as_modal: data.display_as_modal === true,
          },
        });
        break;
      }
      case 'pending_action_confirm': {
        if (!isRecord(data)) continue;
        const pending = data as Record<string, unknown>;
        out.push({
          type: 'pending_action_confirm',
          data: {
            confirmation_required: pending.confirmation_required !== false,
            title: typeof pending.title === 'string' ? pending.title : undefined,
            body: typeof pending.body === 'string' ? pending.body : undefined,
            message: typeof pending.message === 'string' ? pending.message : undefined,
            confirm_label: typeof pending.confirm_label === 'string' ? pending.confirm_label : undefined,
            cancel_label: typeof pending.cancel_label === 'string' ? pending.cancel_label : undefined,
            intent_id: typeof pending.intent_id === 'string' ? pending.intent_id : undefined,
            confirm_token: typeof pending.confirm_token === 'string' ? pending.confirm_token : undefined,
            action_type: typeof pending.action_type === 'string' ? pending.action_type : undefined,
            display_as_modal: pending.display_as_modal === true,
            value: typeof pending.value === 'number' ? pending.value : Number(pending.value) || undefined,
            weight_kg:
              typeof pending.weight_kg === 'number'
                ? pending.weight_kg
                : Number.isFinite(Number(pending.weight_kg))
                  ? Number(pending.weight_kg)
                  : undefined,
            date: typeof pending.date === 'string' ? pending.date : undefined,
            unit: typeof pending.unit === 'string' ? pending.unit : undefined,
          },
        });
        break;
      }

      case 'nearby_restaurant_recommendation': {
        const parsed = parseNearbyRestaurantRecommendationData(data);
        if (parsed) {
          out.push({ type: 'nearby_restaurant_recommendation', data: parsed });
        }
        break;
      }
      case 'recipe_alternative': {
        if (!isRecord(data)) continue;
        out.push({
          type: 'recipe_alternative',
          data: {
            pasto: typeof data.pasto === 'string' ? data.pasto : '',
            nome: typeof data.nome === 'string' ? data.nome : '',
            ingredienti: typeof data.ingredienti === 'string' ? data.ingredienti : '',
            proteine: Number(data.proteine) || 0,
            carboidrati: Number(data.carboidrati) || 0,
            grassi: Number(data.grassi) || 0,
            kcal: Number(data.kcal) || 0,
          },
        });
        break;
      }
      default:
        break;
    }
  }
  return out;
}
