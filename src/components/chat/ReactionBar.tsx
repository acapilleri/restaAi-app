import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MessageReaction } from '../../types/chat';

type Props = {
  value: MessageReaction | null | undefined;
  onSelect: (reaction: MessageReaction) => void;
  onClear?: () => void;
};

export function ReactionBar({ value, onSelect, onClear }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Metti like"
        onPress={() => onSelect('like')}
        style={[styles.pill, value === 'like' && styles.pillActive]}
        hitSlop={10}
      >
        <Text style={styles.emoji}>👍</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Metti non mi piace"
        onPress={() => onSelect('dislike')}
        style={[styles.pill, value === 'dislike' && styles.pillActive]}
        hitSlop={10}
      >
        <Text style={styles.emoji}>👎</Text>
      </Pressable>
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rimuovi reaction"
          onPress={onClear}
          style={styles.clear}
          hitSlop={10}
        >
          <Text style={styles.clearText}>Rimuovi</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillActive: {
    backgroundColor: 'rgba(29,158,117,0.16)',
  },
  emoji: {
    fontSize: 16,
  },
  clear: {
    marginLeft: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.55)',
    fontWeight: '600',
  },
});

