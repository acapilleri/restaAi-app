export type MealType = 'colazione' | 'pranzo' | 'spuntino' | 'cena';

export interface RecipeAlternative {
  id: number;
  meal_type: MealType;
  name: string;
  ingredients: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export * from './chat';
