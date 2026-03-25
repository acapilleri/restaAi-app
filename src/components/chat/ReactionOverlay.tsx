import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MessageReaction } from '../../types/chat';

type Props = {
  open: boolean;
  value: MessageReaction | null | undefined;
  onSelect: (reaction: MessageReaction) => void;
  onClear?: () => void;
};

const REACTIONS: Array<{ key: MessageReaction; emoji: string; label: string }> = [
  { key: 'like', emoji: '❤️', label: 'Metti cuore' },
  { key: 'dislike', emoji: '👎', label: 'Metti non mi piace' },
];

export function ReactionOverlay({ open, value, onSelect, onClear }: Props) {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appear, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [appear, open]);

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        opacity: appear,
        transform: [
          { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
        ],
      },
    ],
    [appear],
  );

  if (!open) return null;

  return (
    <Animated.View style={containerStyle} pointerEvents="box-none">
      <View style={styles.bar} pointerEvents="auto">
        {REACTIONS.map((r) => (
          <Pressable
            key={r.key}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            onPress={() => onSelect(r.key)}
            style={[styles.btn, value === r.key && styles.btnActive]}
            hitSlop={10}
          >
            <Text style={styles.emoji}>{r.emoji}</Text>
          </Pressable>
        ))}
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rimuovi reaction"
            onPress={onClear}
            style={styles.clear}
            hitSlop={10}
          >
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -44,
    alignItems: 'flex-start',
    zIndex: 50,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  btnActive: {
    backgroundColor: 'rgba(29,158,117,0.16)',
  },
  emoji: { fontSize: 18 },
  clear: {
    marginLeft: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  clearText: { fontSize: 18, fontWeight: '700', color: 'rgba(0,0,0,0.55)' },
});

