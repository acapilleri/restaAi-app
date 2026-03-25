import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Card } from '../components/Card';
import { colors } from '../theme/colors';
import { hapticLight } from '../utils/haptics';
import { createWeight } from '../api/weights';
import {
  dateLocalYmd,
  fetchAppleHealthSnapshot,
  formatWeightDate,
  isAppleHealthSupported,
  requestAppleHealthReadAccess,
  type AppleHealthSnapshot,
} from '../services/appleHealth';

const APPLE_HEALTH_LINKED_KEY = 'apple_health_linked';

function formatNumber(n: number | null, suffix = ''): string {
  if (n == null || Number.isNaN(n)) return '—';
  const rounded = Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded}${suffix}`;
}

export function HealthScreen() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [linked, setLinked] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [snapshot, setSnapshot] = useState<AppleHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(APPLE_HEALTH_LINKED_KEY);
        setLinked(v === '1');
      } finally {
        setPrefsReady(true);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setSupported(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const ok = await isAppleHealthSupported();
    setSupported(ok);
    if (!ok) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!linked) {
      setSnapshot(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const data = await fetchAppleHealthSnapshot();
      setSnapshot(data);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [linked]);

  useFocusEffect(
    useCallback(() => {
      if (!prefsReady) return;
      setLoading(true);
      load();
    }, [prefsReady, load]),
  );

  const onRefresh = useCallback(() => {
    hapticLight();
    setRefreshing(true);
    load();
  }, [load]);

  const handleLink = useCallback(async () => {
    hapticLight();
    const granted = await requestAppleHealthReadAccess();
    if (!granted) {
      Alert.alert('Permessi', 'Non è stato possibile accedere ad Apple Salute. Controlla le impostazioni.');
      return;
    }
    try {
      await AsyncStorage.setItem(APPLE_HEALTH_LINKED_KEY, '1');
    } catch {
      // ignore storage errors
    }
    setLinked(true);
    setLoading(true);
    try {
      const data = await fetchAppleHealthSnapshot();
      setSnapshot(data);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncWeight = useCallback(async () => {
    if (!snapshot?.lastWeightKg || !snapshot.lastWeightDate) {
      Alert.alert('Peso', 'Nessun peso disponibile da Apple Salute.');
      return;
    }
    hapticLight();
    setSyncing(true);
    try {
      const dateStr = dateLocalYmd(snapshot.lastWeightDate);
      await createWeight(snapshot.lastWeightKg, dateStr);
      Alert.alert('Fatto', 'Peso registrato nel tuo diario.');
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile salvare');
    } finally {
      setSyncing(false);
    }
  }, [snapshot]);

  if (Platform.OS !== 'ios') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerRow}>
          <Icon name="heart-outline" size={28} color={colors.primary} />
          <Text style={styles.title}>Salute</Text>
        </View>
        <Card>
          <Text style={styles.placeholderText}>
            Apple Salute è disponibile solo su iPhone. Su Android puoi comunque registrare il peso dalla home.
          </Text>
        </Card>
      </SafeAreaView>
    );
  }

  if (!prefsReady || supported === null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.headerRow}>
          <Icon name="heart-outline" size={28} color={colors.primary} />
          <Text style={styles.title}>Salute</Text>
        </View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Icon name="heart-outline" size={28} color={colors.primary} />
        <Text style={styles.title}>Salute</Text>
      </View>

      {supported === false ? (
        <Card>
          <Text style={styles.placeholderText}>HealthKit non è disponibile su questo dispositivo.</Text>
        </Card>
      ) : (
        <>
          {!linked ? (
            <Card>
              <Text style={styles.cardIntro}>
                Collega Apple Salute per vedere passi, energia attiva e ultimo peso registrato in Salute.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleLink} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>Collega Apple Salute</Text>
              </TouchableOpacity>
            </Card>
          ) : loading && !snapshot ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
              <Card>
                <Text style={styles.sectionLabel}>Oggi</Text>
                <View style={styles.statRow}>
                  <Icon name="footsteps-outline" size={22} color={colors.primary} />
                  <View style={styles.statText}>
                    <Text style={styles.statValue}>{formatNumber(snapshot?.stepsToday ?? null)}</Text>
                    <Text style={styles.statHint}>passi</Text>
                  </View>
                </View>
                <View style={[styles.statRow, styles.statRowSpaced]}>
                  <Icon name="flame-outline" size={22} color={colors.amber} />
                  <View style={styles.statText}>
                    <Text style={styles.statValue}>{formatNumber(snapshot?.activeEnergyKcalToday ?? null, ' kcal')}</Text>
                    <Text style={styles.statHint}>energia attiva</Text>
                  </View>
                </View>
              </Card>

              <Card style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>Peso (Apple Salute)</Text>
                <Text style={styles.weightMain}>
                  {snapshot?.lastWeightKg != null ? `${formatNumber(snapshot.lastWeightKg)} kg` : '—'}
                </Text>
                {snapshot?.lastWeightDate ? (
                  <Text style={styles.weightMeta}>{formatWeightDate(snapshot.lastWeightDate)}</Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.secondaryBtn, (!snapshot?.lastWeightKg || syncing) && styles.btnDisabled]}
                  onPress={handleSyncWeight}
                  disabled={!snapshot?.lastWeightKg || syncing}
                  activeOpacity={0.85}
                >
                  {syncing ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>Registra peso nel diario</Text>
                  )}
                </TouchableOpacity>
              </Card>
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    marginTop: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
  scroll: { paddingBottom: 32 },
  cardIntro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  placeholderText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statRowSpaced: { marginTop: 14 },
  statText: { flex: 1 },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  statHint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  weightMain: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  weightMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.45 },
});
