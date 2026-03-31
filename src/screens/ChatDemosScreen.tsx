import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageRenderer } from '../components/chat/MessageRenderer';
import { MultiChoice, type MultiChoiceOption } from '../components/MultiChoice';
import type { AiMessage, MessageReaction } from '../types/chat';
import { useTheme } from '../context/ThemeContext';

type DemoMode = 'cards' | 'empty';

function makeDemoMessages(): AiMessage[] {
  return [
    {
      id: 'demo-welcome',
      role: 'assistant',
      text: 'Questa e una demo completa delle card supportate in chat.',
      cards: [],
      timestamp: new Date('2026-03-26T10:00:00.000Z'),
    },
    {
      id: 'demo-macro',
      role: 'assistant',
      text: 'Riepilogo macro di oggi.',
      cards: [
        {
          type: 'macro_summary',
          data: {
            kcal: 1850,
            proteine: 130,
            carboidrati: 190,
            grassi: 62,
            pasti: [
              { nome: 'Colazione', orario: '08:00', kcal: 420 },
              { nome: 'Pranzo', orario: '13:00', kcal: 680 },
              { nome: 'Cena', orario: '20:00', kcal: 750 },
            ],
          },
        },
      ],
      timestamp: new Date('2026-03-26T10:01:00.000Z'),
    },
    {
      id: 'demo-progress',
      role: 'assistant',
      text: 'Progresso pasti della giornata.',
      cards: [
        {
          type: 'meal_progress',
          data: {
            kcal_consumate: 1180,
            kcal_totali: 1850,
            prossimo_pasto: 'Cena',
            orario_prossimo: '20:00',
            percentuale: 64,
          },
        },
      ],
      timestamp: new Date('2026-03-26T10:02:00.000Z'),
    },
    {
      id: 'demo-weight',
      role: 'assistant',
      text: 'Confermi questo peso registrato?',
      cards: [
        {
          type: 'weight_confirm',
          data: {
            kg: 71.4,
            data: '2026-03-26',
          },
        },
      ],
      timestamp: new Date('2026-03-26T10:03:00.000Z'),
    },
    {
      id: 'demo-recipe',
      role: 'assistant',
      text: 'Alternativa bilanciata per il pranzo.',
      cards: [
        {
          type: 'recipe_alternative',
          data: {
            pasto: 'Pranzo',
            nome: 'Bowl pollo e riso',
            ingredienti: 'riso basmati, pollo, zucchine, olio EVO',
            proteine: 42,
            carboidrati: 58,
            grassi: 15,
            kcal: 535,
          },
        },
      ],
      timestamp: new Date('2026-03-26T10:04:00.000Z'),
    },
  ];
}

export function ChatDemosScreen() {
  const { colors } = useTheme();
  const SCREEN_BG = colors.chatScreenBg;
  const LINE = colors.chatLine;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: SCREEN_BG },
        flex: { flex: 1 },
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
        headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        modeRow: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: LINE,
          backgroundColor: SCREEN_BG,
        },
        modeBtn: {
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: colors.bgCard,
        },
        modeBtnActive: {
          borderColor: colors.primaryMuted,
          backgroundColor: colors.greenPill,
        },
        modeBtnText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.textSecondary,
        },
        modeBtnTextActive: {
          color: colors.primaryDark,
        },
        choicesSection: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: LINE,
          backgroundColor: SCREEN_BG,
          gap: 8,
        },
        choicesTitle: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.textPrimary,
        },
        choicesLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.textMuted,
        },
        choicesLabelSpaced: {
          marginTop: 6,
        },
        choicesValue: {
          fontSize: 12,
          color: colors.textSecondary,
        },
        listContent: {
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 20,
          flexGrow: 1,
        },
        emptyWrap: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 28,
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.textPrimary,
        },
        emptySub: {
          marginTop: 8,
          textAlign: 'center',
          color: colors.textSecondary,
          fontSize: 13,
          lineHeight: 19,
        },
      }),
    [colors],
  );

  const [mode, setMode] = useState<DemoMode>('cards');
  const [messages, setMessages] = useState<AiMessage[]>(() => makeDemoMessages());
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null);
  const [singleChoice, setSingleChoice] = useState<string[]>(['goal_recomp']);
  const [multiChoice, setMultiChoice] = useState<string[]>(['no_lattosio']);

  const choiceOptions: MultiChoiceOption[] = [
    { id: 'goal_cut', label: 'Definizione' },
    { id: 'goal_recomp', label: 'Ricomp. corporea' },
    { id: 'goal_bulk', label: 'Massa' },
  ];
  const dietaryOptions: MultiChoiceOption[] = [
    { id: 'no_lattosio', label: 'No lattosio' },
    { id: 'veg', label: 'Vegetariana' },
    { id: 'low_fodmap', label: 'Low FODMAP' },
    { id: 'gluten_free', label: 'Senza glutine' },
  ];

  const listData = useMemo(() => (mode === 'cards' ? messages : []), [messages, mode]);

  const setReaction = (messageId: string, reaction: MessageReaction | null) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reaction, reactionPending: false } : m)),
    );
    setReactionPickerForId(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Image source={require('../../assets/resta-coach-icon.png')} style={styles.avatarImage} />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerTitle}>Chat Demo</Text>
            <Text style={styles.headerSub}>Strutture card + stato vuoto</Text>
          </View>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, mode === 'cards' && styles.modeBtnActive]}
            onPress={() => setMode('cards')}
          >
            <Text style={[styles.modeBtnText, mode === 'cards' && styles.modeBtnTextActive]}>
              Demo strutture
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, mode === 'empty' && styles.modeBtnActive]}
            onPress={() => setMode('empty')}
          >
            <Text style={[styles.modeBtnText, mode === 'empty' && styles.modeBtnTextActive]}>
              Chat vuota
            </Text>
          </Pressable>
        </View>

        <View style={styles.choicesSection}>
          <Text style={styles.choicesTitle}>Demo MultiChoice</Text>
          <Text style={styles.choicesLabel}>Single choice</Text>
          <MultiChoice
            options={choiceOptions}
            selectedIds={singleChoice}
            onChange={setSingleChoice}
            multiple={false}
          />
          <Text style={styles.choicesValue}>
            Selezione: {singleChoice.length ? singleChoice.join(', ') : '(vuoto)'}
          </Text>

          <Text style={[styles.choicesLabel, styles.choicesLabelSpaced]}>Multi choice</Text>
          <MultiChoice
            options={dietaryOptions}
            selectedIds={multiChoice}
            onChange={setMultiChoice}
            multiple
          />
          <Text style={styles.choicesValue}>
            Selezione: {multiChoice.length ? multiChoice.join(', ') : '(vuoto)'}
          </Text>
        </View>

        <FlatList
          data={listData}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <MessageRenderer
              message={item}
              onConfirmChatAction={async () => undefined}
              reactionPickerOpen={reactionPickerForId === item.id}
              onOpenReactionPicker={setReactionPickerForId}
              onCloseReactionPicker={() => setReactionPickerForId(null)}
              onSetReaction={setReaction}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>Nessun messaggio</Text>
              <Text style={styles.emptySub}>
                Questa e la vista chat senza contenuti, utile per validare lo stato empty.
              </Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
