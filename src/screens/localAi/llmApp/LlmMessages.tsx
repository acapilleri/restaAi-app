/**
 * Cronologia + streaming: con token mostriamo Text + spinner (come bare_rn).
 * Con isGenerating ma response ancora vuoto mostriamo una riga compatta “in attesa”
 * (altrimenti la chat sembra bloccata durante il prefill).
 */

import React, { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Message } from 'react-native-executorch';
import { useTheme } from '../../../context/ThemeContext';
import { FormattedParagraphs } from '../shared';
import { LlmMessageItem } from './LlmMessageItem';

export type LlmMessagesProps = {
  chatHistory: Message[];
  llmResponse: string;
  isGenerating: boolean;
  deleteMessage: (index: number) => void;
  emptyHint?: ReactNode;
  isReady?: boolean;
};

export function LlmMessages({
  chatHistory,
  llmResponse,
  isGenerating,
  deleteMessage,
  emptyHint,
  isReady,
}: LlmMessagesProps) {
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToEnd = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(scrollToEnd);
    return () => cancelAnimationFrame(id);
  }, [chatHistory.length, isGenerating, llmResponse, scrollToEnd]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chatContainer: { flex: 1, width: '100%' },
        scroll: { flex: 1 },
        scrollContent: { paddingHorizontal: 12, paddingTop: 18, paddingBottom: 34, flexGrow: 1 },
        streamBubble: {
          flexDirection: 'column',
          alignItems: 'stretch',
          maxWidth: '92%',
          alignSelf: 'flex-start',
          width: '92%',
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          marginBottom: 8,
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.chatBubbleBorder,
          ...(Platform.OS === 'ios'
            ? {
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 3,
              }
            : { elevation: 1 }),
        },
        streamText: {
          width: '100%',
          fontSize: 17,
          lineHeight: 26,
          letterSpacing: 0.15,
          color: colors.textPrimary,
        },
        streamSpinnerRow: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: 8,
        },
        pendingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          maxWidth: '80%',
          alignSelf: 'flex-start',
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          marginBottom: 8,
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.chatBubbleBorder,
        },
        pendingHint: {
          fontSize: 14,
          color: colors.textSecondary,
        },
      }),
    [colors],
  );

  const showEmpty = isReady && chatHistory.length === 0 && !isGenerating && emptyHint;
  const hasStreamText = llmResponse.trim().length > 0;
  const showStreamRow = isGenerating && hasStreamText;
  const showPendingRow = isGenerating && !hasStreamText;

  return (
    <View style={styles.chatContainer}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToEnd}
        showsVerticalScrollIndicator
        removeClippedSubviews={false}
      >
        <View onStartShouldSetResponder={() => true}>
          {showEmpty ? emptyHint : null}
          {chatHistory.map((message, index) => (
            <LlmMessageItem key={`${index}-${message.role}-${message.content.slice(0, 24)}`} message={message} deleteMessage={() => deleteMessage(index)} />
          ))}
          {showPendingRow ? (
            <View style={styles.pendingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.pendingHint}>Sto pensando…</Text>
            </View>
          ) : null}
          {showStreamRow ? (
            <View style={styles.streamBubble}>
              <FormattedParagraphs text={llmResponse} style={styles.streamText} />
              <View style={styles.streamSpinnerRow}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
