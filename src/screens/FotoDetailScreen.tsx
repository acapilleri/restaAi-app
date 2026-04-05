import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// eslint-disable-next-line @react-native/no-deep-imports
import Alert from 'react-native/Libraries/Alert/Alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { deleteBodyAnalysis, getBodyAnalyses } from '../api/bodyAnalysis';
import type { BodyAnalysis, BodyAnalysisComparison, BodyReading } from '../api/bodyAnalysis';
import { useTheme } from '../context/ThemeContext';
import type { FotoStackParamList } from '../navigation/types';
import { formatBodyCheckDateTime } from '../utils/formatBodyCheckDateTime';

function formatDate(value: string) {
  return formatBodyCheckDateTime(value, { month: 'long' });
}

function descriptionFromAnalysis(analysis: BodyAnalysis): string {
  const s = analysis.ai_summary?.trim();
  if (s) return s;
  const r = analysis.readings;
  const c = analysis.comparison;
  const parts = [
    c?.comparison_summary?.trim(),
    c?.progress_summary?.trim(),
    r.posture_notes?.trim(),
    r.muscle_distribution?.trim(),
    r.body_fat_estimate?.trim(),
    r.notes?.trim(),
  ].filter(Boolean) as string[];
  if (parts.length) return parts.join('\n\n');
  return 'Analisi non disponibile. Se hai appena caricato la foto, attendi qualche secondo e torna indietro: l’analisi viene elaborata in background.';
}

function formatProgressTrend(raw: string): string {
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    miglioramento: 'In miglioramento',
    stabile: 'Stabile',
    peggioramento: 'In peggioramento',
    non_determinabile: 'Non determinabile',
  };
  return map[key] ?? (raw.trim() || 'Non determinabile');
}

function buildComparisonRows(c: BodyAnalysisComparison): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value: string) => {
    const t = value.trim();
    if (t) rows.push({ label, value: t });
  };
  push('Confronto con le foto precedenti', c.comparison_summary);
  push('Sintesi progressi (nel tempo)', c.progress_summary);
  rows.push({
    label: 'Andamento stimato',
    value: formatProgressTrend(c.progress_trend || 'non_determinabile'),
  });
  return rows;
}

function hasExpandedReadings(r: BodyReading): boolean {
  return (
    r.posture_score > 0 ||
    !!r.posture_notes.trim() ||
    !!r.body_fat_estimate.trim() ||
    !!r.waist_to_hip_ratio_estimate.trim() ||
    !!r.waist_to_shoulder_ratio_estimate.trim() ||
    !!r.body_shape_note.trim() ||
    !!r.muscle_distribution.trim() ||
    r.strong_areas.length > 0 ||
    r.areas_to_improve.length > 0 ||
    !!r.overall_progress_note.trim() ||
    !!r.suggested_focus.trim()
  );
}

/** Righe derivate dai campi strutturati del JSON di analisi (e testo legacy). */
function buildDetailRows(r: BodyReading): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];

  const push = (label: string, value: string) => {
    const t = value.trim();
    if (t) rows.push({ label, value: t });
  };

  if (r.posture_score > 0) {
    rows.push({ label: 'Punteggio postura', value: `${r.posture_score}/10` });
  }
  push('Note posturali', r.posture_notes);

  push('Massa grassa (stima visiva)', r.body_fat_estimate);
  push('Rapporto vita / fianchi (stima)', r.waist_to_hip_ratio_estimate);
  push('Rapporto vita / spalle (stima)', r.waist_to_shoulder_ratio_estimate);
  push('Forma e proporzioni', r.body_shape_note);
  push('Distribuzione muscolare', r.muscle_distribution);

  if (r.strong_areas.length) {
    rows.push({
      label: 'Punti di forza',
      value: r.strong_areas.map((s) => `• ${s}`).join('\n'),
    });
  }
  if (r.areas_to_improve.length) {
    rows.push({
      label: 'Aree da migliorare',
      value: r.areas_to_improve.map((s) => `• ${s}`).join('\n'),
    });
  }

  push('Progressi generali', r.overall_progress_note);
  push('Suggerimento', r.suggested_focus);

  const expanded = hasExpandedReadings(r);
  if (r.notes.trim() && !expanded) {
    rows.push({ label: 'Analisi', value: r.notes.trim() });
  }

  // Fallback: testo solo in notes ma flag "expanded" incoerente, oppure nessun campo valorizzato sopra
  if (rows.length === 0 && r.notes.trim()) {
    rows.push({ label: 'Dettaglio analisi', value: r.notes.trim() });
  }

  return rows;
}

export function FotoDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<FotoStackParamList, 'FotoDetail'>>();
  const route = useRoute<RouteProp<FotoStackParamList, 'FotoDetail'>>();
  const paramAnalysis = route.params.analysis;
  const [analysis, setAnalysis] = useState(paramAnalysis);
  const [refreshingDetail, setRefreshingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const readingsKey = JSON.stringify(paramAnalysis.readings);
  const comparisonKey = JSON.stringify(paramAnalysis.comparison ?? {});
  useEffect(() => {
    setAnalysis(paramAnalysis);
  }, [
    paramAnalysis.id,
    paramAnalysis.taken_on,
    paramAnalysis.photo_url,
    paramAnalysis.ai_summary,
    readingsKey,
    comparisonKey,
  ]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setRefreshingDetail(true);
      (async () => {
        try {
          const list = await getBodyAnalyses();
          const fresh = list.find((a) => a.id === paramAnalysis.id);
          if (!cancelled && fresh) {
            setAnalysis(fresh);
          }
        } catch {
          /* keep cached params */
        } finally {
          if (!cancelled) setRefreshingDetail(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [paramAnalysis.id]),
  );

  const confirmRemove = useCallback(() => {
    Alert.alert(
      'Rimuovi Body Check',
      'Vuoi eliminare questa analisi e la foto associata? L’azione non può essere annullata.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteBodyAnalysis(analysis.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert(
                'Errore',
                e instanceof Error ? e.message : 'Impossibile eliminare il Body Check.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [analysis.id, navigation]);

  const description = descriptionFromAnalysis(analysis);
  const detailRows = useMemo(() => {
    return [...buildComparisonRows(analysis.comparison), ...buildDetailRows(analysis.readings)];
  }, [analysis]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bgPrimary },
        content: { padding: 20, paddingBottom: 32 },
        image: {
          width: '100%',
          height: 280,
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
        refreshRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        },
        refreshHint: {
          fontSize: 12,
          color: colors.textMuted,
        },
        card: {
          backgroundColor: colors.bgCard,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 14,
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
        table: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          overflow: 'hidden',
        },
        tableRow: {
          flexDirection: 'row',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        tableRowAlt: {
          backgroundColor: colors.bgSecondary,
        },
        tableCellLabel: {
          flex: 2,
          fontSize: 13,
          fontWeight: '600',
          color: colors.textSecondary,
          paddingRight: 10,
        },
        tableCellValue: {
          flex: 3,
          flexShrink: 1,
          fontSize: 15,
          lineHeight: 21,
          color: colors.textPrimary,
        },
        scrollHint: {
          fontSize: 12,
          color: colors.textMuted,
          marginBottom: 10,
          fontStyle: 'italic',
        },
        removeWrap: {
          marginTop: 8,
          marginBottom: 8,
          alignItems: 'center',
        },
        removeBtn: {
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgSecondary,
          alignSelf: 'stretch',
          alignItems: 'center',
        },
        removeBtnDisabled: {
          opacity: 0.55,
        },
        removeBtnText: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.amber,
        },
      }),
    [colors],
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator>
        <View style={styles.content}>
          <Image source={{ uri: analysis.photo_url }} style={styles.image} resizeMode="cover" />
          <Text style={styles.date}>{formatDate(analysis.taken_on)}</Text>
          <Text style={styles.scrollHint}>Sotto: tabella con tutti i parametri della lettura.</Text>
          {refreshingDetail ? (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.refreshHint}>Aggiornamento analisi…</Text>
            </View>
          ) : null}
          <View style={styles.card}>
            <Text style={styles.title}>Riepilogo</Text>
            <Text style={styles.body}>{description}</Text>
          </View>

          {detailRows.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.title}>Tabella parametri</Text>
              <View style={styles.table}>
                {detailRows.map((row, index) => (
                  <View
                    key={`${row.label}-${index}`}
                    style={[
                      styles.tableRow,
                      index % 2 === 1 ? styles.tableRowAlt : null,
                      index === detailRows.length - 1 ? { borderBottomWidth: 0 } : null,
                    ]}
                  >
                    <Text style={styles.tableCellLabel}>{row.label}</Text>
                    <Text style={styles.tableCellValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.removeWrap}>
            <TouchableOpacity
              style={[styles.removeBtn, deleting ? styles.removeBtnDisabled : null]}
              onPress={confirmRemove}
              disabled={deleting}
              activeOpacity={0.85}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.amber} />
              ) : (
                <Text style={styles.removeBtnText}>Rimuovi questo Body Check</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
