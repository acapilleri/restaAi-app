import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthorizationRequestStatus } from '@kingstinct/react-native-healthkit';
import Icon from 'react-native-vector-icons/Ionicons';
import { Card } from '../components/Card';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { DrawerMenuButton } from '../components/navigation/DrawerMenuButton';
import {
  APPLE_HEALTH_STORAGE_KEYS,
  fetchAppleHealthSnapshot,
  fetchBodyMassHistory,
  formatWeightDate,
  getEssentialReadAuthRequestStatus,
  isAppleHealthSupported,
  requestAppleHealthReadAccess,
  type AppleHealthSnapshot,
  type BodyMassHistoryEntry,
  type SaluteMetricId,
} from '../services/appleHealth';
import type { SaluteStackParamList } from '../navigation/types';

function formatNumber(n: number | null, suffix = ''): string {
  if (n == null || Number.isNaN(n)) return '—';
  const rounded = Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded}${suffix}`;
}

function formatHours(n: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.round(n * 10) / 10} h`;
}

function essentialsAllNull(s: AppleHealthSnapshot | null | undefined): boolean {
  if (!s) return false;
  return s.stepsToday == null && s.activeEnergyKcalToday == null && s.lastWeightKg == null;
}

function formatHistoryRowDate(d: Date): string {
  try {
    return d.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

type MetricRowProps = {
  icon: string;
  iconColor?: string;
  value: string;
  label: string;
  spaced?: boolean;
};

function TouchableMetricRow({
  icon,
  iconColor,
  value,
  label,
  spaced,
  onPress,
}: MetricRowProps & { onPress?: () => void }) {
  const { colors } = useTheme();
  const rowStyles = useMemo(
    () =>
      StyleSheet.create({
        statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        statRowSpaced: { marginTop: 14 },
        rowChevron: { fontSize: 22, color: colors.textMuted, paddingLeft: 4 },
        statText: { flex: 1 },
        statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
        statHint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
      }),
    [colors],
  );
  const tint = iconColor ?? colors.primary;
  const inner = (
    <>
      <Icon name={icon} size={22} color={tint} />
      <View style={rowStyles.statText}>
        <Text style={rowStyles.statValue}>{value}</Text>
        <Text style={rowStyles.statHint}>{label}</Text>
      </View>
      {onPress ? <Text style={rowStyles.rowChevron}>›</Text> : null}
    </>
  );
  if (!onPress) {
    return <View style={[rowStyles.statRow, spaced && rowStyles.statRowSpaced]}>{inner}</View>;
  }
  return (
    <TouchableOpacity
      style={[rowStyles.statRow, spaced && rowStyles.statRowSpaced]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {inner}
    </TouchableOpacity>
  );
}

export function HealthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SaluteStackParamList, 'Salute'>>();
  const showBack = navigation.canGoBack();

  const [supported, setSupported] = useState<boolean | null>(null);
  const [linked, setLinked] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const [snapshot, setSnapshot] = useState<AppleHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [essentialAuthStatus, setEssentialAuthStatus] = useState<AuthorizationRequestStatus | null>(null);
  const [weightHistory, setWeightHistory] = useState<BodyMassHistoryEntry[]>([]);

  const refreshHealthData = useCallback(async () => {
    const [data, authSt, wh] = await Promise.all([
      fetchAppleHealthSnapshot(),
      getEssentialReadAuthRequestStatus(),
      fetchBodyMassHistory().catch(() => [] as BodyMassHistoryEntry[]),
    ]);
    setSnapshot(data);
    setEssentialAuthStatus(authSt);
    setWeightHistory(wh);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(APPLE_HEALTH_STORAGE_KEYS.linked);
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
      setEssentialAuthStatus(null);
      return;
    }
    if (!linked) {
      setSnapshot(null);
      setEssentialAuthStatus(null);
      setWeightHistory([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      await refreshHealthData();
    } catch {
      setSnapshot(null);
      setWeightHistory([]);
      setEssentialAuthStatus(await getEssentialReadAuthRequestStatus().catch(() => null));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [linked, refreshHealthData]);

  useFocusEffect(
    useCallback(() => {
      if (!prefsReady) return;
      setLoading(true);
      load();
    }, [prefsReady, load]),
  );

  /** Primo accesso alla scheda Salute (dopo che HealthKit risulta disponibile): richiede i permessi e, se concessi, collega come «Collega Apple Salute» così il riepilogo si popola. */
  useEffect(() => {
    if (Platform.OS !== 'ios' || !prefsReady || supported !== true) return;
    let cancelled = false;
    (async () => {
      try {
        const prompted = await AsyncStorage.getItem(APPLE_HEALTH_STORAGE_KEYS.readAuthPrompted);
        if (cancelled || prompted === '1') return;
        const granted = await requestAppleHealthReadAccess();
        await AsyncStorage.setItem(APPLE_HEALTH_STORAGE_KEYS.readAuthPrompted, '1');
        if (cancelled || !granted) return;
        try {
          await AsyncStorage.setItem(APPLE_HEALTH_STORAGE_KEYS.linked, '1');
        } catch {
          // ignore storage errors
        }
        setLinked(true);
        setLoading(true);
        try {
          if (!cancelled) await refreshHealthData();
        } catch {
          if (!cancelled) {
            setSnapshot(null);
            setWeightHistory([]);
            setEssentialAuthStatus(await getEssentialReadAuthRequestStatus().catch(() => null));
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefsReady, supported, refreshHealthData]);

  const onRefresh = useCallback(() => {
    hapticLight();
    setRefreshing(true);
    load();
  }, [load]);

  const canOpenStorico = linked && Platform.OS === 'ios';

  const openMetricStorico = useCallback(
    (metric: SaluteMetricId) => {
      hapticLight();
      navigation.navigate('SaluteStorico', { metric });
    },
    [navigation],
  );

  const handleLink = useCallback(async () => {
    hapticLight();
    const granted = await requestAppleHealthReadAccess();
    if (!granted) {
      Alert.alert('Permessi', 'Non è stato possibile accedere ad Apple Salute. Controlla le impostazioni.');
      return;
    }
    try {
      await AsyncStorage.setItem(APPLE_HEALTH_STORAGE_KEYS.linked, '1');
    } catch {
      // ignore storage errors
    }
    setLinked(true);
    setLoading(true);
    try {
      await refreshHealthData();
    } catch {
      setSnapshot(null);
      setWeightHistory([]);
      setEssentialAuthStatus(await getEssentialReadAuthRequestStatus().catch(() => null));
    } finally {
      setLoading(false);
    }
  }, [refreshHealthData]);

  const handleReopenPermissions = useCallback(async () => {
    hapticLight();
    const granted = await requestAppleHealthReadAccess();
    if (!granted) {
      Alert.alert('Permessi', 'Richiesta non completata. Puoi riprovare o aprire Impostazioni.');
      return;
    }
    setLoading(true);
    try {
      await refreshHealthData();
    } catch {
      setSnapshot(null);
      setWeightHistory([]);
    } finally {
      setLoading(false);
    }
  }, [refreshHealthData]);

  const confirmUnlinkAppleHealth = useCallback(() => {
    hapticLight();
    Alert.alert(
      'Scollega Apple Salute?',
      'Resta smetterà di mostrare i dati da Apple Salute in questa schermata. Per revocare l’accesso anche a livello di iPhone, apri Impostazioni → Salute → Accesso dati e dispositivi → Resta (oppure app Salute → Condivisione).',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Apri Impostazioni',
          onPress: () => {
            Linking.openSettings();
          },
        },
        {
          text: 'Scollega',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(APPLE_HEALTH_STORAGE_KEYS.linked);
              await AsyncStorage.removeItem(APPLE_HEALTH_STORAGE_KEYS.readAuthPrompted);
            } catch {
              // ignore
            }
            setLinked(false);
            setSnapshot(null);
            setEssentialAuthStatus(null);
            setWeightHistory([]);
          },
        },
      ],
    );
  }, []);

  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: 16 },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          marginTop: 8,
        },
        backHit: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: -4,
          marginRight: -2,
        },
        title: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, flex: 1 },
        scroll: { paddingBottom: 32 },
        permissionHint: {
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.amber,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        },
        permissionHintText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
        permissionBtn: {
          backgroundColor: colors.primary,
          paddingVertical: 10,
          borderRadius: 10,
          alignItems: 'center',
          marginBottom: 8,
        },
        permissionBtnText: { color: colors.textOnPrimary, fontSize: 15, fontWeight: '600' },
        linkLikeBtn: { paddingVertical: 8, alignItems: 'center' },
        linkLikeBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
        neutralHint: {
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.textMuted,
          borderRadius: 12,
          padding: 12,
          marginBottom: 12,
        },
        neutralHintText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
        cardIntro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
        placeholderText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
        sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 12 },
        statRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        statRowSpaced: { marginTop: 14 },
        rowChevron: { fontSize: 22, color: colors.textMuted, paddingLeft: 4 },
        weightTapRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
        weightTapText: { flex: 1 },
        statText: { flex: 1 },
        statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
        statHint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        weightMain: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
        weightMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 12 },
        subSectionLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.textMuted,
          marginTop: 18,
          marginBottom: 8,
          textTransform: 'uppercase',
        },
        historyEmpty: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
        historyScroll: { maxHeight: 220 },
        historyRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.textMuted,
        },
        historyRowDate: { fontSize: 13, color: colors.textSecondary, flex: 1, paddingRight: 8 },
        historyRowValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
        primaryBtn: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
        },
        primaryBtnText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '600' },
        unlinkBtn: {
          borderWidth: 1,
          borderColor: colors.textMuted,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
        },
        unlinkBtnText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
        unlinkHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginTop: 10, textAlign: 'center' },
      }),
    [colors],
  );

  const showPermissionBanner = essentialAuthStatus === AuthorizationRequestStatus.shouldRequest;
  const showNoDataHint =
    linked &&
    !loading &&
    snapshot != null &&
    essentialsAllNull(snapshot) &&
    essentialAuthStatus !== AuthorizationRequestStatus.shouldRequest;

  const header = (
    <View style={styles.headerRow}>
      {showBack ? (
        <TouchableOpacity
          style={styles.backHit}
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Indietro"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}
      <Icon name="heart-outline" size={28} color={colors.primary} />
      <Text style={styles.title}>Salute</Text>
      <DrawerMenuButton placement="trailing" />
    </View>
  );

  if (Platform.OS !== 'ios') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        {header}
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
        {header}
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}

      {supported === false ? (
        <Card>
          <Text style={styles.placeholderText}>HealthKit non è disponibile su questo dispositivo.</Text>
        </Card>
      ) : (
        <>
          {!linked ? (
            <Card>
              <Text style={styles.cardIntro}>
                Collega Apple Salute per vedere attività, composizione corporea, cuore, sonno e altri dati per cui
                concedi l’accesso.
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
              {showPermissionBanner ? (
                <View style={styles.permissionHint}>
                  <Text style={styles.permissionHintText}>
                    Per leggere passi, energia e peso iOS deve ancora mostrare (o aggiornare) il foglio permessi. Tocca
                    il pulsante qui sotto, oppure Impostazioni → Salute → Accesso dati e dispositivi → Resta.
                  </Text>
                  <TouchableOpacity style={styles.permissionBtn} onPress={handleReopenPermissions} activeOpacity={0.85}>
                    <Text style={styles.permissionBtnText}>Riapri permessi Apple Salute</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linkLikeBtn} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
                    <Text style={styles.linkLikeBtnText}>Apri Impostazioni</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {showNoDataHint ? (
                <View style={styles.neutralHint}>
                  <Text style={styles.neutralHintText}>
                    Non risultano dati oggi per passi, energia o peso in Apple Salute (o non sono ancora stati
                    sincronizzati). Controlla fonti e orologi collegati, oppure riprova più tardi.
                  </Text>
                </View>
              ) : null}
              <Card>
                <Text style={styles.sectionLabel}>Peso (Apple Salute)</Text>
                {canOpenStorico ? (
                  <TouchableOpacity
                    style={styles.weightTapRow}
                    onPress={() => openMetricStorico('bodyMass')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.weightTapText}>
                      <Text style={styles.weightMain}>
                        {snapshot?.lastWeightKg != null ? `${formatNumber(snapshot.lastWeightKg)} kg` : '—'}
                      </Text>
                      {snapshot?.lastWeightDate ? (
                        <Text style={styles.weightMeta}>{formatWeightDate(snapshot.lastWeightDate)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.rowChevron}>›</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={styles.weightMain}>
                      {snapshot?.lastWeightKg != null ? `${formatNumber(snapshot.lastWeightKg)} kg` : '—'}
                    </Text>
                    {snapshot?.lastWeightDate ? (
                      <Text style={styles.weightMeta}>{formatWeightDate(snapshot.lastWeightDate)}</Text>
                    ) : null}
                  </>
                )}
                <Text style={styles.subSectionLabel}>Ultime pesate (30 gg)</Text>
                {weightHistory.length === 0 ? (
                  <Text style={styles.historyEmpty}>Nessuna pesata nel periodo.</Text>
                ) : (
                  <ScrollView style={styles.historyScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {weightHistory.map((row) => (
                      <View key={row.uuid} style={styles.historyRow}>
                        <Text style={styles.historyRowDate}>{formatHistoryRowDate(row.date)}</Text>
                        <Text style={styles.historyRowValue}>{formatNumber(row.kg)} kg</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </Card>

              <Card style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>Oggi</Text>
                <TouchableMetricRow
                  icon="footsteps-outline"
                  value={formatNumber(snapshot?.stepsToday ?? null)}
                  label="passi"
                  onPress={canOpenStorico ? () => openMetricStorico('stepCount') : undefined}
                />
                <TouchableMetricRow
                  icon="flame-outline"
                  iconColor={colors.amber}
                  value={formatNumber(snapshot?.activeEnergyKcalToday ?? null, ' kcal')}
                  label="energia attiva"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('activeEnergy') : undefined}
                />
                <TouchableMetricRow
                  icon="navigate-outline"
                  value={formatNumber(snapshot?.distanceWalkingRunningKmToday ?? null, ' km')}
                  label="distanza camminata/corsa"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('distanceWalkingRunning') : undefined}
                />
                <TouchableMetricRow
                  icon="layers-outline"
                  value={formatNumber(snapshot?.flightsClimbedToday ?? null)}
                  label="piani saliti"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('flightsClimbed') : undefined}
                />
                <TouchableMetricRow
                  icon="battery-charging-outline"
                  iconColor={colors.textSecondary}
                  value={formatNumber(snapshot?.basalEnergyKcalToday ?? null, ' kcal')}
                  label="energia basale"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('basalEnergy') : undefined}
                />
                <TouchableMetricRow
                  icon="nutrition-outline"
                  iconColor={colors.textSecondary}
                  value={formatNumber(snapshot?.dietaryEnergyKcalToday ?? null, ' kcal')}
                  label="calorie introdotte"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('dietaryEnergy') : undefined}
                />
              </Card>

              <Card style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>Cuore e ossigeno</Text>
                <TouchableMetricRow
                  icon="pulse-outline"
                  value={formatNumber(snapshot?.heartRateBpm ?? null, ' bpm')}
                  label="frequenza cardiaca (ultima)"
                  onPress={canOpenStorico ? () => openMetricStorico('heartRate') : undefined}
                />
                <TouchableMetricRow
                  icon="heart-outline"
                  iconColor="#c62828"
                  value={formatNumber(snapshot?.restingHeartRateBpm ?? null, ' bpm')}
                  label="frequenza a riposo (ultima)"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('restingHeartRate') : undefined}
                />
                <TouchableMetricRow
                  icon="analytics-outline"
                  value={formatNumber(snapshot?.hrvSdnnMs ?? null, ' ms')}
                  label="variabilità (HRV SDNN, ultima)"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('hrvSdnn') : undefined}
                />
                <TouchableMetricRow
                  icon="water-outline"
                  iconColor="#1565c0"
                  value={(() => {
                    const s = snapshot?.oxygenSaturationPercent;
                    if (s == null || Number.isNaN(s)) return '—';
                    const pct = s <= 1 ? s * 100 : s;
                    return formatNumber(pct, ' %');
                  })()}
                  label="saturazione ossigeno (ultima)"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('oxygenSaturation') : undefined}
                />
              </Card>

              <Card style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>Composizione corporea</Text>
                <TouchableMetricRow
                  icon="body-outline"
                  value={formatNumber(snapshot?.bodyFatPercent ?? null, ' %')}
                  label="massa grassa (ultima)"
                  onPress={canOpenStorico ? () => openMetricStorico('bodyFat') : undefined}
                />
                <TouchableMetricRow
                  icon="barbell-outline"
                  value={formatNumber(snapshot?.leanBodyMassKg ?? null, ' kg')}
                  label="massa magra (ultima)"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('leanBodyMass') : undefined}
                />
                <TouchableMetricRow
                  icon="speedometer-outline"
                  value={formatNumber(snapshot?.bmi ?? null)}
                  label="BMI (ultimo)"
                  spaced
                  onPress={canOpenStorico ? () => openMetricStorico('bmi') : undefined}
                />
              </Card>

              <Card style={{ marginTop: 12 }}>
                <Text style={styles.sectionLabel}>Sonno</Text>
                <TouchableMetricRow
                  icon="moon-outline"
                  iconColor="#5c6bc0"
                  value={formatHours(snapshot?.sleepAsleepHoursRecent ?? null)}
                  label="sonno effettivo (ultime ~36 h)"
                  onPress={canOpenStorico ? () => openMetricStorico('sleep') : undefined}
                />
              </Card>

              <Card style={{ marginTop: 12 }}>
                <TouchableOpacity style={styles.unlinkBtn} onPress={confirmUnlinkAppleHealth} activeOpacity={0.85}>
                  <Text style={styles.unlinkBtnText}>Scollega Apple Salute</Text>
                </TouchableOpacity>
                <Text style={styles.unlinkHint}>
                  Interrompe l’uso dei dati in Resta. Per togliere i permessi sul telefono usa Salute → Condivisione o
                  Impostazioni → Salute.
                </Text>
              </Card>
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
