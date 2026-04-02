import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NearbyRestaurantRecommendationData } from '../../../types/chat';
import { useTheme } from '../../../context/ThemeContext';

type Props = { data: NearbyRestaurantRecommendationData };

function formatDistance(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function NearbyRestaurantRecommendationCard({ data }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.bgCard,
          borderRadius: 14,
          padding: 14,
          width: '88%',
          marginTop: 4,
          borderWidth: 1,
          borderColor: colors.border,
        },
        title: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
        block: { marginBottom: 12 },
        restRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
        restName: { fontSize: 15, fontWeight: '600', color: colors.primary, flex: 1 },
        dist: { fontSize: 12, color: colors.textSecondary },
        dish: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
        section: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
        notes: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
        fit: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
        caution: { fontSize: 12, color: colors.amber, marginTop: 4 },
        altTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 8, marginBottom: 4 },
        hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
        conf: { fontSize: 11, color: colors.textHint, marginTop: 4 },
      }),
    [colors],
  );

  const primary = data.primary_recommendations ?? [];
  const alts = data.alternatives ?? [];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Suggerimenti ristorante</Text>
      {primary.map((p, i) => {
        const dist = formatDistance(p.distance_m ?? undefined);
        return (
          <View key={`${p.restaurant_name}-${p.menu_item_name}-${i}`} style={styles.block}>
            <View style={styles.restRow}>
              <Text style={styles.restName}>{p.restaurant_name}</Text>
              {dist ? <Text style={styles.dist}>{dist}</Text> : null}
            </View>
            <Text style={styles.dish}>{p.menu_item_name}</Text>
            {p.section ? <Text style={styles.section}>{p.section}</Text> : null}
            {p.notes ? <Text style={styles.notes}>{p.notes}</Text> : null}
            {p.diet_fit_summary ? <Text style={styles.fit}>{p.diet_fit_summary}</Text> : null}
            {p.cautions && p.cautions.length > 0
              ? p.cautions.map((c, j) => (
                  <Text key={`c-${i}-${j}`} style={styles.caution}>
                    {c}
                  </Text>
                ))
              : null}
            {p.confidence != null && Number.isFinite(p.confidence) ? (
              <Text style={styles.conf}>Affidabilità: {p.confidence.toFixed(2)}</Text>
            ) : null}
          </View>
        );
      })}
      {alts.length > 0 ? (
        <>
          <Text style={styles.altTitle}>Alternative</Text>
          {alts.map((a, i) => {
            const dist = formatDistance(a.distance_m ?? undefined);
            return (
              <View key={`alt-${a.restaurant_name}-${i}`} style={styles.block}>
                <View style={styles.restRow}>
                  <Text style={styles.restName}>{a.restaurant_name}</Text>
                  {dist ? <Text style={styles.dist}>{dist}</Text> : null}
                </View>
                <Text style={styles.dish}>{a.menu_item_name}</Text>
                {a.notes ? <Text style={styles.notes}>{a.notes}</Text> : null}
              </View>
            );
          })}
        </>
      ) : null}
      {data.assistant_summary_hint ? (
        <Text style={styles.hint}>{data.assistant_summary_hint}</Text>
      ) : null}
    </View>
  );
}
