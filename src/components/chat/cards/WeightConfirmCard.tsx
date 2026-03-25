import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WeightConfirmData } from '../../../types/chat';

type Props = {
  data: WeightConfirmData;
  onConfirm: (kg: number) => Promise<void>;
};

export function WeightConfirmCard({ data, onConfirm }: Props) {
  const [state, setState] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');

  if (state === 'confirmed') {
    return (
      <View style={[styles.card, styles.cardConfirmed]}>
        <Text style={styles.confirmedText}>✓ {data.kg.toFixed(1)} kg registrato</Text>
      </View>
    );
  }

  if (state === 'cancelled') {
    return (
      <View style={styles.card}>
        <Text style={styles.cancelledText}>Annullato.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.cardPending]}>
      <Text style={styles.title}>Registra peso oggi</Text>
      <Text style={styles.value}>{data.kg.toFixed(1)} kg</Text>
      <View style={styles.btns}>
        <TouchableOpacity
          style={styles.btnConfirm}
          onPress={async () => {
            await onConfirm(data.kg);
            setState('confirmed');
          }}
        >
          <Text style={styles.btnConfirmText}>Conferma</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancel} onPress={() => setState('cancelled')}>
          <Text style={styles.btnCancelText}>Annulla</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    width: '88%',
    marginTop: 4,
  },
  cardPending: { borderWidth: 1.5, borderColor: '#1D9E75' },
  cardConfirmed: { borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.09)' },
  title: { fontSize: 12, fontWeight: '500', color: '#111', marginBottom: 4 },
  value: { fontSize: 22, fontWeight: '600', color: '#1D9E75', marginBottom: 10 },
  btns: { flexDirection: 'row', gap: 6 },
  btnConfirm: {
    flex: 1,
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  btnConfirmText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  btnCancel: {
    flex: 1,
    backgroundColor: '#F2F1EC',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  btnCancelText: { color: '#555', fontSize: 12 },
  confirmedText: { fontSize: 13, color: '#085041', fontWeight: '500' },
  cancelledText: { fontSize: 12, color: '#888' },
});
