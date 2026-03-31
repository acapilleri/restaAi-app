import client from './client';
import type { AppleHealthSnapshotPayloadWire } from '../services/appleHealth';

export type SendMessageOptions = {
  health_data?: AppleHealthSnapshotPayloadWire | null;
};

export function sendMessage(message: string, options?: SendMessageOptions): Promise<void> {
  const body: { message: string; health_data?: AppleHealthSnapshotPayloadWire } = { message };
  if (options?.health_data != null) {
    body.health_data = options.health_data;
  }
  return client.post('/chat', body).then(() => undefined);
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
  role: 'user' | 'assistant' | 'system_log';
  text: string;
  /** Card strutturate (JSON); il client le normalizza con `parseCardsFromHistory`. */
  cards?: unknown[] | null;
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

/**
 * Corpo per `POST /chat/confirm`.
 * Il server deve: (1) non applicare effetti irreversibili su `POST /chat` se serve conferma;
 * (2) restituire card `weight_confirm`, `waist_confirm`, `body_fat_confirm` o `pending_action_confirm` con testo/labels opzionali;
 * (3) risolvere l’azione pendente tramite `intent_id` / `confirm_token` quando presenti,
 * oppure `type` + `value` + `date` per compatibilità peso.
 */
export type ConfirmChatPayload = {
  type?: string;
  value?: number;
  date?: string;
  /** Unità biometrica (es. cm, in) per type waist. */
  unit?: string;
  intent_id?: string;
  confirm_token?: string;
  /** Profilo / intolleranze: stessi campi che legge `Confirm::Handler`. */
  text?: string;
  merge?: boolean;
  birth_date?: string;
  goal_kg?: number;
  height_cm?: number;
};

export function confirmChatAction(payload: ConfirmChatPayload): Promise<ConfirmResponse> {
  const body: Record<string, unknown> = {};
  if (payload.type != null) body.type = payload.type;
  if (payload.value != null && Number.isFinite(payload.value)) body.value = payload.value;
  if (payload.date != null) body.date = payload.date;
  if (payload.unit != null) body.unit = payload.unit;
  if (payload.intent_id != null) body.intent_id = payload.intent_id;
  if (payload.confirm_token != null) body.confirm_token = payload.confirm_token;
  if (payload.text != null) body.text = payload.text;
  if (payload.merge != null) body.merge = payload.merge;
  if (payload.birth_date != null) body.birth_date = payload.birth_date;
  if (payload.goal_kg != null && Number.isFinite(payload.goal_kg)) body.goal_kg = payload.goal_kg;
  if (payload.height_cm != null && Number.isFinite(payload.height_cm)) body.height_cm = payload.height_cm;
  return client.post<ConfirmResponse>('/chat/confirm', body).then((r) => r.data);
}

export function confirmWeight(kg: number): Promise<ConfirmResponse> {
  return confirmChatAction({
    type: 'weight',
    value: kg,
    date: new Date().toISOString().slice(0, 10),
  });
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
