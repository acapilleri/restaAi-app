import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import type { FotoStackParamList } from '../navigation/types';

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

export function FotoDetailScreen() {
  const { colors } = useTheme();
  const route = useRoute<RouteProp<FotoStackParamList, 'FotoDetail'>>();
  const { analysis } = route.params;
  const description = analysis.ai_summary || analysis.readings.notes || 'Analisi non disponibile.';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bgPrimary },
        content: { padding: 20, paddingBottom: 32 },
        image: {
          width: '100%',
          height: 420,
          borderRadius: 18,
          backgroundColor: colors.bgSecondary,
          marginBottom: 16,
        },
        date: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.textSecondary,
          marginBottom: 12,
        },
        card: {
          backgroundColor: colors.bgCard,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        },
        title: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.textPrimary,
          marginBottom: 8,
        },
        body: {
          fontSize: 15,
          lineHeight: 22,
          color: colors.textPrimary,
        },
      }),
    [colors],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Image source={{ uri: analysis.photo_url }} style={styles.image} resizeMode="cover" />
          <Text style={styles.date}>{formatDate(analysis.taken_on)}</Text>
          <View style={styles.card}>
            <Text style={styles.title}>Analisi</Text>
            <Text style={styles.body}>{description}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
