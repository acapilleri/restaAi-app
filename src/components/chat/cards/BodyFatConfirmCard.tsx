import React from 'react';
import type { ConfirmChatPayload } from '../../../api/chat';
import type { BodyFatConfirmData } from '../../../types/chat';
import { ConfirmActionCard } from './ConfirmActionCard';

type Props = {
  data: BodyFatConfirmData;
  onConfirm: (payload: ConfirmChatPayload) => Promise<void>;
};

/** Conferma % massa grassa: wrapper su ConfirmActionCard con action_type body_fat. */
export function BodyFatConfirmCard({ data, onConfirm }: Props) {
  const pending = {
    title: data.title ?? 'Registra massa grassa',
    body: data.body,
    confirm_label: data.confirm_label,
    cancel_label: data.cancel_label,
    display_as_modal: data.display_as_modal === true,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
    action_type: 'body_fat',
    value: data.value_percent,
    date: data.data,
  };
  return (
    <ConfirmActionCard
      data={pending}
      onConfirm={onConfirm}
      highlightMetric={data.value_percent}
      metricSuffix="%"
    />
  );
}
