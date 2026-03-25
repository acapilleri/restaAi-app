import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { createMemory } from '../api/memories';
import { RecipeLikeButton } from './RecipeLikeButton';
import { hapticSuccess } from '../utils/haptics';

const MEAL_LABELS: Record<string, string> = {
  colazione: 'Colazione',
  pranzo: 'Pranzo',
  spuntino: 'Spuntino',
  cena: 'Cena',
};

type Props = {
  recipeId: number;
  mealType: string;
  name: string;
  ingredients: string;
  protein: number;
  carbs: number;
  fat: number;
};

export function RecipeAlternativeCard({
  recipeId,
  mealType,
  name,
  ingredients,
  protein,
  carbs,
  fat,
}: Props) {
  const label = MEAL_LABELS[mealType] ?? mealType;
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
          `Mi piace la ricetta alternativa «${name}» (${label}) — id #${recipeId}.`,
          `Macro: P ${protein}g, C ${carbs}g, G ${fat}g.`,
          `Ingredienti: ${ingredients}`,
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
  }, [liked, saving, name, label, recipeId, protein, carbs, fat, ingredients]);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{label.toUpperCase()}</Text>
        </View>
        <RecipeLikeButton liked={liked} loading={saving} onPress={handleLike} />
      </View>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      <Text style={styles.ingredients} numberOfLines={3}>{ingredients}</Text>
      <View style={styles.macroRow}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.macroText}>
          P {protein}g C {carbs}g G {fat}g
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 180,
    backgroundColor: '#F2F1EC',
    borderRadius: 14,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pill: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#888',
    textTransform: 'uppercase',
  },
  name: {
    marginTop: 9,
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  ingredients: {
    marginTop: 4,
    fontSize: 12,
    color: '#888',
    lineHeight: 20,
  },
  macroRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  macroText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1D9E75',
  },
});
