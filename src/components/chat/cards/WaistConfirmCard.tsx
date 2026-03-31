import React from 'react';
import type { ConfirmChatPayload } from '../../../api/chat';
import type { WaistConfirmData } from '../../../types/chat';
import { ConfirmActionCard } from './ConfirmActionCard';

type Props = {
  data: WaistConfirmData;
  onConfirm: (payload: ConfirmChatPayload) => Promise<void>;
};

/** Conferma girovita: wrapper su ConfirmActionCard con action_type waist. */
export function WaistConfirmCard({ data, onConfirm }: Props) {
  const unit = data.unit === 'in' ? 'in' : 'cm';
  const pending = {
    title: data.title ?? 'Registra circonferenza vita',
    body: data.body,
    confirm_label: data.confirm_label,
    cancel_label: data.cancel_label,
    display_as_modal: data.display_as_modal === true,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
    action_type: 'waist',
    value: data.value,
    unit,
    date: data.data,
  };
  return (
    <ConfirmActionCard
      data={pending}
      onConfirm={onConfirm}
      highlightMetric={data.value}
      metricSuffix={unit}
    />
  );
}
