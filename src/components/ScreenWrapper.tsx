import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

const ACCENTS = {
  emerald: ['#10b981', '#14b8a6'],
  sky: ['#0ea5e9', '#06b6d4'],
  violet: ['#8b5cf6', '#d946ef'],
  amber: ['#f59e0b', '#f97316'],
} as const;

type AccentKey = keyof typeof ACCENTS;

interface ScreenWrapperProps {
  title: string;
  accent?: AccentKey;
  children: React.ReactNode;
}

export function ScreenWrapper({ title, accent = 'emerald', children }: ScreenWrapperProps) {
  const [from, to] = ACCENTS[accent];
  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: from }]}>
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>9:41</Text>
          <Text style={styles.statusText}>AI Diet</Text>
          <Text style={styles.statusText}>100%</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    opacity: 0.9,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
  },
  title: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    padding: 16,
    overflow: 'hidden',
  },
});
