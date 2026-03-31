import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ConfirmChatPayload } from '../../../api/chat';
import { useTheme } from '../../../context/ThemeContext';
import type { PendingActionConfirmData } from '../../../types/chat';
import { ChatMarkdown } from '../ChatMarkdown';

type Props = {
  data: PendingActionConfirmData;
  onConfirm: (payload: ConfirmChatPayload) => Promise<void>;
  /** Valore principale da evidenziare (es. peso in kg). */
  highlightMetric?: number;
  metricSuffix?: string;
  /** Se true, il markdown nel body è interpretato come tale. */
  bodyIsMarkdown?: boolean;
};

function buildPayload(data: PendingActionConfirmData): ConfirmChatPayload {
  const date =
    typeof data.date === 'string' && data.date
      ? data.date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const rawVal = data.weight_kg ?? data.value;
  const value = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : undefined;
  const action = data.action_type ?? 'weight';
  const payload: ConfirmChatPayload = {
    type: action,
    value,
    date,
    unit: typeof data.unit === 'string' && data.unit ? data.unit : undefined,
    intent_id: data.intent_id,
    confirm_token: data.confirm_token,
  };
  if (typeof data.text === 'string' && data.text) payload.text = data.text;
  if (data.merge != null) payload.merge = data.merge;
  if (typeof data.birth_date === 'string' && data.birth_date) payload.birth_date = data.birth_date.slice(0, 10);
  if (typeof data.goal_kg === 'number' && Number.isFinite(data.goal_kg)) payload.goal_kg = data.goal_kg;
  if (typeof data.height_cm === 'number' && Number.isFinite(data.height_cm)) payload.height_cm = data.height_cm;
  return payload;
}

export function ConfirmActionCard({
  data,
  onConfirm,
  highlightMetric,
  metricSuffix,
  bodyIsMarkdown = false,
}: Props) {
  const { colors } = useTheme();
  const [state, setState] = useState<'pending' | 'confirmed' | 'cancelled' | 'error'>('pending');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const useModal = data.display_as_modal === true;

  const title =
    data.title?.trim() ||
    data.message?.trim() ||
    'Conferma';
  const bodyText = data.body?.trim() || '';
  const confirmLabel = data.confirm_label?.trim() || 'Conferma';
  const cancelLabel = data.cancel_label?.trim() || 'Annulla';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.cardBackground,
          borderRadius: 14,
          padding: 12,
          width: '88%',
          marginTop: 4,
          borderWidth: 1,
          borderColor: colors.chatBubbleBorder,
        },
        cardPending: { borderWidth: 1.5, borderColor: colors.primary },
        cardConfirmed: { borderColor: colors.border },
        title: { fontSize: 12, fontWeight: '500', color: colors.textPrimary, marginBottom: 4 },
        body: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
        metric: {
          fontSize: 22,
          fontWeight: '600',
          color: colors.primary,
          marginBottom: 10,
        },
        btns: { flexDirection: 'row', gap: 6 },
        btnConfirm: {
          flex: 1,
          backgroundColor: colors.primary,
          borderRadius: 8,
          padding: 8,
          alignItems: 'center',
          minHeight: 40,
          justifyContent: 'center',
        },
        btnConfirmText: { color: colors.textOnPrimary, fontSize: 12, fontWeight: '500' },
        btnCancel: {
          flex: 1,
          backgroundColor: colors.bgSecondary,
          borderRadius: 8,
          padding: 8,
          alignItems: 'center',
        },
        btnCancelText: { color: colors.textSecondary, fontSize: 12 },
        confirmedText: { fontSize: 13, color: colors.primaryDark, fontWeight: '500' },
        cancelledText: { fontSize: 12, color: colors.textMuted },
        errorText: { fontSize: 12, color: colors.amber, marginTop: 6 },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        },
        modalCard: {
          backgroundColor: colors.cardBackground,
          borderRadius: 16,
          padding: 16,
          width: '100%',
          maxWidth: 360,
          borderWidth: 1,
          borderColor: colors.border,
        },
      }),
    [colors],
  );

  const handleConfirm = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      const payload = buildPayload(data);
      await onConfirm(payload);
      setState('confirmed');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Operazione non riuscita';
      setErrorText(msg);
      setState('error');
    } finally {
      setSubmitting(false);
    }
  }, [data, onConfirm, submitting]);

  const handleCancel = useCallback(() => {
    setState('cancelled');
  }, []);

  if (state === 'confirmed') {
    return (
      <View style={[styles.card, styles.cardConfirmed]}>
        <Text style={styles.confirmedText}>✓ {title}</Text>
      </View>
    );
  }

  if (state === 'cancelled') {
    return (
      <View style={styles.card}>
        <Text style={styles.cancelledText}>Annullato.</Text>
      </View>
    );
  }

  const innerContent = (
    <>
      <Text style={styles.title}>{title}</Text>
      {highlightMetric != null && Number.isFinite(highlightMetric) ? (
        <Text style={styles.metric}>
          {highlightMetric.toFixed(1)}
          {metricSuffix ? ` ${metricSuffix}` : ''}
        </Text>
      ) : null}
      {bodyText ? (
        bodyIsMarkdown ? (
          <ChatMarkdown text={bodyText} isUser={false} />
        ) : (
          <Text style={styles.body}>{bodyText}</Text>
        )
      ) : null}
      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
      <View style={styles.btns}>
        <TouchableOpacity
          style={styles.btnConfirm}
          onPress={handleConfirm}
          disabled={submitting}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.textOnPrimary} size="small" />
          ) : (
            <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnCancel}
          onPress={handleCancel}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.btnCancelText}>{cancelLabel}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  /** Overlay modale: chiusura solo da Conferma / Annulla. */
  if (useModal && (state === 'pending' || state === 'error')) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>{innerContent}</View>
        </View>
      </Modal>
    );
  }

  return <View style={[styles.card, styles.cardPending]}>{innerContent}</View>;
}
