import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MacroSummaryData } from '../../../types/chat';

type Props = { data: MacroSummaryData };

export function MacroSummaryCard({ data }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Riepilogo macro</Text>
      <View style={styles.inner}>
        <Text style={styles.kcal}>{data.kcal} kcal</Text>
        <Text style={styles.macro}>P {data.proteine}g · C {data.carboidrati}g · G {data.grassi}g</Text>
      </View>
      {data.pasti.map((pasto, idx) => (
        <View key={`${pasto.nome}-${idx}`} style={styles.row}>
          <Text style={styles.rowLabel}>
            {pasto.nome} · {pasto.orario}
          </Text>
          <Text style={styles.rowValue}>{pasto.kcal} kcal</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, width: '88%', marginTop: 4 },
  title: { fontSize: 12, fontWeight: '600', color: '#111', marginBottom: 8 },
  inner: { backgroundColor: '#EDF7F3', borderRadius: 8, padding: 10, marginBottom: 8 },
  kcal: { fontSize: 16, fontWeight: '600', color: '#1D9E75' },
  macro: { marginTop: 3, fontSize: 12, color: '#205548' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontSize: 12, color: '#444' },
  rowValue: { fontSize: 12, color: '#111', fontWeight: '500' },
});
