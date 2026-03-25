import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';

interface StatProps {
  label: string;
  value: string;
  sub: string;
}

export function Stat({ label, value, sub }: StatProps) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#71717a',
  },
  value: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '600',
    color: '#18181b',
  },
  sub: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 4,
  },
});
