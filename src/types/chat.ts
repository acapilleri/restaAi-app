export type CardType =
  | 'macro_summary'
  | 'meal_progress'
  | 'weight_confirm'
  | 'recipe_alternative';

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

export interface WeightConfirmData {
  kg: number;
  data: string;
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

export type CardData =
  | { type: 'macro_summary'; data: MacroSummaryData }
  | { type: 'meal_progress'; data: MealProgressData }
  | { type: 'weight_confirm'; data: WeightConfirmData }
  | { type: 'recipe_alternative'; data: RecipeAlternativeData };

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards: CardData[];
  timestamp: Date;
  reaction?: MessageReaction | null;
  reactionPending?: boolean;
}

export interface ChatApiResponse {
  text: string;
  cards: CardData[];
  quick_chips?: string[];
}
