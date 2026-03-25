import client from './client';

export type MemoryCategory = 'preference' | 'substitution' | 'activity' | 'weight' | 'diet_note';

export type MemoryEntry = {
  id: number;
  content: string;
  category: MemoryCategory;
  importance: number;
  created_at: string;
};

export type MemoriesResponse = {
  memories: MemoryEntry[];
  total: number;
};

export function getMemories(): Promise<MemoriesResponse> {
  return client.get<MemoriesResponse>('/memories').then((r) => r.data);
}

export type CreateMemoryInput = {
  content: string;
  category: MemoryCategory;
  /** 1–5, default 2 */
  importance?: number;
};

/** Crea una memoria lato server (es. preferenza da un “mi piace” su ricetta). */
export function createMemory(input: CreateMemoryInput): Promise<MemoryEntry> {
  return client
    .post<MemoryEntry>('/memories', {
      content: input.content,
      category: input.category,
      importance: input.importance ?? 2,
    })
    .then((r) => r.data);
}
