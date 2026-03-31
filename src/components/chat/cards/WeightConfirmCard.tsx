import React from 'react';
import type { ConfirmChatPayload } from '../../../api/chat';
import type { WeightConfirmData } from '../../../types/chat';
import { ConfirmActionCard } from './ConfirmActionCard';

type Props = {
  data: WeightConfirmData;
  onConfirm: (payload: ConfirmChatPayload) => Promise<void>;
};

/** Conferma peso: wrapper su ConfirmActionCard con default e action_type weight. */
export function WeightConfirmCard({ data, onConfirm }: Props) {
  const pending = {
    title: data.title ?? 'Registra peso oggi',
    body: data.body,
    confirm_label: data.confirm_label,
    cancel_label: data.cancel_label,
    display_as_modal: data.display_as_modal === true,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
    action_type: 'weight',
    weight_kg: data.kg,
    date: data.data,
  };
  return (
    <ConfirmActionCard
      data={pending}
      onConfirm={onConfirm}
      highlightMetric={data.kg}
      metricSuffix="kg"
    />
  );
}
