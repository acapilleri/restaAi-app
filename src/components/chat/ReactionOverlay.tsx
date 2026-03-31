import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MessageReaction } from '../../types/chat';

type Props = {
  open: boolean;
  value: MessageReaction | null | undefined;
  onSelect: (reaction: MessageReaction) => void;
  onClear?: () => void;
  anchorRect?: { x: number; y: number; width: number; height: number } | null;
  onRequestClose?: () => void;
};

const REACTIONS: Array<{ key: MessageReaction; emoji: string; label: string }> = [
  { key: 'like', emoji: '❤️', label: 'Metti cuore' },
  { key: 'dislike', emoji: '👎', label: 'Metti non mi piace' },
];

const SCREEN_PADDING = 12;
const TOOLTIP_HEIGHT = 50;
const TOOLTIP_WIDTH = 160;

export function ReactionOverlay({ open, value, onSelect, onClear, anchorRect, onRequestClose }: Props) {
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

  const positionStyle = useMemo(() => {
    if (!anchorRect) {
      return {
        left: SCREEN_PADDING,
        top: SCREEN_PADDING,
      };
    }
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    const spaceAbove = anchorRect.y - SCREEN_PADDING;
    const spaceBelow = screenHeight - (anchorRect.y + anchorRect.height) - SCREEN_PADDING;
    const showAbove = spaceAbove >= TOOLTIP_HEIGHT || spaceAbove >= spaceBelow;

    const centeredLeft = anchorRect.x + anchorRect.width / 2 - TOOLTIP_WIDTH / 2;
    const left = Math.min(
      Math.max(centeredLeft, SCREEN_PADDING),
      screenWidth - TOOLTIP_WIDTH - SCREEN_PADDING,
    );

    if (showAbove) {
      return {
        left,
        top: Math.max(SCREEN_PADDING, anchorRect.y - TOOLTIP_HEIGHT - 6),
      };
    }

    return {
      left,
      top: Math.min(
        screenHeight - TOOLTIP_HEIGHT - SCREEN_PADDING,
        anchorRect.y + anchorRect.height + 6,
      ),
    };
  }, [anchorRect]);

  if (!open || !positionStyle) return null;

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose} />
      <Animated.View style={[containerStyle, positionStyle]} pointerEvents="box-none">
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  container: {
    position: 'absolute',
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

