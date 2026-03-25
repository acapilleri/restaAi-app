import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface PillProps {
  children: string;
  active?: boolean;
}

export function Pill({ children, active = false }: PillProps) {
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
      <Text style={[styles.text, active ? styles.textActive : styles.textInactive]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  pillActive: {
    backgroundColor: '#d1fae5',
  },
  pillInactive: {
    backgroundColor: '#f4f4f5',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  textActive: {
    color: '#047857',
  },
  textInactive: {
    color: '#52525b',
  },
});
