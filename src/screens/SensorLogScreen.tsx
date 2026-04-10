/**
 * Log sensori + classificatore lineare on-device (context_snapshot_linear.pte).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useExecutorchModule } from 'react-native-executorch';
import CONTEXT_SNAPSHOT_LINEAR_PTE from '../assets/models/context_snapshot_linear.pte';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import { collectSensors, type RawSensorBundle } from '../services/SensorCollector';
import {
  CONTEXT_SNAPSHOT_LINEAR_CLASSES,
  type LinearClassifierOutput,
  runContextSnapshotLinear,
} from '../services/contextSnapshotLinearModel';

const ColorPalette = {
  primary: '#001A72',
  blueLight: '#C1C6E5',
  blueDark: '#6676AA',
  white: '#FFFFFF',
  gray100: '#F5F5F5',
  gray200: '#E0E0E0',
};

type RowDef = { label: string; get: (b: RawSensorBundle) => unknown };

const GPS_ROWS: RowDef[] = [
  { label: 'Latitudine', get: b => b.gps.latitude },
  { label: 'Longitudine', get: b => b.gps.longitude },
  { label: 'Velocità (km/h)', get: b => b.gps.speed_kmh },
  { label: 'Altitudine (m)', get: b => b.gps.altitude_m },
  { label: 'Heading (°)', get: b => b.gps.heading_deg },
  { label: 'Precisione (m)', get: b => b.gps.accuracy_m },
  { label: 'Area (hint IT)', get: b => b.gps.area_hint_it },
  { label: 'Regione (IT)', get: b => b.gps.coarse_region_it },
];

const IMU_ROWS: RowDef[] = [
  { label: 'Accelerazione (mag)', get: b => b.imu.acceleration_magnitude },
  { label: 'Velocità rotazione (°/s)', get: b => b.imu.rotation_rate_deg_s },
  { label: 'Heading magnetico', get: b => b.imu.magnetic_heading },
  { label: 'Pressione (hPa)', get: b => b.imu.pressure_hpa },
  { label: 'Piano stimato', get: b => b.imu.estimated_floor },
  { label: 'Stato IMU', get: b => b.imu.imu_status },
  { label: 'Dettaglio IMU', get: b => b.imu.imu_status_detail },
];

const BLUETOOTH_ROWS: RowDef[] = [
  { label: 'Bluetooth attivo', get: b => b.bluetooth.enabled },
  { label: 'Dispositivi connessi', get: b => b.bluetooth.connected_devices },
  { label: 'Audio auto', get: b => b.bluetooth.is_car_audio },
  { label: 'Cuffie', get: b => b.bluetooth.is_headphones },
  { label: 'Smartwatch', get: b => b.bluetooth.is_smartwatch },
  { label: 'Nome dispositivo auto', get: b => b.bluetooth.car_device_name },
];

const CALENDAR_ROWS: RowDef[] = [
  { label: 'Prossimo evento (min)', get: b => b.calendar.next_event_minutes },
  { label: 'Titolo prossimo evento', get: b => b.calendar.next_event_title },
  { label: 'Durata prossimo (min)', get: b => b.calendar.next_event_duration_min },
  { label: 'Prossimo online', get: b => b.calendar.next_event_is_online },
  { label: 'Partecipanti', get: b => b.calendar.next_event_attendees },
  { label: 'Eventi nelle prossime 2h', get: b => b.calendar.events_in_next_2h },
  { label: 'In evento ora', get: b => b.calendar.currently_in_event },
];

const SYSTEM_ROWS: RowDef[] = [
  { label: 'Batteria (%)', get: b => b.system.battery_level },
  { label: 'In carica', get: b => b.system.is_charging },
  { label: 'Rete', get: b => b.system.network_type },
  { label: 'Fonte rete', get: b => b.system.network_source },
  { label: 'Wi‑Fi SSID', get: b => b.system.wifi_ssid },
  { label: 'Stato app', get: b => b.system.app_state },
  {
    label: 'Luminosità schermo',
    get: (b) => {
      const v = b.system.screen_brightness;
      if (typeof v !== 'number' || Number.isNaN(v)) return null;
      return `${Math.round(v * 100)}%`;
    },
  },
  { label: 'Memoria libera (MB)', get: b => b.system.free_memory_mb },
  { label: 'Dark mode', get: b => b.system.dark_mode },
  { label: 'Modello device', get: b => b.system.device_model },
];

const AUDIO_ROWS: RowDef[] = [
  { label: 'Livello audio (dB)', get: b => b.audio.db_level },
  { label: 'Uscita audio', get: b => b.audio.audio_output },
  { label: 'Chiamata', get: b => b.audio.call_state },
  { label: 'Volume sistema', get: b => b.audio.system_volume },
  { label: 'Scena audio', get: b => b.audio.audio_scene },
  { label: 'Confidenza scena', get: b => b.audio.audio_scene_confidence },
  { label: 'Voce attiva', get: b => b.audio.voice_activity },
  { label: 'Probabilità voce', get: b => b.audio.voice_probability },
  { label: 'Stato audio', get: b => b.audio.audio_status },
  { label: 'Dettaglio audio', get: b => b.audio.audio_status_detail },
];

const BEHAVIORAL_ROWS: RowDef[] = [
  { label: 'Min da ultimo avvio app', get: b => b.behavioral.time_since_last_app_open_min },
  { label: 'Pasti loggati oggi', get: b => b.behavioral.meals_logged_today },
  { label: 'Min da ultimo pasto', get: b => b.behavioral.last_meal_logged_min_ago },
  { label: 'Ora pranzo tipica', get: b => b.behavioral.typical_lunch_hour },
];

const HEALTH_ROWS: RowDef[] = [
  { label: 'Passi oggi', get: b => b.health.steps_today },
  { label: 'FC a riposo (bpm)', get: b => b.health.resting_hr_bpm },
  { label: 'HRV (ms)', get: b => b.health.hrv_ms },
  { label: 'Calorie attive', get: b => b.health.active_calories },
  { label: 'Ore sonno', get: b => b.health.sleep_hours },
  { label: 'Ultimo workout (tipo)', get: b => b.health.last_workout_type },
  { label: 'Ultimo workout (min fa)', get: b => b.health.last_workout_minutes_ago },
  { label: 'Ore in piedi oggi', get: b => b.health.stand_hours_today },
  { label: 'Stato lettura HealthKit', get: b => b.health.healthkit_read_status },
];

const TEMPORAL_ROWS: RowDef[] = [
  { label: 'Ora', get: b => b.temporal.hour },
  { label: 'Minuto', get: b => b.temporal.minute },
  { label: 'Giorno settimana', get: b => b.temporal.day_of_week },
  { label: 'Weekend', get: b => b.temporal.is_weekend },
  { label: 'Fascia oraria', get: b => b.temporal.time_of_day },
  { label: 'Fascia (IT)', get: b => b.temporal.time_of_day_it },
  { label: 'Ora locale (IT)', get: b => b.temporal.local_time_label_it },
  { label: 'Timestamp ISO', get: b => b.temporal.timestamp_iso },
];

type SectionConfig = { title: string; rows: RowDef[] };

const TABLE_SECTIONS: SectionConfig[] = [
  { title: 'GPS', rows: GPS_ROWS },
  { title: 'IMU', rows: IMU_ROWS },
  { title: 'Bluetooth', rows: BLUETOOTH_ROWS },
  { title: 'Calendario', rows: CALENDAR_ROWS },
  { title: 'Sistema', rows: [...SYSTEM_ROWS, ...AUDIO_ROWS, ...BEHAVIORAL_ROWS] },
  { title: 'Salute', rows: HEALTH_ROWS },
  { title: 'Temporale', rows: TEMPORAL_ROWS },
];

function formatCellValue(value: unknown): { text: string; isPlaceholder: boolean } {
  if (value === null || value === undefined) {
    return { text: '—', isPlaceholder: true };
  }
  if (typeof value === 'boolean') {
    return { text: value ? '✅' : '❌', isPlaceholder: false };
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return { text: '—', isPlaceholder: true };
    }
    const s = Number.isInteger(value) ? String(value) : value.toFixed(2);
    return { text: s, isPlaceholder: false };
  }
  if (typeof value === 'string') {
    return { text: value.length ? value : '—', isPlaceholder: value.length === 0 };
  }
  try {
    return { text: JSON.stringify(value), isPlaceholder: false };
  } catch {
    return { text: String(value), isPlaceholder: false };
  }
}

function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <View style={errorBannerStyles.container}>
      <Text style={errorBannerStyles.message} numberOfLines={5}>
        {message}
      </Text>
      <TouchableOpacity onPress={onDismiss} style={errorBannerStyles.closeButton}>
        <Text style={errorBannerStyles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const errorBannerStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    color: '#991B1B',
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  closeText: {
    color: '#991B1B',
    fontSize: 16,
    fontWeight: '600',
  },
});

export function SensorLogScreen() {
  const linearModule = useExecutorchModule({ modelSource: CONTEXT_SNAPSHOT_LINEAR_PTE });
  const [bundle, setBundle] = useState<RawSensorBundle | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [linearOutput, setLinearOutput] = useState<LinearClassifierOutput | null>(null);
  const [linearInferError, setLinearInferError] = useState<string | null>(null);
  const [linearLogitsOpen, setLinearLogitsOpen] = useState(false);
  const [linearFeaturesOpen, setLinearFeaturesOpen] = useState(false);

  const linearDownloadPct = Math.round((linearModule.downloadProgress ?? 0) * 100);
  const busy = collecting || linearModule.isGenerating;

  const runRefresh = useCallback(async () => {
    if (busy) {
      setRefreshing(false);
      return;
    }
    setLocalError(null);
    setLinearOutput(null);
    setLinearInferError(null);
    setCollecting(true);
    try {
      const b = await collectSensors();
      setBundle(b);

      if (linearModule.isReady && !linearModule.error) {
        try {
          const linear = await runContextSnapshotLinear(linearModule.forward, b);
          setLinearOutput(linear);
        } catch (le) {
          setLinearOutput(null);
          setLinearInferError(le instanceof Error ? le.message : String(le));
        }
      } else {
        setLinearOutput(null);
        setLinearInferError(
          linearModule.error
            ? String(linearModule.error)
            : 'Modello lineare (context_snapshot_linear.pte) non ancora caricato.',
        );
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : String(e));
    } finally {
      setCollecting(false);
      setRefreshing(false);
    }
  }, [busy, linearModule]);

  const onPressAggiorna = useCallback(() => {
    if (busy) return;
    runRefresh().catch(() => {});
  }, [busy, runRefresh]);

  const onRefresh = useCallback(() => {
    if (busy) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    runRefresh().catch(() => {});
  }, [busy, runRefresh]);

  const bannerMessage = useMemo(() => {
    if (bannerDismissed && !localError) return null;
    if (localError) return localError;
    if (linearModule.error && !bannerDismissed) return String(linearModule.error);
    return null;
  }, [bannerDismissed, localError, linearModule.error]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    setLocalError(null);
  }, []);

  const styles = useMemo(() => createStyles(), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sensor Log</Text>
        <TouchableOpacity
          onPress={onPressAggiorna}
          disabled={busy}
          style={[styles.aggiornaBtn, busy && styles.aggiornaBtnDisabled]}
        >
          <Text style={styles.aggiornaText}>Aggiorna</Text>
        </TouchableOpacity>
        <DrawerMenuButton placement="trailing" />
      </View>

      {!linearModule.isReady && !linearModule.error ? (
        <View style={styles.downloadWrap}>
          <Text style={styles.downloadLabel}>Caricamento classificatore lineare {linearDownloadPct}%</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${linearDownloadPct}%` }]} />
          </View>
        </View>
      ) : null}

      <ErrorBanner message={bannerMessage} onDismiss={dismissBanner} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={!busy}
            tintColor={ColorPalette.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {collecting ? (
          <View style={styles.collectingRow}>
            <ActivityIndicator color={ColorPalette.primary} />
            <Text style={styles.collectingText}>Raccolta sensori e analisi…</Text>
          </View>
        ) : null}

        {bundle && (linearOutput || linearInferError) ? (
          <View style={styles.aiCard}>
            <Text style={styles.aiCardTitle}>Classificatore lineare (snapshot)</Text>
            <Text style={styles.linearSub}>context_snapshot_linear.pte · {CONTEXT_SNAPSHOT_LINEAR_CLASSES.join(', ')}</Text>
            {linearOutput ? (
              <>
                <Text style={styles.linearMainLabel}>
                  {linearOutput.gated.label}
                  {linearOutput.gated.lowConfidence && linearOutput.gated.reason
                    ? ` · ${linearOutput.gated.reason}`
                    : ''}
                </Text>
                <Text style={styles.linearConfidence}>
                  Confidenza (dopo gate): {(linearOutput.gated.confidence * 100).toFixed(1)}% · qualità segnali:{' '}
                  {(linearOutput.qualityScore * 100).toFixed(0)}%
                </Text>
                <View style={styles.linearProbBlock}>
                  {CONTEXT_SNAPSHOT_LINEAR_CLASSES.map((name, i) => (
                    <Text key={name} style={styles.linearProbLine}>
                      {name}: {((linearOutput.probs[i] ?? 0) * 100).toFixed(1)}%
                    </Text>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setLinearLogitsOpen(o => !o)} activeOpacity={0.7}>
                  <Text style={styles.linearToggle}>{linearLogitsOpen ? 'Nascondi logits' : 'Mostra logits (raw)'}</Text>
                </TouchableOpacity>
                {linearLogitsOpen ? (
                  <Text style={styles.devMono} selectable>
                    [{linearOutput.logits.map(x => x.toFixed(4)).join(', ')}]
                  </Text>
                ) : null}
                <TouchableOpacity onPress={() => setLinearFeaturesOpen(o => !o)} activeOpacity={0.7}>
                  <Text style={styles.linearToggle}>
                    {linearFeaturesOpen
                      ? 'Nascondi feature vector (debug)'
                      : 'Mostra feature vector (confronto Python)'}
                  </Text>
                </TouchableOpacity>
                {linearFeaturesOpen ? (
                  <View style={styles.featureDebugWrap}>
                    <TouchableOpacity
                      onPress={() => {
                        const o = Object.fromEntries(
                          linearOutput.featureNames.map((n, i) => [n, linearOutput.featureVector[i] ?? 0]),
                        );
                        Share.share({
                          message: JSON.stringify(o, null, 2),
                          title: 'context_snapshot_linear features',
                        }).catch(() => {});
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.featureShareLink}>Condividi JSON feature</Text>
                    </TouchableOpacity>
                    <ScrollView
                      style={styles.featureDebugScroll}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.devMono} selectable>
                        {linearOutput.featureNames
                          .map((n, i) => `${n}\t${(linearOutput.featureVector[i] ?? 0).toFixed(6)}`)
                          .join('\n')}
                      </Text>
                    </ScrollView>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.linearErrorText}>{linearInferError}</Text>
            )}
          </View>
        ) : null}

        {bundle ? (
          <View style={styles.tableOuter}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeadCell, styles.colSensor]}>Sensore</Text>
              <Text style={[styles.tableHeadCell, styles.colValue]}>Valore</Text>
            </View>
            {(() => {
              let dataRowIndex = 0;
              return TABLE_SECTIONS.map(section => (
                <View key={section.title}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeaderText}>{section.title}</Text>
                  </View>
                  {section.rows.map(row => {
                    const rawVal = row.get(bundle);
                    const { text, isPlaceholder } = formatCellValue(rawVal);
                    const bg = dataRowIndex % 2 === 0 ? ColorPalette.gray100 : ColorPalette.white;
                    dataRowIndex += 1;
                    return (
                      <View key={row.label} style={[styles.dataRow, { backgroundColor: bg }]}>
                        <Text style={[styles.sensorCell, styles.colSensor]}>{row.label}</Text>
                        <Text
                          style={[styles.valueCell, styles.colValue, isPlaceholder && styles.valueMuted]}
                          selectable
                        >
                          {text}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ));
            })()}
          </View>
        ) : (
          <Text style={styles.hint}>Tocca «Aggiorna» o trascina verso il basso per raccogliere i dati.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles() {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: ColorPalette.white },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: ColorPalette.gray200,
    },
    headerTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: ColorPalette.primary,
    },
    aggiornaBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: ColorPalette.primary,
    },
    aggiornaBtnDisabled: { opacity: 0.45 },
    aggiornaText: { color: ColorPalette.white, fontSize: 14, fontWeight: '600' },
    downloadWrap: { paddingHorizontal: 16, paddingVertical: 12 },
    downloadLabel: { fontSize: 13, color: ColorPalette.blueDark, marginBottom: 8, fontWeight: '600' },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: ColorPalette.gray200,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: ColorPalette.primary,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 32 },
    collectingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    collectingText: { fontSize: 14, color: ColorPalette.blueDark },
    aiCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 16,
      borderRadius: 14,
      backgroundColor: ColorPalette.white,
      borderWidth: 1,
      borderColor: ColorPalette.gray200,
    },
    aiCardTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: ColorPalette.blueDark,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    linearSub: {
      fontSize: 11,
      color: ColorPalette.blueDark,
      opacity: 0.85,
      marginBottom: 10,
      lineHeight: 16,
    },
    linearMainLabel: {
      fontSize: 18,
      fontWeight: '700',
      color: ColorPalette.primary,
      marginBottom: 6,
    },
    linearConfidence: {
      fontSize: 13,
      color: ColorPalette.blueDark,
      marginBottom: 10,
    },
    linearProbBlock: { marginBottom: 10 },
    linearProbLine: { fontSize: 13, color: ColorPalette.primary, marginBottom: 2 },
    linearToggle: {
      fontSize: 13,
      fontWeight: '600',
      color: ColorPalette.primary,
      textDecorationLine: 'underline',
      marginBottom: 8,
    },
    linearErrorText: { fontSize: 14, color: '#991B1B' },
    tableOuter: {
      marginHorizontal: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: ColorPalette.gray200,
      borderRadius: 8,
      overflow: 'hidden',
    },
    tableHeaderRow: {
      flexDirection: 'row',
      backgroundColor: ColorPalette.gray100,
      borderBottomWidth: 1,
      borderBottomColor: ColorPalette.gray200,
    },
    tableHeadCell: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      fontSize: 13,
      fontWeight: '700',
      color: ColorPalette.primary,
    },
    sectionHeaderRow: {
      backgroundColor: ColorPalette.primary,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    sectionHeaderText: { color: ColorPalette.white, fontSize: 13, fontWeight: '700' },
    dataRow: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: ColorPalette.gray200,
    },
    sensorCell: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      fontSize: 13,
      fontWeight: '700',
      color: ColorPalette.primary,
    },
    valueCell: { paddingVertical: 10, paddingHorizontal: 10, fontSize: 13, color: ColorPalette.primary },
    valueMuted: { color: ColorPalette.blueDark, opacity: 0.55 },
    colSensor: { width: '40%' },
    colValue: { width: '60%' },
    hint: {
      marginHorizontal: 16,
      marginTop: 20,
      fontSize: 14,
      color: ColorPalette.blueDark,
      lineHeight: 22,
    },
    devMono: {
      fontSize: 11,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: ColorPalette.primary,
    },
    featureDebugWrap: { marginTop: 4 },
    featureShareLink: {
      fontSize: 13,
      fontWeight: '600',
      color: ColorPalette.primary,
      textDecorationLine: 'underline',
      marginBottom: 8,
    },
    featureDebugScroll: {
      maxHeight: 280,
      marginTop: 4,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: ColorPalette.gray100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: ColorPalette.gray200,
    },
  });
}
