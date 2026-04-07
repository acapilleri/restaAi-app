/**
 * Adattamento di apps/llm/components/MessageItem.tsx (icona coach al posto di Llama SVG).
 */

import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, Platform } from 'react-native';
import type { Message } from 'react-native-executorch';
import { useTheme } from '../../../context/ThemeContext';
import { FormattedParagraphs } from '../shared';

const COACH_ICON = require('../../../../assets/resta-coach-icon.png');

type Props = {
  message: Message;
  deleteMessage: () => void;
};

function CloseButton({ deleteMessage, role }: { deleteMessage: () => void; role: string }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.closeButton,
        { backgroundColor: colors.suggestionBorder },
        role === 'assistant' ? styles.closeButtonRight : styles.closeButtonLeft,
      ]}
      onPress={deleteMessage}
      accessibilityLabel="Elimina messaggio e seguenti"
    >
      <Text style={[styles.buttonText, { color: colors.textPrimary }]}>✕</Text>
    </TouchableOpacity>
  );
}

export const LlmMessageItem = memo(function LlmMessageItem({ message, deleteMessage }: Props) {
  const { colors } = useTheme();

  if (message.role === 'system') {
    return null;
  }

  if (message.role === 'assistant' && !String(message.content ?? '').trim()) {
    return null;
  }

  if (message.role === 'assistant') {
    return (
      <View style={styles.aiColumn}>
        <View style={styles.aiTopRow}>
          <View style={[styles.aiMessageIconContainer, { backgroundColor: colors.greenPill }]}>
            <Image source={COACH_ICON} style={styles.aiIconImage} resizeMode="cover" />
          </View>
          <CloseButton deleteMessage={deleteMessage} role={message.role} />
        </View>
        <View style={styles.aiBody}>
          <FormattedParagraphs text={message.content} style={[styles.textAiBase, { color: colors.textPrimary }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.userMessageWrapper}>
      <CloseButton deleteMessage={deleteMessage} role={message.role} />
      <View style={[styles.userMessageBubble, { backgroundColor: colors.primary }]}>
        {message.mediaPath ? (
          <Image source={{ uri: message.mediaPath }} style={styles.userMessageImage} resizeMode="contain" />
        ) : null}
        <FormattedParagraphs
          text={message.content}
          style={[styles.textUserBase, { color: colors.textOnPrimary }]}
          textAlign="right"
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  /** Testo sotto icona+✕: larghezza piena, niente Text compresso in una flex row (RN taglia le parole). */
  aiColumn: {
    maxWidth: '92%',
    alignSelf: 'flex-start',
    marginVertical: 8,
    width: '92%',
  },
  aiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  aiBody: {
    width: '100%',
    paddingLeft: 0,
  },
  textAiBase: {
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.15,
  },
  textUserBase: {
    fontSize: 17,
    lineHeight: 26,
    letterSpacing: 0.15,
  },
  userMessageWrapper: {
    flexDirection: 'row-reverse',
    marginRight: 8,
    marginVertical: 8,
    maxWidth: '75%',
    alignSelf: 'flex-end',
    alignItems: 'flex-start',
  },
  userMessageBubble: {
    maxWidth: '100%',
    minWidth: 0,
    flexShrink: 1,
    flexDirection: 'column',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  userMessageImage: {
    width: 200,
    height: 200,
    borderRadius: 6,
    marginBottom: 6,
  },
  aiMessageIconContainer: {
    height: 32,
    width: 32,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginHorizontal: 7,
    overflow: 'hidden',
  },
  aiIconImage: { width: 32, height: 32 },
  closeButton: {
    flexShrink: 0,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
  },
  closeButtonRight: {
    marginLeft: 8,
    alignSelf: 'center',
  },
  closeButtonLeft: {
    marginRight: 8,
  },
  buttonText: {
    fontSize: Platform.OS === 'ios' ? 16 : 14,
  },
});
