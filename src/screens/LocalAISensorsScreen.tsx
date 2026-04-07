/**
 * Lettura sensori + domande all'AI locale (ExecuTorch), separata dalla chat testuale.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Message } from 'react-native-executorch';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { useTheme } from '../context/ThemeContext';
import { useSensorFusion } from '../context/SensorFusionContext';
import { hapticLight } from '../utils/haptics';
import { getChatKeyboardAutoClose } from '../chat/keyboardPreference';
import {
  collectRawBundle,
  collectRawBundleLite,
  compactSensorBundleForLlm,
  fuseContextWithRules,
  getLastSensorBundleDebug,
  type RawSensorBundle,
} from '../services/SensorBundleService';
import {
  FormattedParagraphs,
  parseSensorLlmReply,
  stripMarkdownFencesForDisplay,
  SYSTEM_PROMPT_WITH_SENSORS,
  SENSOR_LIVE_INTERVAL_MS,
  trimPriorForSensorContext,
} from './localAi/shared';

type LocalMsg = { id: string; role: 'user' | 'assistant'; text: string };

export function LocalAISensorsScreen() {
  const { colors } = useTheme();
  const llm = useSensorFusion();
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [keyboardAutoClose, setKeyboardAutoClose] = useState(true);
  const [sensorRawJson, setSensorRawJson] = useState<string | null>(null);
  const [sensorFusedJson, setSensorFusedJson] = useState<string | null>(null);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [lastDebugJson, setLastDebugJson] = useState<string | null>(null);
  const [sensorInput, setSensorInput] = useState('');
  const [sensorLiveEverySecond, setSensorLiveEverySecond] = useState(false);
  const [sensorLastSampleLabel, setSensorLastSampleLabel] = useState<string | null>(null);
  const sensorInputRef = useRef<TextInput>(null);
  const lastBundleRef = useRef<RawSensorBundle | null>(null);

  useEffect(() => {
    let a = true;
    void (async () => {
      const enabled = await getChatKeyboardAutoClose();
      if (a) setKeyboardAutoClose(enabled);
    })();
    return () => {
      a = false;
    };
  }, []);

  useEffect(() => {
    if (!llm) return;
    const chunk = llm.response == null ? '' : String(llm.response);
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), { ...last, text: chunk }];
    });
  }, [llm, llm?.response]);

  useEffect(() => {
    return () => {
      if (llm?.isGenerating) llm.interrupt();
    };
  }, [llm]);

  const refreshSensorPanel = useCallback(async (options?: { showLoading?: boolean; lite?: boolean }) => {
    const showLoading = options?.showLoading !== false;
    const lite = options?.lite === true;
    if (!llm) return;
    if (showLoading) setSensorLoading(true);
    setSensorError(null);
    try {
      const bundle = lite ? await collectRawBundleLite() : await collectRawBundle();
      lastBundleRef.current = bundle;
      setSensorRawJson(JSON.stringify(bundle, null, 2));
      setSensorLastSampleLabel(
        new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
      try {
        const fused = fuseContextWithRules(bundle);
        setSensorFusedJson(JSON.stringify(fused, null, 2));
      } catch (e) {
        setSensorFusedJson(`// fusione fallita\n${e instanceof Error ? e.message : String(e)}`);
      }
      const snap = getLastSensorBundleDebug();
      setLastDebugJson(snap ? JSON.stringify(snap, null, 2) : null);
    } catch (e) {
      setSensorError(e instanceof Error ? e.message : String(e));
      setSensorRawJson(null);
      setSensorFusedJson(null);
      lastBundleRef.current = null;
    } finally {
      if (showLoading) setSensorLoading(false);
    }
  }, [llm]);

  useEffect(() => {
    if (!sensorLiveEverySecond || !llm?.isReady || llm.isGenerating) {
      return;
    }
    const tick = () => {
      void (async () => {
        try {
          await refreshSensorPanel({ showLoading: false, lite: true });
        } catch (e) {
          if (__DEV__) {
            console.warn('[LocalAISensorsScreen] tick sensori:', e);
          }
        }
      })();
    };
    const id = setInterval(tick, SENSOR_LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [sensorLiveEverySecond, llm?.isReady, llm?.isGenerating, refreshSensorPanel]);

  const handleSensorSend = useCallback(async () => {
    const userText = sensorInput.trim();
    if (!llm || !userText || !llm.isReady || llm.isGenerating) return;
    hapticLight();
    setSensorInput('');

    let bundle = lastBundleRef.current;
    if (!bundle) {
      setSensorLoading(true);
      setSensorError(null);
      try {
        bundle = await collectRawBundle();
        lastBundleRef.current = bundle;
        setSensorRawJson(JSON.stringify(bundle, null, 2));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSensorError(msg);
        setSensorLoading(false);
        return;
      }
      setSensorLoading(false);
    }

    const userId = `u-${Date.now()}`;
    const asstId = `a-${Date.now()}`;

    const prior: Message[] = [];
    for (const m of messages) {
      if (m.role === 'user') prior.push({ role: 'user', content: m.text });
      else prior.push({ role: 'assistant', content: m.text });
    }
    const priorTrimmed = trimPriorForSensorContext(prior);
    const compact = compactSensorBundleForLlm(bundle);
    const userContent = `Dati sensori (JSON compatto, con contesto inferito locale):\n${JSON.stringify(compact)}\n\nDomanda:\n${userText}`;
    const payload: Message[] = [
      { role: 'system', content: SYSTEM_PROMPT_WITH_SENSORS },
      ...priorTrimmed,
      { role: 'user', content: userContent },
    ];

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text: userText },
      { id: asstId, role: 'assistant', text: '' },
    ]);

    try {
      await llm.generate(payload);
    } catch {
      /* useLLM imposta già error */
    }

    requestAnimationFrame(() => {
      if (keyboardAutoClose) Keyboard.dismiss();
      else sensorInputRef.current?.focus();
    });
  }, [keyboardAutoClose, llm, messages, sensorInput]);

  const SCREEN_BG = colors.chatScreenBg;
  const LINE = colors.chatLine;
  const SHELL_BG = colors.chatShellBg;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: SCREEN_BG },
        flex: { flex: 1, width: '100%' },
        sheet: { flex: 1, width: '100%', backgroundColor: SCREEN_BG },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: SCREEN_BG,
          borderBottomWidth: 1,
          borderBottomColor: LINE,
        },
        avatar: {
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: { width: '100%', height: '100%' },
        headerTextCol: { flex: 1 },
        headerTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
        headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
        statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' },
        statusDotWarn: { backgroundColor: colors.amber },
        headerSub: { fontSize: 11, fontWeight: '600', color: colors.primary },
        headerSubMuted: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
        inputArea: {
          paddingHorizontal: 6,
          paddingTop: 14,
          paddingBottom: 14,
          backgroundColor: SCREEN_BG,
          borderTopWidth: 1,
          borderTopColor: LINE,
        },
        inputShell: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: SHELL_BG,
          borderRadius: 26,
          paddingLeft: 14,
          paddingRight: 6,
          paddingVertical: 6,
        },
        textInput: { flex: 1, fontSize: 16, color: colors.textPrimary, paddingVertical: 8, maxHeight: 120 },
        sendBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sendBtnOff: { opacity: 0.45 },
        sendIcon: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '600' },
        bannerText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
        err: { fontSize: 13, color: '#c62828', marginBottom: 8 },
        setupTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
        setupBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
        mono: {
          fontSize: 12,
          color: colors.textMuted,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          marginTop: 10,
        },
        sensorScroll: { flex: 1 },
        sensorScrollContent: { padding: 16, paddingBottom: 32 },
        sensorSectionTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.textPrimary,
          marginBottom: 10,
          marginTop: 16,
        },
        sensorSectionTitleFirst: { marginTop: 0 },
        sensorJsonCard: {
          marginBottom: 16,
          padding: 14,
          borderRadius: 14,
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.border,
        },
        sensorBody: {
          fontSize: 13,
          lineHeight: 21,
          color: colors.textPrimary,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        },
        sensorHint: {
          fontSize: 14,
          color: colors.textSecondary,
          lineHeight: 22,
          marginBottom: 12,
        },
        sensorCol: { flex: 1 },
        sensorReplyWrap: {
          marginBottom: 14,
          padding: 14,
          borderRadius: 14,
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.border,
        },
        sensorReplyTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 10 },
        sensorReplyBody: {
          fontSize: 16,
          color: colors.textPrimary,
          lineHeight: 25,
          letterSpacing: 0.15,
        },
        sensorQuickBtn: {
          alignSelf: 'flex-start',
          marginBottom: 12,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: colors.bgCard,
        },
        sensorQuickBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },
        sensorLoadPrimaryBtn: {
          marginBottom: 14,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: 'center',
        },
        sensorLoadPrimaryBtnDisabled: { opacity: 0.5 },
        sensorLoadPrimaryBtnText: { fontSize: 16, fontWeight: '700', color: colors.textOnPrimary },
        sensorEmptyNote: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
        sensorLiveRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingVertical: 8,
          paddingHorizontal: 4,
        },
        sensorLiveLabel: { flex: 1, paddingRight: 12, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
        sensorLiveSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
        sensorComprehensionCard: {
          marginBottom: 10,
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.suggestionBg,
          borderWidth: 1,
          borderColor: colors.suggestionBorder,
        },
        sensorComprehensionLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.suggestionLabel,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.35,
        },
      }),
    [colors, LINE, SCREEN_BG, SHELL_BG],
  );

  const headerStatus = useMemo(() => {
    if (!llm) return null;
    if (!llm.isReady) {
      return (
        <View style={styles.headerSubRow}>
          <View style={[styles.statusDot, styles.statusDotWarn]} />
          <Text style={styles.headerSubMuted}>Scaricamento modello… {Math.round(llm.downloadProgress * 100)}%</Text>
        </View>
      );
    }
    return (
      <View style={styles.headerSubRow}>
        <View style={styles.statusDot} />
        <Text style={styles.headerSub}>On-device · pronto</Text>
      </View>
    );
  }, [llm, styles]);

  const canSendSensor = llm && llm.isReady && !llm.isGenerating && sensorInput.trim().length > 0;

  const sensorLastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant') return m;
    }
    return undefined;
  }, [messages]);

  const showSensorTyping =
    !!llm?.isGenerating &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'assistant' &&
    !messages[messages.length - 1]?.text?.trim();

  const sensorAssistantText = sensorLastAssistant?.text ?? '';
  const sensorCleanText = useMemo(
    () => stripMarkdownFencesForDisplay(sensorAssistantText),
    [sensorAssistantText],
  );
  const sensorParts = useMemo(() => parseSensorLlmReply(sensorCleanText), [sensorCleanText]);

  if (!llm) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Image source={require('../../assets/resta-coach-icon.png')} style={styles.avatarImage} />
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.headerTitle}>Sensori · AI locale</Text>
                <Text style={styles.headerSubMuted}>Non disponibile</Text>
              </View>
              <DrawerMenuButton placement="trailing" />
            </View>
            <View style={{ padding: 20 }}>
              <Text style={styles.setupTitle}>Modulo non nel build</Text>
              <Text style={styles.setupBody}>
                Esegui da root del progetto <Text style={{ fontWeight: '700' }}>pod install</Text> e ricompila
                l&apos;app in Xcode (non basta reload Metro).
              </Text>
              <Text style={styles.mono}>{`cd ios && pod install\ncd ..`}</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Image source={require('../../assets/resta-coach-icon.png')} style={styles.avatarImage} />
            </View>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle}>Sensori · AI locale</Text>
              {headerStatus}
            </View>
            <DrawerMenuButton placement="trailing" />
          </View>

          <View style={styles.sensorCol}>
            <ScrollView
              style={styles.sensorScroll}
              contentContainerStyle={styles.sensorScrollContent}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={sensorLoading}
                  onRefresh={() => void refreshSensorPanel({ showLoading: true })}
                  tintColor={colors.primary}
                />
              }
            >
              <Text style={styles.sensorHint}>
                Attiva «Live» per campionare ogni ~2 s mentre sei qui (spento di default: meno rischio di crash con
                microfono/BLE). Oppure usa «Carica sensori» o trascina giù. Poi puoi fare domande all&apos;AI sul JSON.
              </Text>

              <View style={styles.sensorLiveRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sensorLiveLabel}>Live ogni ~2 s</Text>
                  {sensorLastSampleLabel ? (
                    <Text style={styles.sensorLiveSub}>Ultimo campione: {sensorLastSampleLabel} (senza mic)</Text>
                  ) : (
                    <Text style={styles.sensorLiveSub}>
                      In live non usiamo il microfono (meno crash iOS); audio completo con «Carica sensori».
                    </Text>
                  )}
                </View>
                <Switch
                  value={sensorLiveEverySecond}
                  onValueChange={setSensorLiveEverySecond}
                  trackColor={{ false: colors.border, true: colors.primaryMuted }}
                  thumbColor={sensorLiveEverySecond ? colors.primary : colors.textHint}
                  disabled={!llm.isReady}
                />
              </View>

              <TouchableOpacity
                style={[styles.sensorLoadPrimaryBtn, (!llm.isReady || sensorLoading) && styles.sensorLoadPrimaryBtnDisabled]}
                onPress={() => void refreshSensorPanel({ showLoading: true })}
                disabled={!llm.isReady || sensorLoading}
                accessibilityLabel="Carica o aggiorna i dati dei sensori"
              >
                <Text style={styles.sensorLoadPrimaryBtnText}>
                  {sensorLoading ? 'Lettura in corso…' : 'Carica sensori'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sensorQuickBtn}
                onPress={() =>
                  setSensorInput(
                    'Cosa deduci da questi sensori in questo momento? Poi, dopo la riga ---, una frase su come potrebbe influire su pasti o abitudini oggi.',
                  )
                }
                accessibilityLabel="Inserisci una domanda rapida sui sensori"
              >
                <Text style={styles.sensorQuickBtnText}>Domanda rapida: cosa capisce l&apos;AI?</Text>
              </TouchableOpacity>

              {sensorLastAssistant || showSensorTyping ? (
                <View style={styles.sensorReplyWrap}>
                  {showSensorTyping ? (
                    <>
                      <Text style={styles.sensorReplyTitle}>In generazione…</Text>
                      <TypingIndicator />
                    </>
                  ) : sensorAssistantText ? (
                    sensorParts.hasDivider ? (
                      <>
                        {sensorParts.comprehension ? (
                          <View style={styles.sensorComprehensionCard}>
                            <Text style={styles.sensorComprehensionLabel}>Comprensione (AI locale)</Text>
                            <FormattedParagraphs text={sensorParts.comprehension} style={styles.sensorReplyBody} />
                          </View>
                        ) : null}
                        {sensorParts.answer ? (
                          <>
                            <Text style={styles.sensorReplyTitle}>Risposta</Text>
                            <FormattedParagraphs text={sensorParts.answer} style={styles.sensorReplyBody} />
                          </>
                        ) : null}
                        {!sensorParts.comprehension && !sensorParts.answer ? (
                          <>
                            <Text style={styles.sensorReplyTitle}>Risposta modello</Text>
                            <FormattedParagraphs text={sensorCleanText} style={styles.sensorReplyBody} />
                          </>
                        ) : null}
                      </>
                    ) : llm.isGenerating ? (
                      <>
                        <Text style={styles.sensorReplyTitle}>Risposta (in arrivo)</Text>
                        <FormattedParagraphs text={sensorCleanText} style={styles.sensorReplyBody} />
                        <Text style={[styles.bannerText, { marginTop: 10, lineHeight: 20 }]}>
                          In streaming: quando compare la riga con solo ---, comprensione e risposta si separano.
                        </Text>
                      </>
                    ) : sensorCleanText.trim().length === 0 ? (
                      <>
                        <Text style={styles.sensorReplyTitle}>Nessun testo utile</Text>
                        <Text style={[styles.bannerText, { lineHeight: 20 }]}>
                          Il modello ha emesso solo formattazione (es. righe ```) senza contenuto. Riprova, oppure apri la
                          schermata «AI locale» dal menu per una domanda breve senza sensori.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.sensorReplyTitle}>Risposta modello</Text>
                        <FormattedParagraphs text={sensorCleanText} style={styles.sensorReplyBody} />
                        <Text style={[styles.bannerText, { marginTop: 10, lineHeight: 20 }]}>
                          Se non vedi due sezioni, il modello non ha messo la riga ---: mostriamo il testo ripulito dai
                          fence markdown.
                        </Text>
                      </>
                    )
                  ) : null}
                </View>
              ) : null}

              {sensorLoading && !sensorRawJson ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 }}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.bannerText}>Lettura sensori…</Text>
                </View>
              ) : null}
              {llm.error ? (
                <Text style={styles.err}>
                  {llm.error instanceof Error ? llm.error.message : String(llm.error)}
                </Text>
              ) : null}
              {sensorError ? <Text style={styles.err}>{sensorError}</Text> : null}
              <Text style={[styles.sensorSectionTitle, styles.sensorSectionTitleFirst]}>JSON grezzo</Text>
              <View style={styles.sensorJsonCard}>
                {sensorRawJson ? (
                  <Text selectable style={styles.sensorBody}>
                    {sensorRawJson}
                  </Text>
                ) : (
                  <Text style={styles.sensorEmptyNote}>
                    Nessun dato ancora. Tocca «Carica sensori» in alto o tira giù lo schermo (pull to refresh). Serve
                    accesso a posizione, calendario, Bluetooth, microfono e movimento se richiesto da iOS.
                  </Text>
                )}
              </View>
              <Text style={styles.sensorSectionTitle}>Contesto inferito (regole locali)</Text>
              <View style={styles.sensorJsonCard}>
                {sensorFusedJson ? (
                  <Text selectable style={styles.sensorBody}>
                    {sensorFusedJson}
                  </Text>
                ) : (
                  <Text style={styles.sensorEmptyNote}>
                    Appare dopo il primo caricamento sensori (stesse azioni del JSON grezzo).
                  </Text>
                )}
              </View>
              <Text style={styles.sensorSectionTitle}>Ultimo snapshot debug (se collectAndSend è stato eseguito)</Text>
              <View style={styles.sensorJsonCard}>
                <Text selectable style={styles.sensorBody}>
                  {lastDebugJson ?? 'Nessuno ancora — lo snapshot periodico in app può popolarlo.'}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.inputArea}>
              <View style={styles.inputShell}>
                <TextInput
                  ref={sensorInputRef}
                  style={styles.textInput}
                  value={sensorInput}
                  onChangeText={setSensorInput}
                  placeholder={llm.isReady ? 'Chiedi qualcosa usando i sensori…' : 'In attesa del modello…'}
                  placeholderTextColor={colors.textHint}
                  onSubmitEditing={handleSensorSend}
                  returnKeyType="send"
                  multiline
                  blurOnSubmit={keyboardAutoClose}
                  editable={llm.isReady && !llm.isGenerating}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !canSendSensor && styles.sendBtnOff]}
                  onPress={handleSensorSend}
                  disabled={!canSendSensor}
                  accessibilityLabel="Invia al modello con dati sensori"
                >
                  <Text style={styles.sendIcon}>↑</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
