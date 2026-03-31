import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface PillProps {
  children: string;
  active?: boolean;
}

export function Pill({ children, active = false }: PillProps) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 9999,
        },
        pillActive: {
          backgroundColor: colors.greenPill,
        },
        pillInactive: {
          backgroundColor: colors.bgSecondary,
        },
        text: {
          fontSize: 12,
          fontWeight: '500',
        },
        textActive: {
          color: colors.primaryDarkLabel,
        },
        textInactive: {
          color: colors.textSecondary,
        },
      }),
    [colors],
  );
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
      <Text style={[styles.text, active ? styles.textActive : styles.textInactive]}>{children}</Text>
    </View>
  );
}
