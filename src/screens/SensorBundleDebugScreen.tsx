import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BUNDLED_LLM_MODEL_PATH } from '../config/bundledLlmAsset';
import {
  DEFAULT_LLM_FILESYSTEM_PATH,
  LLM_MODEL_IS_ASSET_KEY,
  LLM_MODEL_PATH_KEY,
  USE_BUNDLED_LLM_WHEN_NO_PATH,
} from '../config/llmModel';
import { useTheme } from '../context/ThemeContext';
import {
  clearSensorBundleLlm,
  collectAndSend,
  getLastSensorBundleDebug,
  initSensorBundle,
  isLlmContextReady,
} from '../services/SensorBundleService';

export function SensorBundleDebugScreen() {
  const { colors } = useTheme();
  const [snapshotJson, setSnapshotJson] = useState(() => {
    const s = getLastSensorBundleDebug();
    return s ? JSON.stringify(s, null, 2) : '';
  });
  const [busy, setBusy] = useState(false);
  const [llmPath, setLlmPath] = useState('');
  const [llmAsAsset, setLlmAsAsset] = useState(false);
  const [llmReady, setLlmReady] = useState(isLlmContextReady());

  const refresh = useCallback(() => {
    const s = getLastSensorBundleDebug();
    setSnapshotJson(s ? JSON.stringify(s, null, 2) : '');
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      void Promise.all([
        AsyncStorage.getItem(LLM_MODEL_PATH_KEY),
        AsyncStorage.getItem(LLM_MODEL_IS_ASSET_KEY),
      ]).then(([path, isAsset]) => {
        setLlmPath(path ?? '');
        setLlmAsAsset(isAsset === 'true');
      });
      setLlmReady(isLlmContextReady());
    }, [refresh]),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bgPrimary },
        header: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
        },
        title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
        sub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
        scroll: { flex: 1 },
        scrollContent: { padding: 16, paddingBottom: 32 },
        mono: {
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 11,
          lineHeight: 16,
          color: colors.textPrimary,
        },
        empty: { color: colors.textSecondary, fontSize: 14 },
        footer: {
          padding: 16,
          paddingBottom: 24,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
        },
        btn: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
        },
        btnDisabled: { opacity: 0.6 },
        btnLabel: { fontSize: 16, fontWeight: '700', color: colors.primaryDarkLabel },
        llmSection: {
          marginBottom: 20,
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.divider,
        },
        llmLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
        llmHint: { fontSize: 11, color: colors.textMuted, marginBottom: 8, lineHeight: 16 },
        llmInput: {
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: 10,
          padding: 10,
          fontSize: 13,
          color: colors.textPrimary,
          minHeight: 44,
          marginBottom: 10,
        },
        llmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
        llmSub: { fontSize: 12, color: colors.textSecondary, flex: 1, marginRight: 12 },
        btnSecondary: {
          backgroundColor: colors.bgCard,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.divider,
          marginTop: 8,
        },
        btnSecondaryLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
      }),
    [colors],
  );

  const runCollect = async () => {
    setBusy(true);
    try {
      await collectAndSend();
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const saveLlmPath = async () => {
    const p = llmPath.trim();
    if (!p) {
      await AsyncStorage.removeItem(LLM_MODEL_PATH_KEY);
      await AsyncStorage.removeItem(LLM_MODEL_IS_ASSET_KEY);
      await clearSensorBundleLlm();
      setLlmReady(false);
      Alert.alert('Llama', 'Path rimosso. Contesto LLM disattivato fino al prossimo avvio o nuovo salvataggio.');
      return;
    }
    try {
      await AsyncStorage.setItem(LLM_MODEL_PATH_KEY, p);
      await AsyncStorage.setItem(LLM_MODEL_IS_ASSET_KEY, llmAsAsset ? 'true' : 'false');
      await initSensorBundle(p, { forceReinit: true, isModelAsset: llmAsAsset });
      const ok = isLlmContextReady();
      setLlmReady(ok);
      Alert.alert('Llama', ok ? 'Modello caricato.' : 'Caricamento fallito (vedi console in dev). Verifica path o asset.');
    } catch (e) {
      setLlmReady(false);
      Alert.alert('Llama', e instanceof Error ? e.message : 'Errore');
    }
  };

  const applyDefaultFromConfig = () => {
    const d = DEFAULT_LLM_FILESYSTEM_PATH.trim();
    if (!d) {
      Alert.alert(
        'Path predefinito',
        'DEFAULT_LLM_FILESYSTEM_PATH in src/config/llmModel.ts è vuoto. Usa «Gemma in bundle» o incolla un path al .gguf.',
      );
      return;
    }
    setLlmPath(d);
    setLlmAsAsset(false);
  };

  const applyBundledGemma = () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Android',
        'Il GGUF non può passare dal bundle JS (limite Metro). Copia gemma-3-1b-it-Q4_K_M.gguf sul dispositivo e incolla qui il path assoluto al file, con «Modello da asset» spento.',
      );
      return;
    }
    setLlmPath(BUNDLED_LLM_MODEL_PATH);
    setLlmAsAsset(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Sensor bundle</Text>
        <Text style={styles.sub}>
          Ultimo snapshot raccolto in memoria sul dispositivo. L’invio al backend è controllato da
          SEND_CONTEXT_SNAPSHOTS_TO_SERVER nel codice.
        </Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.llmSection}>
          <Text style={styles.llmLabel}>Llama on-device (sensor bundle)</Text>
          <Text style={styles.llmHint}>
            Stato: {llmReady ? 'caricato' : 'non caricato'}. Path salvato in AsyncStorage ({LLM_MODEL_PATH_KEY}).
            {USE_BUNDLED_LLM_WHEN_NO_PATH && Platform.OS === 'ios'
              ? ' All’avvio (iOS), se non c’è path salvato, si usa il GGUF nel bundle nativo: aggiungi il file in Xcode → Copy Bundle Resources e ricompila.'
              : USE_BUNDLED_LLM_WHEN_NO_PATH && Platform.OS === 'android'
                ? ' Android: imposta un path assoluto al .gguf sul dispositivo (il bundle JS non può includere file così grandi).'
                : ' Imposta un path al .gguf o (solo iOS) risorsa in bundle con «Modello da asset».'}
          </Text>
          <TextInput
            style={styles.llmInput}
            value={llmPath}
            onChangeText={setLlmPath}
            placeholder="/percorso/al/modello.gguf"
            placeholderTextColor={colors.textHint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.llmRow}>
            <Text style={styles.llmSub}>Modello da asset bundle (is_model_asset)</Text>
            <Switch value={llmAsAsset} onValueChange={setLlmAsAsset} />
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => void saveLlmPath()} activeOpacity={0.85}>
            <Text style={styles.btnLabel}>Salva path e inizializza Llama</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={applyBundledGemma} activeOpacity={0.85}>
            <Text style={styles.btnSecondaryLabel}>
              Gemma in bundle (solo iOS: Xcode + is_model_asset)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={applyDefaultFromConfig} activeOpacity={0.85}>
            <Text style={styles.btnSecondaryLabel}>Copia path da DEFAULT_LLM_FILESYSTEM_PATH</Text>
          </TouchableOpacity>
        </View>
        {snapshotJson ? (
          <Text style={styles.mono} selectable>
            {snapshotJson}
          </Text>
        ) : (
          <Text style={styles.empty}>Nessuna raccolta ancora. Tocca il pulsante sotto.</Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={() => void runCollect()}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryDarkLabel} />
          ) : (
            <Text style={styles.btnLabel}>Esegui raccolta ora</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
