import React from 'react';
import type { ConfirmChatPayload } from '../../../api/chat';
import type {
  BirthDateConfirmData,
  GoalWeightConfirmData,
  HeightConfirmData,
  IntolerancesConfirmData,
} from '../../../types/chat';
import { ConfirmActionCard } from './ConfirmActionCard';

type OnConfirm = (payload: ConfirmChatPayload) => Promise<void>;

export function GoalWeightConfirmCard({ data, onConfirm }: { data: GoalWeightConfirmData; onConfirm: OnConfirm }) {
  const pending = {
    title: data.title ?? 'Peso obiettivo',
    body: data.body,
    confirm_label: data.confirm_label,
    cancel_label: data.cancel_label,
    display_as_modal: data.display_as_modal === true,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
    action_type: 'goal_weight',
    value: data.goal_kg,
    goal_kg: data.goal_kg,
    date: data.data,
  };
  return (
    <ConfirmActionCard
      data={pending}
      onConfirm={onConfirm}
      highlightMetric={data.goal_kg}
      metricSuffix="kg"
    />
  );
}

export function HeightConfirmCard({ data, onConfirm }: { data: HeightConfirmData; onConfirm: OnConfirm }) {
  const pending = {
    title: data.title ?? 'Altezza',
    body: data.body,
    confirm_label: data.confirm_label,
    cancel_label: data.cancel_label,
    display_as_modal: data.display_as_modal === true,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
    action_type: 'height',
    value: data.height_cm,
    height_cm: data.height_cm,
    date: data.data,
  };
  return (
    <ConfirmActionCard
      data={pending}
      onConfirm={onConfirm}
      highlightMetric={data.height_cm}
      metricSuffix="cm"
    />
  );
}

export function BirthDateConfirmCard({ data, onConfirm }: { data: BirthDateConfirmData; onConfirm: OnConfirm }) {
  const pending = {
    title: data.title ?? 'Data di nascita',
    body: data.body,
    confirm_label: data.confirm_label,
    cancel_label: data.cancel_label,
    display_as_modal: data.display_as_modal === true,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
    action_type: 'birth_date',
    birth_date: data.birth_date,
    date: data.data,
  };
  return <ConfirmActionCard data={pending} onConfirm={onConfirm} />;
}

export function IntolerancesConfirmCard({ data, onConfirm }: { data: IntolerancesConfirmData; onConfirm: OnConfirm }) {
  const pending = {
    title: data.title ?? 'Intolleranze',
    body: data.body,
    confirm_label: data.confirm_label,
    cancel_label: data.cancel_label,
    display_as_modal: data.display_as_modal === true,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
    action_type: 'intolerances',
    text: data.text,
    merge: data.merge !== false,
    date: data.data,
  };
  return <ConfirmActionCard data={pending} onConfirm={onConfirm} />;
}
