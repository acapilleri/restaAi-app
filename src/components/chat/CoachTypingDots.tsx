import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export function CoachTypingDots() {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        typingBubble: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: colors.bgCard,
          borderRadius: 18,
          borderBottomLeftRadius: 5,
          borderWidth: 1,
          borderColor: colors.chatBubbleBorder,
          paddingVertical: 12,
          paddingHorizontal: 15,
          ...Platform.select({
            ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
            android: { elevation: 1 },
          }),
        },
        typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
      }),
    [colors],
  );

  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (v: Animated.Value, ofs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(ofs),
          Animated.timing(v, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      );
    const l1 = anim(a, 0);
    const l2 = anim(b, 150);
    const l3 = anim(c, 300);
    l1.start();
    l2.start();
    l3.start();
    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
    };
  }, [a, b, c]);

  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: [
      {
        translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
      },
    ],
  });

  return (
    <View style={styles.typingBubble}>
      <Animated.View style={[styles.typingDot, dotStyle(a)]} />
      <Animated.View style={[styles.typingDot, dotStyle(b)]} />
      <Animated.View style={[styles.typingDot, dotStyle(c)]} />
    </View>
  );
}
