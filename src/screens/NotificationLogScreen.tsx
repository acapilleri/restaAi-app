/**
 * Storico locale delle notifiche eating-risk pianificate dal nativo (JSONL in Application Support).
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import {
  clearNotificationScheduleLog,
  fetchNotificationScheduleLogJsonl,
  isNotificationScheduleLogSupported,
  parseNotificationScheduleLogJsonl,
  type NotificationScheduleLogRow,
} from '../services/notificationScheduleLog';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';

export function NotificationLogScreen() {
  const { colors } = useTheme();
  const supported = isNotificationScheduleLogSupported();
  const [raw, setRaw] = useState('');
  const [rows, setRows] = useState<NotificationScheduleLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const text = await fetchNotificationScheduleLogJsonl();
      setRaw(text);
      setRows(parseNotificationScheduleLogJsonl(text).reverse());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supported]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const onShare = useCallback(() => {
    if (!raw.trim()) {
      Alert.alert('Log vuoto', 'Non ci sono ancora righe da condividere.');
      return;
    }
    void Share.share({ message: raw, title: 'notification log' });
  }, [raw]);

  const onClear = useCallback(() => {
    Alert.alert(
      'Svuota log',
      'Rimuovere tutte le righe salvate sul dispositivo?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Svuota',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await clearNotificationScheduleLog();
                hapticLight();
                await load();
              } catch {
                Alert.alert('Errore', 'Impossibile svuotare il log.');
              }
            })();
          },
        },
      ],
    );
  }, [load]);

  if (Platform.OS !== 'ios' || !supported) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
        <View style={styles.headerRow}>
          <DrawerMenuButton />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Log notifiche</Text>
        </View>
        <View style={styles.centered}>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Lo storico delle notifiche eating-risk è disponibile solo su iOS (modulo nativo).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgPrimary }]} edges={['top']}>
      <View style={styles.headerRow}>
        <DrawerMenuButton />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Log notifiche</Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Ogni riga è un JSON: titolo, body, score, esito (scheduled / schedule_failed). Orario = fuso del
        telefono (con offset, es. +02:00). Massimo ~400 eventi.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.greenPill }]}
          onPress={() => {
            hapticLight();
            void load();
          }}
          disabled={loading}
        >
          {loading && !refreshing ? (
            <ActivityIndicator color={colors.primaryDark} />
          ) : (
            <Text style={[styles.btnText, { color: colors.primaryDark }]}>Aggiorna</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primaryMuted }]}
          onPress={() => {
            hapticLight();
            onShare();
          }}
        >
          <Text style={[styles.btnText, { color: colors.primaryDark }]}>Condividi JSONL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: '#FEE2E2' }]}
          onPress={() => {
            hapticLight();
            onClear();
          }}
        >
          <Text style={[styles.btnText, { color: '#991B1B' }]}>Svuota</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {rows.length === 0 && !loading ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Nessun evento ancora. Quando il modello supera la soglia e viene pianificata una notifica locale,
            comparirà qui.
          </Text>
        ) : (
          rows.map((r) => (
            <View
              key={`${r.notificationId}-${r.loggedAtIso}`}
              style={[styles.card, { borderColor: colors.divider, backgroundColor: colors.bgSecondary }]}
            >
              <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{r.loggedAtIso}</Text>
              <Text style={[styles.outcome, { color: r.outcome === 'scheduled' ? '#166534' : '#991B1B' }]}>
                {r.outcome}
                {r.error ? ` — ${r.error}` : ''}
              </Text>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {r.title}
              </Text>
              <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={4}>
                {r.body}
              </Text>
              <Text style={[styles.cardFooter, { color: colors.textHint }]}>
                score {r.score.toFixed(3)} · id {r.notificationId.slice(0, 8)}…
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  empty: { fontSize: 15, lineHeight: 22, marginTop: 24 },
  centered: { flex: 1, justifyContent: 'center', padding: 24 },
  hint: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  cardMeta: { fontSize: 12, marginBottom: 4 },
  outcome: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  cardFooter: { fontSize: 11 },
});
