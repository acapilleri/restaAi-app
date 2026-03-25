import client from './client';

export function sendMessage(message: string): Promise<void> {
  return client
    .post('/chat', {
      message,
    })
    .then(() => undefined);
}

export type ReactionType = 'like' | 'dislike' | null;

export type ReactionResponse = {
  ok: boolean;
  message_id: string | number;
  reaction: ReactionType;
};

export function setMessageReaction(params: {
  message_id: string;
  reaction: ReactionType;
  conversation_id?: string;
}): Promise<ReactionResponse> {
  return client
    .post<ReactionResponse>('/chat/reaction', params)
    .then((r) => r.data);
}

export type ChatHistoryItem = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards: [];
  timestamp: string;
  reaction?: ReactionType;
};

export type ChatHistoryResponse = {
  messages: ChatHistoryItem[];
  page: {
    limit: number;
    has_more: boolean;
    next_before_id: string | null;
  };
};

export function getChatHistory(params?: {
  limit?: number;
  before_id?: string;
}): Promise<ChatHistoryResponse> {
  return client
    .get<ChatHistoryResponse>('/chat/history', { params })
    .then((r) => r.data);
}

export type ConfirmResponse = {
  saved: boolean;
  comment: string;
  progress: number;
  weight_lost: number;
  timestamp: string;
};

export function confirmWeight(kg: number): Promise<ConfirmResponse> {
  return client
    .post<ConfirmResponse>('/chat/confirm', {
      type: 'weight',
      value: kg,
      date: new Date().toISOString().slice(0, 10),
    })
    .then((r) => r.data);
}

// --- Briefing (risposta sempre strutturata dal backend)
export type BriefingContext = {
  weight: number;
  target: number;
  progress: number;
  plan_day: string;
};

export type BriefingResponse = {
  message: string;
  highlight: string;
  suggestion_today: string;
  quick_chips: string[];
  generated_at: string;
  context: BriefingContext;
};

const DEFAULT_BRIEFING: BriefingResponse = {
  message: '',
  highlight: '',
  suggestion_today: 'Nessun suggerimento per oggi.',
  quick_chips: [],
  generated_at: new Date().toISOString(),
  context: { weight: 0, target: 0, progress: 0, plan_day: '' },
};

export function getBriefing(): Promise<BriefingResponse> {
  return client
    .get<BriefingResponse>('/chat/briefing')
    .then((r) => r.data)
    .then((d) => ({
      ...DEFAULT_BRIEFING,
      ...d,
      quick_chips: Array.isArray(d.quick_chips) ? d.quick_chips : [],
      context: d.context ?? DEFAULT_BRIEFING.context,
    }));
}
