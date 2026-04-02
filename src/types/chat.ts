export type CardType =
  | 'macro_summary'
  | 'meal_progress'
  | 'weight_confirm'
  | 'waist_confirm'
  | 'body_fat_confirm'
  | 'goal_weight_confirm'
  | 'height_confirm'
  | 'birth_date_confirm'
  | 'intolerances_confirm'
  | 'pending_action_confirm'
  | 'recipe_alternative'
  | 'nearby_restaurant_recommendation';

export type MessageReaction = 'like' | 'dislike';

export interface MacroSummaryData {
  kcal: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
  pasti: Array<{ nome: string; orario: string; kcal: number }>;
}

export interface MealProgressData {
  kcal_consumate: number;
  kcal_totali: number;
  prossimo_pasto: string;
  orario_prossimo: string;
  percentuale: number;
}

/** Campi opzionali inviati dal server per copy dinamica e intent pendente. */
export interface WeightConfirmData {
  kg: number;
  data: string;
  title?: string;
  body?: string;
  intent_id?: string;
  confirm_token?: string;
  confirm_label?: string;
  cancel_label?: string;
  /** Se true, la conferma è mostrata in un overlay modale. */
  display_as_modal?: boolean;
}

export interface WaistConfirmData {
  value: number;
  unit: string;
  data: string;
  title?: string;
  body?: string;
  intent_id?: string;
  confirm_token?: string;
  confirm_label?: string;
  cancel_label?: string;
  display_as_modal?: boolean;
}

export interface BodyFatConfirmData {
  value_percent: number;
  data: string;
  title?: string;
  body?: string;
  intent_id?: string;
  confirm_token?: string;
  confirm_label?: string;
  cancel_label?: string;
  display_as_modal?: boolean;
}

export interface GoalWeightConfirmData {
  goal_kg: number;
  data: string;
  title?: string;
  body?: string;
  intent_id?: string;
  confirm_token?: string;
  confirm_label?: string;
  cancel_label?: string;
  display_as_modal?: boolean;
}

export interface HeightConfirmData {
  height_cm: number;
  data: string;
  title?: string;
  body?: string;
  intent_id?: string;
  confirm_token?: string;
  confirm_label?: string;
  cancel_label?: string;
  display_as_modal?: boolean;
}

export interface BirthDateConfirmData {
  birth_date: string;
  data: string;
  title?: string;
  body?: string;
  intent_id?: string;
  confirm_token?: string;
  confirm_label?: string;
  cancel_label?: string;
  display_as_modal?: boolean;
}

export interface IntolerancesConfirmData {
  text: string;
  merge?: boolean;
  data: string;
  title?: string;
  body?: string;
  intent_id?: string;
  confirm_token?: string;
  confirm_label?: string;
  cancel_label?: string;
  display_as_modal?: boolean;
}

/** Conferma generica guidata dal server (testo, intent, tipo azione). */
export interface PendingActionConfirmData {
  confirmation_required?: boolean;
  title?: string;
  body?: string;
  message?: string;
  confirm_label?: string;
  cancel_label?: string;
  intent_id?: string;
  confirm_token?: string;
  action_type?: string;
  display_as_modal?: boolean;
  value?: number;
  weight_kg?: number;
  /** Unità per azioni biometriche (es. cm, in per girovita). */
  unit?: string;
  date?: string;
  /** Profilo: testo intolleranze, merge, date ISO. */
  text?: string;
  merge?: boolean;
  birth_date?: string;
  goal_kg?: number;
  height_cm?: number;
}

export interface RecipeAlternativeData {
  pasto: string;
  nome: string;
  ingredienti: string;
  proteine: number;
  carboidrati: number;
  grassi: number;
  kcal: number;
}
export interface NearbyMenuPick {
  restaurant_name: string;
  menu_item_name: string;
  distance_m?: number | null;
  section?: string | null;
  notes?: string;
  diet_fit_summary?: string;
  cautions?: string[];
  confidence?: number;
}

export interface NearbyMenuAlternative {
  restaurant_name: string;
  menu_item_name: string;
  distance_m?: number | null;
  notes?: string;
}

export interface NearbyRestaurantRecommendationData {
  primary_recommendations: NearbyMenuPick[];
  alternatives?: NearbyMenuAlternative[];
  assistant_summary_hint?: string;
}


export type CardData =
  | { type: 'macro_summary'; data: MacroSummaryData }
  | { type: 'meal_progress'; data: MealProgressData }
  | { type: 'weight_confirm'; data: WeightConfirmData }
  | { type: 'waist_confirm'; data: WaistConfirmData }
  | { type: 'body_fat_confirm'; data: BodyFatConfirmData }
  | { type: 'goal_weight_confirm'; data: GoalWeightConfirmData }
  | { type: 'height_confirm'; data: HeightConfirmData }
  | { type: 'birth_date_confirm'; data: BirthDateConfirmData }
  | { type: 'intolerances_confirm'; data: IntolerancesConfirmData }
  | { type: 'pending_action_confirm'; data: PendingActionConfirmData }
  | { type: 'recipe_alternative'; data: RecipeAlternativeData }
  | { type: 'nearby_restaurant_recommendation'; data: NearbyRestaurantRecommendationData };

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system_log';
  text: string;
  cards: CardData[];
  timestamp: Date;
  /** Correlazione turno/stream dal backend (WebSocket `request_id`). */
  requestId?: string;
  reaction?: MessageReaction | null;
  reactionPending?: boolean;
}

export interface ChatApiResponse {
  text: string;
  cards: CardData[];
  quick_chips?: Array<
    | string
    | {
        label?: string;
        action?: {
          type?: 'navigate' | 'message';
          route?: 'Chat' | 'Dieta' | 'Today' | 'Foto' | 'Profilo' | 'Salute';
          text?: string;
        };
      }
  >;
}
