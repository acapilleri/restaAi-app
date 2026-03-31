import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { updateProfile } from '../api/profile';
import { createWeight } from '../api/weights';
import type { AppStackParamList } from '../navigation/rootTypes';
import { createOnboardingMessage, getOnboardingConfig } from '../api/onboarding';
import {
  FALLBACK_ONBOARDING_MENU_CHIP,
  FALLBACK_ONBOARDING_YC_STEPS,
  type OnboardingYcStep,
} from '../onboarding/stepsYc';
import { parseProfileHints } from '../onboarding/parseProfileHints';
import { setOnboardingCompleted } from '../onboarding/onboardingStorage';
import { resolveOnboardingUserKey } from '../onboarding/onboardingUserKey';
import { hapticLight } from '../utils/haptics';
import { CoachTypingDots } from '../components/chat/CoachTypingDots';
import { QuickChips } from '../components/chat/QuickChips';
type Entry =
  | { kind: 'coach'; id: string; text: string }
  | { kind: 'user'; id: string; text: string }
  | { kind: 'system'; id: string; text: string };

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
}

export function OnboardingChatScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList, 'OnboardingChat'>>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [ycSteps, setYcSteps] = useState<OnboardingYcStep[]>(FALLBACK_ONBOARDING_YC_STEPS);
  const [menuChip, setMenuChip] = useState(FALLBACK_ONBOARDING_MENU_CHIP);
  const [configReady, setConfigReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [input, setInput] = useState('');
  const [showTyping, setShowTyping] = useState(true);
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const listRef = useRef<FlatList<Entry>>(null);
  const inputRef = useRef<TextInput>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [entries, showTyping, scrollToEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getOnboardingConfig();
        if (!cancelled && cfg.steps.length > 0) {
          setYcSteps(cfg.steps);
          setMenuChip(cfg.menu_chip);
        }
      } catch {
        /* usa FALLBACK_* già negli useState */
      } finally {
        if (!cancelled) setConfigReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!configReady) return;
    let alive = true;
    (async () => {
      await delay(900);
      if (!alive) return;
      setShowTyping(false);
      setEntries((prev) => {
        if (prev.length > 0) return prev;
        const first = ycSteps[0];
        if (!first) return prev;
        return [{ kind: 'coach', id: makeId('c'), text: first.coach }];
      });
    })();
    return () => {
      alive = false;
    };
  }, [configReady, ycSteps]);

  const resetToMain = useCallback(
    (tabIndex: number, chatParams?: { initialPrompt: string; autoSend: boolean }) => {
      const routes = [
        chatParams
          ? {
              name: 'Chat' as const,
              params: {
                initialPrompt: chatParams.initialPrompt,
                autoSend: chatParams.autoSend,
                source: 'onboarding' as const,
                triggerId: 'onboarding-yc',
              },
            }
          : { name: 'Chat' as const },
        { name: 'Today' as const },
        { name: 'Foto' as const },
        { name: 'Profilo' as const },
      ];
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              state: {
                routes,
                index: tabIndex,
              },
            },
          ],
        }),
      );
    },
    [navigation],
  );

  const completeOnboarding = useCallback(
    async (userText: string, answeredStep: number) => {
      setFinishing(true);
      try {
        const key = await resolveOnboardingUserKey(user);
        await setOnboardingCompleted(key);

        const menu = userText.trim() === menuChip;

        if (!menu) {
          const hints = parseProfileHints(userText);
          const payload: Parameters<typeof updateProfile>[0] = {};
          if (hints.age != null) payload.age = hints.age;
          if (hints.height_cm != null) payload.height_cm = hints.height_cm;
          if (hints.goal_weight_kg != null) payload.goal_weight_kg = hints.goal_weight_kg;
          if (hints.age != null || hints.height_cm != null || hints.goal_weight_kg != null) {
            payload.plan_type = 'Personalizzato onboarding';
          }

          if (Object.keys(payload).length > 0) {
            try {
              await updateProfile(payload);
            } catch {
              // continua comunque verso l'app
            }
          }

          if (hints.current_weight_kg != null) {
            try {
              await createWeight(hints.current_weight_kg);
            } catch {
              // opzionale
            }
          }
        }

        const step = ycSteps[answeredStep];
        try {
          await createOnboardingMessage({
            message: userText.trim(),
            step_label: step?.label ?? '',
            step_index: answeredStep,
            total_steps: ycSteps.length,
            flow: 'yc',
            source: 'mobile_onboarding',
          });
        } catch {
          // continua verso la chat anche se l'invio fallisce
        }

        resetToMain(0);
      } finally {
        setFinishing(false);
      }
    },
    [resetToMain, user, menuChip, ycSteps],
  );

  const advanceAfterUserMessage = useCallback(
    async (userText: string, answeredStep: number) => {
      const isLast = answeredStep === ycSteps.length - 1;
      if (isLast) {
        await completeOnboarding(userText, answeredStep);
        return;
      }

      const previousExtract = ycSteps[answeredStep]?.extract ?? null;
      const nextStep = answeredStep + 1;
      setCurrentStep(nextStep);

      await delay(320);
      if (previousExtract) {
        setEntries((prev) => [...prev, { kind: 'system', id: makeId('s'), text: previousExtract }]);
      }

      setShowTyping(true);
      await delay(800);
      setShowTyping(false);
      const nextCoach = ycSteps[nextStep]?.coach ?? '';
      setEntries((prev) => [...prev, { kind: 'coach', id: makeId('c'), text: nextCoach }]);
    },
    [completeOnboarding, ycSteps],
  );

  const submitUserText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy || finishing || !configReady) return;
      if (showTyping && entries.length === 0) return;

      setBusy(true);
      setInput('');
      const userEntry: Entry = { kind: 'user', id: makeId('u'), text };
      setEntries((prev) => [...prev, userEntry]);

      const answeredStep = currentStep;
      try {
        await advanceAfterUserMessage(text, answeredStep);
      } finally {
        setBusy(false);
      }
    },
    [busy, finishing, configReady, showTyping, entries.length, currentStep, advanceAfterUserMessage],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || busy || finishing || !configReady) return;
    if (showTyping && entries.length === 0) return;
    hapticLight();
    void submitUserText(input);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [input, busy, finishing, configReady, showTyping, entries.length, submitUserText]);

  const onChipPress = useCallback(
    (label: string) => {
      void submitUserText(label);
    },
    [submitUserText],
  );

  const chips = ycSteps[currentStep]?.chips ?? [];
  const stepLabel = ycSteps[currentStep]?.label ?? '';

  const SCREEN_BG = colors.chatScreenBg;
  const LINE = colors.chatLine;
  const SHELL_BG = colors.chatShellBg;
  const BUBBLE_BORDER = colors.chatBubbleBorder;
  const MUTED = colors.chatMuted;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: SCREEN_BG,
        },
        flex: { flex: 1, width: '100%' },
        sheet: {
          flex: 1,
          width: '100%',
          backgroundColor: SCREEN_BG,
          overflow: 'hidden',
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
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
        headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
        statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' },
        headerSub: { fontSize: 11, fontWeight: '600', color: colors.primary },
        progressWrap: {
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
          backgroundColor: SCREEN_BG,
          borderBottomWidth: 1,
          borderBottomColor: LINE,
        },
        progressRow: { flexDirection: 'row', gap: 6 },
        progressSeg: { flex: 1, height: 4, borderRadius: 999, backgroundColor: colors.chatLine },
        progressSegDone: { backgroundColor: colors.primaryMuted },
        progressSegActive: { backgroundColor: colors.primary },
        stepLabel: {
          marginTop: 8,
          fontSize: 11,
          color: MUTED,
          fontWeight: '700',
          letterSpacing: 0.6,
        },
        chatGradient: {
          flex: 1,
          backgroundColor: SCREEN_BG,
          borderTopWidth: 0,
        },
        listContent: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 20, gap: 0 },
        rowCoach: { alignSelf: 'flex-start', maxWidth: '98%', marginBottom: 14 },
        rowUser: { alignSelf: 'flex-end', maxWidth: '98%', marginBottom: 14 },
        bubbleCoach: {
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: BUBBLE_BORDER,
          borderRadius: 18,
          borderBottomLeftRadius: 5,
          paddingVertical: 13,
          paddingHorizontal: 16,
          ...Platform.select({
            ios: { shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 1 },
          }),
        },
        bubbleCoachText: { fontSize: 16, lineHeight: 24, color: colors.textPrimary },
        bubbleUser: {
          backgroundColor: colors.primary,
          borderRadius: 18,
          borderBottomRightRadius: 5,
          paddingVertical: 13,
          paddingHorizontal: 16,
        },
        bubbleUserText: { fontSize: 16, lineHeight: 24, color: colors.textOnPrimary },
        systemChipWrap: { alignSelf: 'flex-start', marginBottom: 14, maxWidth: '92%' },
        systemChipText: {
          fontSize: 11,
          color: colors.primaryDarkLabel,
          backgroundColor: colors.greenPill,
          borderWidth: 1,
          borderColor: colors.primaryMuted,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 999,
          overflow: 'hidden',
        },
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
        finishingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [colors, isDark],
  );

  const renderItem = useCallback(
    ({ item }: { item: Entry }) => {
      if (item.kind === 'system') {
        return (
          <View style={styles.systemChipWrap}>
            <Text style={styles.systemChipText}>✓ {item.text}</Text>
          </View>
        );
      }
      if (item.kind === 'user') {
        return (
          <View style={styles.rowUser}>
            <View style={styles.bubbleUser}>
              <Text style={styles.bubbleUserText}>{item.text}</Text>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.rowCoach}>
          <View style={styles.bubbleCoach}>
            <Text style={styles.bubbleCoachText}>{item.text}</Text>
          </View>
        </View>
      );
    },
    [styles],
  );

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
              <Text style={styles.headerTitle}>RestaAI Coach</Text>
              <View style={styles.headerSubRow}>
                <View style={styles.statusDot} />
                <Text style={styles.headerSub}>Ti aiuta nei momenti critici</Text>
              </View>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.progressRow}>
              {ycSteps.map((_, i) => (
                <View
                  key={String(i)}
                  style={[
                    styles.progressSeg,
                    i < currentStep && styles.progressSegDone,
                    i === currentStep && styles.progressSegActive,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.stepLabel}>{stepLabel.toUpperCase()}</Text>
          </View>

          <View style={styles.chatGradient}>
            <FlatList
              ref={listRef}
              data={entries}
              keyExtractor={(i) => i.id}
              renderItem={renderItem}
              ListFooterComponent={
                showTyping ? (
                  <View style={styles.rowCoach}>
                    <CoachTypingDots />
                  </View>
                ) : null
              }
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          </View>

          <View style={styles.inputArea}>
            <QuickChips
              variant="onboarding"
              chips={chips}
              onPress={onChipPress}
              disabled={busy || finishing || !configReady || (showTyping && entries.length === 0)}
            />
            <View style={styles.inputShell}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Scrivi un messaggio..."
                placeholderTextColor={colors.textHint}
                editable={!busy && !finishing && configReady}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || busy || finishing || !configReady) && styles.sendBtnOff]}
                onPress={handleSend}
                disabled={!input.trim() || busy || finishing || !configReady}
                accessibilityLabel="Invia"
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {!configReady || finishing ? (
        <View style={styles.finishingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
