import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { createMemory } from '../../../api/memories';
import { RecipeLikeButton } from '../../RecipeLikeButton';
import type { RecipeAlternativeData } from '../../../types/chat';
import { hapticSuccess } from '../../../utils/haptics';

type Props = { data: RecipeAlternativeData };

export function RecipeAlternativeCard({ data }: Props) {
  const [liked, setLiked] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLike = useCallback(async () => {
    if (liked || saving) return;
    setSaving(true);
    try {
      await createMemory({
        category: 'preference',
        importance: 2,
        content: [
          `Mi piace la ricetta alternativa «${data.nome}» (${data.pasto}) — chat.`,
          `${data.kcal} kcal, P ${data.proteine}g C ${data.carboidrati}g G ${data.grassi}g.`,
          `Ingredienti: ${data.ingredienti}`,
        ].join(' '),
      });
      hapticSuccess();
      setLiked(true);
    } catch (e) {
      Alert.alert(
        'Non salvato',
        e instanceof Error ? e.message : 'Impossibile salvare tra le memorie. Riprova.',
      );
    } finally {
      setSaving(false);
    }
  }, [liked, saving, data]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Alternativa {data.pasto}</Text>
        <RecipeLikeButton liked={liked} loading={saving} onPress={handleLike} />
      </View>
      <Text style={styles.name}>{data.nome}</Text>
      <Text style={styles.ingredients}>{data.ingredienti}</Text>
      <View style={styles.inner}>
        <Text style={styles.macro}>P {data.proteine}g</Text>
        <Text style={styles.macro}>C {data.carboidrati}g</Text>
        <Text style={styles.macro}>G {data.grassi}g</Text>
        <Text style={styles.kcal}>{data.kcal} kcal</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, width: '88%', marginTop: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: { fontSize: 12, fontWeight: '600', color: '#111', flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#1D9E75', marginBottom: 6 },
  ingredients: { fontSize: 12, color: '#444', lineHeight: 18, marginBottom: 8 },
  inner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#EDF7F3',
    borderRadius: 8,
    padding: 8,
  },
  macro: { fontSize: 12, color: '#205548' },
  kcal: { fontSize: 12, color: '#111', fontWeight: '600' },
});
