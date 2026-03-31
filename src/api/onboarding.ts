import client from './client';
import type { OnboardingYcStep } from '../onboarding/stepsYc';

export type OnboardingConfigResponse = {
  menu_chip: string;
  steps: OnboardingYcStep[];
};

export type CreateOnboardingMessagePayload = {
  message: string;
  client_message_id?: string;
  conversation_id?: string;
  step_label?: string;
  step_index?: number;
  total_steps?: number;
  flow?: string;
  source?: string;
};

export type CreateOnboardingMessageResponse = {
  ok: boolean;
  delivered: boolean;
  request_id: string;
  conversation_id: string | null;
};

function normalizeStep(raw: unknown): OnboardingYcStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label : '';
  const coach = typeof o.coach === 'string' ? o.coach : '';
  const chips = Array.isArray(o.chips) ? o.chips.filter((c): c is string => typeof c === 'string') : [];
  const extract =
    o.extract === null || o.extract === undefined
      ? null
      : typeof o.extract === 'string'
        ? o.extract
        : null;
  if (!label || !coach || chips.length === 0) return null;
  return { label, coach, chips, extract };
}

/**
 * Configurazione copy onboarding (step coach, chip, menu). Richiede JWT.
 */
export async function getOnboardingConfig(): Promise<OnboardingConfigResponse> {
  const { data } = await client.get<OnboardingConfigResponse>('/onboarding');
  const menu_chip = typeof data?.menu_chip === 'string' ? data.menu_chip.trim() : '';
  const stepsRaw = Array.isArray(data?.steps) ? data.steps : [];
  const steps = stepsRaw.map(normalizeStep).filter((s): s is OnboardingYcStep => s != null);
  if (!menu_chip || steps.length === 0) {
    throw new Error('Risposta onboarding non valida');
  }
  return { menu_chip, steps };
}

/**
 * Invia l'ultimo messaggio onboarding con metadata contestuali.
 */
export async function createOnboardingMessage(
  payload: CreateOnboardingMessagePayload,
): Promise<CreateOnboardingMessageResponse> {
  const message = payload.message.trim();
  if (!message) {
    throw new Error('Messaggio onboarding vuoto');
  }

  const body: CreateOnboardingMessagePayload = {
    message,
    ...(payload.client_message_id ? { client_message_id: payload.client_message_id } : {}),
    ...(payload.conversation_id ? { conversation_id: payload.conversation_id } : {}),
    ...(payload.step_label ? { step_label: payload.step_label } : {}),
    ...(Number.isInteger(payload.step_index) ? { step_index: payload.step_index } : {}),
    ...(Number.isInteger(payload.total_steps) ? { total_steps: payload.total_steps } : {}),
    ...(payload.flow ? { flow: payload.flow } : {}),
    ...(payload.source ? { source: payload.source } : {}),
  };

  const { data } = await client.post<CreateOnboardingMessageResponse>('/onboarding', body);
  return data;
}
