import client from './client';
import type { AppleHealthSnapshotPayload, AppleHealthSnapshotPayloadWire } from '../services/appleHealth';

/** Opzionale: inviato con POST /chat quando serve Just Eat / ristoranti vicini. */
export type LocationContext = {
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  captured_at?: string;
};

/** Compatto per il modello + `raw_data` completo (stesso schema degli snapshot server). */
export type ChatHealthDataPayload = AppleHealthSnapshotPayloadWire & {
  recorded_at?: string;
  raw_data?: AppleHealthSnapshotPayload;
};

export type SendMessageOptions = {
  health_data?: ChatHealthDataPayload | null;
  location_context?: LocationContext | null;
};

export function sendMessage(message: string, options?: SendMessageOptions): Promise<void> {
  const body: {
    message: string;
    health_data?: ChatHealthDataPayload;
    location_context?: LocationContext;
  } = { message };
  if (options?.health_data != null) {
    body.health_data = options.health_data;
  }
  if (options?.location_context != null) {
    body.location_context = options.location_context;
  }
  return client.post('/chat', body).then(() => undefined);
}

export type ReactionType = 'like' | 'dislike' | null;

export type ReactionResponse = {
  ok: boolean;
  /** Id persistito del messaggio; può essere omesso se il server risolve solo per request_id. */
  message_id?: string | number;
  reaction: ReactionType;
};

export type SetMessageReactionParams =
  | {
      message_id: string;
      request_id?: undefined;
      reaction: ReactionType;
      conversation_id?: string;
    }
  | {
      request_id: string;
      message_id?: undefined;
      reaction: ReactionType;
      conversation_id?: string;
    };

export function setMessageReaction(params: SetMessageReactionParams): Promise<ReactionResponse> {
  const body: Record<string, unknown> = { reaction: params.reaction };
  if ('message_id' in params && params.message_id != null) {
    body.message_id = params.message_id;
  }
  if ('request_id' in params && params.request_id != null) {
    body.request_id = params.request_id;
  }
  if (params.conversation_id != null) {
    body.conversation_id = params.conversation_id;
  }
  return client
    .post<ReactionResponse>('/chat/reaction', body)
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
  request_id?: string | null;
};

export type QuickChipAction =
  | { type: 'navigate'; route: 'Chat' | 'Dieta' | 'Today' | 'Foto' | 'Profilo' | 'Salute' }
  | { type: 'message'; text: string };

export type QuickChip = {
  label: string;
  action?: QuickChipAction;
};

export type QuickChipWire =
  | string
  | {
      label?: unknown;
      action?: {
        type?: unknown;
        route?: unknown;
        text?: unknown;
      } | null;
    };

function normalizeQuickChip(item: QuickChipWire): QuickChip | null {
  if (typeof item === 'string') {
    const label = item.trim();
    if (!label) return null;
    return { label, action: { type: 'message', text: label } };
  }
  if (!item || typeof item !== 'object') return null;
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  if (!label) return null;
  const action = item.action;
  if (!action || typeof action !== 'object') {
    return { label, action: { type: 'message', text: label } };
  }
  if (action.type === 'navigate') {
    const route = action.route;
    if (
      route === 'Chat' ||
      route === 'Dieta' ||
      route === 'Today' ||
      route === 'Foto' ||
      route === 'Profilo' ||
      route === 'Salute'
    ) {
      return { label, action: { type: 'navigate', route } };
    }
    return { label, action: { type: 'message', text: label } };
  }
  if (action.type === 'message') {
    const text = typeof action.text === 'string' ? action.text.trim() : '';
    return { label, action: { type: 'message', text: text || label } };
  }
  return { label, action: { type: 'message', text: label } };
}

export type ChatHistoryResponse = {
  messages: ChatHistoryItem[];
  page: {
    limit: number;
    has_more: boolean;
    next_before_id: string | null;
  };
  quick_chips?: QuickChip[];
};

export function getChatHistory(params?: {
  limit?: number;
  before_id?: string;
}): Promise<ChatHistoryResponse> {
  return client
    .get<ChatHistoryResponse>('/chat/history', { params })
    .then((r) => r.data)
    .then((d) => {
      if (!Object.prototype.hasOwnProperty.call(d, 'quick_chips')) return d;
      const raw = Array.isArray(d.quick_chips) ? (d.quick_chips as QuickChipWire[]) : [];
      const normalized = raw
        .map((x) => normalizeQuickChip(x))
        .filter((x): x is QuickChip => x != null);
      return {
        ...d,
        quick_chips: normalized,
      };
    });
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
