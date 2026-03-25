import client from './client';
import type { RecipeAlternative } from '../types';

export type { RecipeAlternative } from '../types';

export type RecipeAlternativesResponse = {
  recipes: RecipeAlternative[];
  generating?: boolean;
};

export function fetchRecipeAlternatives(): Promise<RecipeAlternativesResponse> {
  return client
    .get<RecipeAlternativesResponse>('/recipes/alternatives')
    .then((r) => r.data);
}
