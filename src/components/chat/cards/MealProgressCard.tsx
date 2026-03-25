import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MealProgressData } from '../../../types/chat';

type Props = { data: MealProgressData };

export function MealProgressCard({ data }: Props) {
  const pct = Math.max(0, Math.min(100, data.percentuale));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Progresso giornata</Text>
      <Text style={styles.kcal}>
        {data.kcal_consumate}/{data.kcal_totali} kcal
      </Text>
      <View style={styles.track}>
        <View style={[styles.progress, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.next}>
        Prossimo pasto: {data.prossimo_pasto} alle {data.orario_prossimo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, width: '88%', marginTop: 4 },
  title: { fontSize: 12, fontWeight: '600', color: '#111', marginBottom: 6 },
  kcal: { fontSize: 13, color: '#205548', marginBottom: 8 },
  track: { backgroundColor: '#EDF7F3', borderRadius: 8, height: 8, overflow: 'hidden' },
  progress: { backgroundColor: '#1D9E75', height: 8, borderRadius: 8 },
  next: { fontSize: 12, color: '#444', marginTop: 8 },
});
