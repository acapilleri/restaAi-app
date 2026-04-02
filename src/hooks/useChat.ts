import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { ActionCable } from '@kesha-antonov/react-native-action-cable';
import {
  confirmChatAction as confirmChatActionApi,
  getChatHistory,
  sendMessage,
  setMessageReaction,
  type ConfirmChatPayload,
  type QuickChip,
  type SendMessageOptions,
} from '../api/chat';
import { isClientGeneratedMessageId } from '../utils/clientMessageId';
import { wantsNearbyRestaurantContext } from '../chat/nearbyIntent';
import { normalizeChatCardsFromWire } from '../chat/normalizeWsCards';
import { ensureLocationPermission, getCurrentCoordinates } from '../services/geolocation';
import { parseCardsFromHistory } from '../chat/parseCards';
import {
  APPLE_HEALTH_STORAGE_KEYS,
  compactAppleHealthPayload,
  fetchAppleHealthSnapshotCached,
  serializeAppleHealthSnapshot,
} from '../services/appleHealth';
import { CABLE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import type { AiMessage, MessageReaction } from '../types/chat';
import { isHealthDataFresh } from '../utils/healthDataFreshness';
import { hapticIncomingSoft, hapticTypingStart } from '../utils/haptics';

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function sanitizeQuickChips(input: unknown): QuickChip[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const normalized: QuickChip[] = [];
  for (const item of input) {
    let chip: QuickChip | null = null;
    if (typeof item === 'string') {
      const label = item.trim();
      if (label) {
        chip = { label, action: { type: 'message', text: label } };
      }
    } else if (item && typeof item === 'object') {
      const wire = item as Record<string, unknown>;
      const label = typeof wire.label === 'string' ? wire.label.trim() : '';
      if (label) {
        const action = wire.action as Record<string, unknown> | undefined;
        if (action?.type === 'navigate') {
          const route = action.route;
          if (
            route === 'Chat' ||
            route === 'Dieta' ||
            route === 'Today' ||
            route === 'Foto' ||
            route === 'Profilo' ||
            route === 'Salute'
          ) {
            chip = { label, action: { type: 'navigate', route } };
          } else {
            chip = { label, action: { type: 'message', text: label } };
          }
        } else if (action?.type === 'message') {
          const text = typeof action.text === 'string' ? action.text.trim() : '';
          chip = { label, action: { type: 'message', text: text || label } };
        } else {
          chip = { label, action: { type: 'message', text: label } };
        }
      }
    }
    if (!chip || seen.has(chip.label)) continue;
    seen.add(chip.label);
    normalized.push(chip);
  }
  return normalized;
}

const NO_PLAN_TIPS_TITLE = '### Suggerimenti rapidi per iniziare';
const NO_PLAN_TIPS = [
  '- Inviami un esempio di giornata alimentare (colazione, pranzo, cena e spuntini).',
  '- Dimmi il tuo obiettivo (dimagrire, mantenere o aumentare massa).',
  '- Segnalami allergie/intolleranze e preferenze alimentari.',
  '- Se vuoi, apri la sezione piano dieta dall\'app: `restaai://dieta`.',
].join('\n');

function enrichAssistantTextWhenNoPlan(text: string): string {
  const normalized = typeof text === 'string' ? text.trim() : '';
  if (!normalized) return normalized;
  if (normalized.includes(NO_PLAN_TIPS_TITLE)) return normalized;

  const noPlanPattern =
    /(non\s+hai\s+ancora\s+un?\s+piano\s+alimentare|non\s+risulta\s+un?\s+piano\s+alimentare|nessun\s+piano\s+alimentare|diet\s+plan\s+non\s+presente|no\s+diet\s+plan)/i;
  if (!noPlanPattern.test(normalized)) return normalized;

  return `${normalized}\n\n${NO_PLAN_TIPS_TITLE}\n${NO_PLAN_TIPS}`;
}

export function useChat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [reactionPickerForId, setReactionPickerForId] = useState<string | null>(null);
  const [quickChips, setQuickChips] = useState<QuickChip[]>([]);
  const seenIds = useRef(new Set<string>());
  /** Mappa `request_id` WS → `id` corrente del messaggio in lista (merge stream / id server). */
  const requestIdToLocalIdRef = useRef(new Map<string, string>());
  const messagesRef = useRef<AiMessage[]>([]);
  messagesRef.current = messages;
  const lastConversationIdRef = useRef<string>('global');
  const typingHapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTypingHapticTimer = useCallback(() => {
    if (!typingHapticTimerRef.current) return;
    clearTimeout(typingHapticTimerRef.current);
    typingHapticTimerRef.current = null;
  }, []);

  const mapHistoryMessage = useCallback((raw: {
    id: string;
    role: 'user' | 'assistant' | 'system_log';
    text: string;
    timestamp: string;
    reaction?: MessageReaction | null;
    cards?: unknown;
    request_id?: string | null;
  }): AiMessage => ({
    id: raw.id,
    role: raw.role,
    text: raw.role === 'assistant' ? enrichAssistantTextWhenNoPlan(raw.text) : raw.text,
    cards: parseCardsFromHistory(raw.cards),
    timestamp: new Date(raw.timestamp),
    requestId:
      typeof raw.request_id === 'string' && raw.request_id.trim() ? raw.request_id.trim() : undefined,
    reaction: raw.reaction ?? null,
  }), []);

  const loadLatestHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await getChatHistory({ limit: 10 });
      const items = res.messages.map((m) =>
        mapHistoryMessage({
          id: m.id,
          role: m.role,
          text: m.text,
          timestamp: m.timestamp,
          reaction: (m.reaction ?? null) as MessageReaction | null,
          cards: m.cards,
          request_id: m.request_id,
        }),
      );
      setMessages(items);
      setHasMoreHistory(Boolean(res.page?.has_more));
      setNextBeforeId(res.page?.next_before_id ?? null);
      if (Array.isArray(res.quick_chips)) {
        setQuickChips(sanitizeQuickChips(res.quick_chips));
      }
      seenIds.current = new Set(items.map((m) => m.id));
      requestIdToLocalIdRef.current.clear();
      for (const msg of items) {
        if (msg.requestId) requestIdToLocalIdRef.current.set(msg.requestId, msg.id);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Errore di rete';
      Alert.alert('Storico non disponibile', msg);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [mapHistoryMessage]);

  const refreshLatestHistory = useCallback(async () => {
    setIsHistoryRefreshing(true);
    try {
      const res = await getChatHistory({ limit: 10 });
      const items = res.messages.map((m) =>
        mapHistoryMessage({
          id: m.id,
          role: m.role,
          text: m.text,
          timestamp: m.timestamp,
          reaction: (m.reaction ?? null) as MessageReaction | null,
          cards: m.cards,
          request_id: m.request_id,
        }),
      );
      setMessages(items);
      setHasMoreHistory(Boolean(res.page?.has_more));
      setNextBeforeId(res.page?.next_before_id ?? null);
      if (Array.isArray(res.quick_chips)) {
        setQuickChips(sanitizeQuickChips(res.quick_chips));
      }
      seenIds.current = new Set(items.map((m) => m.id));
      requestIdToLocalIdRef.current.clear();
      for (const msg of items) {
        if (msg.requestId) requestIdToLocalIdRef.current.set(msg.requestId, msg.id);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Errore di rete';
      Alert.alert('Refresh fallito', msg);
    } finally {
      setIsHistoryRefreshing(false);
    }
  }, [mapHistoryMessage]);

  const loadOlderHistory = useCallback(async () => {
    if (isLoadingOlder || !hasMoreHistory || !nextBeforeId) return;
    setIsLoadingOlder(true);
    try {
      const res = await getChatHistory({ limit: 10, before_id: nextBeforeId });
      const older = res.messages
        .map((m) =>
          mapHistoryMessage({
            id: m.id,
            role: m.role,
            text: m.text,
            timestamp: m.timestamp,
            reaction: (m.reaction ?? null) as MessageReaction | null,
            cards: m.cards,
            request_id: m.request_id,
          }),
        )
        .filter((m) => !seenIds.current.has(m.id));

      older.forEach((m) => {
        seenIds.current.add(m.id);
        if (m.requestId) requestIdToLocalIdRef.current.set(m.requestId, m.id);
      });
      setMessages((prev) => [...older, ...prev]);
      setHasMoreHistory(Boolean(res.page?.has_more));
      setNextBeforeId(res.page?.next_before_id ?? null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Errore di rete';
      Alert.alert('Caricamento messaggi precedenti fallito', msg);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [hasMoreHistory, isLoadingOlder, mapHistoryMessage, nextBeforeId]);

  useEffect(() => {
    if (!token) {
      setMessages([]);
      setQuickChips([]);
      setHasMoreHistory(false);
      setNextBeforeId(null);
      seenIds.current.clear();
      requestIdToLocalIdRef.current.clear();
      return;
    }
    loadLatestHistory();
  }, [loadLatestHistory, token]);

  useEffect(() => {
    if (!token) return;

    const consumerUrl = `${CABLE_URL}?token=${encodeURIComponent(token)}`;

    // Ensure stale consumer/subscriptions are dropped before re-subscribing.
    ActionCable.disconnectConsumer(consumerUrl);
    const consumer = ActionCable.getOrCreateConsumer(consumerUrl);

    const subscription = consumer.subscriptions.create({
      channel: 'ChatChannel',
      conversation_id: 'global',
    });

    subscription
      .on('received', (raw: unknown) => {
        let data = raw;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data || typeof data !== 'object') return;

        let frame: unknown = (data as { message?: unknown }).message ?? data;
        if (typeof frame === 'string') {
          try {
            frame = JSON.parse(frame);
          } catch {
            return;
          }
        }
        if (!frame || typeof frame !== 'object') return;

        const event = (frame as { event?: unknown }).event;
        const payload = (frame as { payload?: unknown }).payload;
        if (typeof event !== 'string' || !event.startsWith('chat.')) return;
        if (!payload || typeof payload !== 'object') return;

        const typedPayload = payload as Record<string, unknown>;

        if (event === 'chat.message' || event === 'chat.system_log') {
          const requestIdFromPayload =
            typeof typedPayload.request_id === 'string' && typedPayload.request_id.trim()
              ? typedPayload.request_id.trim()
              : null;

          const idFromPayload =
            typeof typedPayload.id === 'string' && typedPayload.id
              ? typedPayload.id
              : typeof typedPayload.id === 'number'
                ? String(typedPayload.id)
                : null;

          const text = typeof typedPayload.text === 'string' ? typedPayload.text : '';
          const cardsWire = Array.isArray(typedPayload.cards) ? typedPayload.cards : [];
          if (!text.trim() && cardsWire.length === 0) return;

          const payloadRole = typedPayload.role;
          const role: AiMessage['role'] =
            payloadRole === 'user' || payloadRole === 'assistant' || payloadRole === 'system_log'
              ? payloadRole
              : event === 'chat.system_log'
                ? 'system_log'
                : 'assistant';

          const timestamp =
            typeof typedPayload.timestamp === 'string'
              ? new Date(typedPayload.timestamp)
              : new Date();

          if (requestIdFromPayload) {
            const existingLocalId = requestIdToLocalIdRef.current.get(requestIdFromPayload);
            if (existingLocalId) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== existingLocalId) return m;
                  const nextId = idFromPayload ?? existingLocalId;
                  if (m.id !== nextId) {
                    seenIds.current.delete(m.id);
                    seenIds.current.add(nextId);
                    requestIdToLocalIdRef.current.set(requestIdFromPayload, nextId);
                  }
                  return {
                    ...m,
                    id: nextId,
                    role,
                    text: role === 'assistant' ? enrichAssistantTextWhenNoPlan(text) : text,
                    cards: role === 'assistant' ? normalizeChatCardsFromWire(cardsWire) : [],
                    timestamp,
                    requestId: requestIdFromPayload,
                  };
                }),
              );
              if (Array.isArray(typedPayload.quick_chips)) {
                setQuickChips(sanitizeQuickChips(typedPayload.quick_chips));
              }
              clearTypingHapticTimer();
              setIsTyping(false);
              void hapticIncomingSoft();
              return;
            }
          }

          const id =
            idFromPayload ?? makeId(event === 'chat.system_log' ? 'system-log' : 'assistant');

          if (seenIds.current.has(id)) return;

          if (seenIds.current.size > 500) {
            seenIds.current.clear();
          }

          seenIds.current.add(id);
          if (requestIdFromPayload) {
            requestIdToLocalIdRef.current.set(requestIdFromPayload, id);
          }

          const aiMsg: AiMessage = {
            id,
            role,
            text: role === 'assistant' ? enrichAssistantTextWhenNoPlan(text) : text,
            cards: role === 'assistant' ? normalizeChatCardsFromWire(cardsWire) : [],
            timestamp,
            ...(requestIdFromPayload ? { requestId: requestIdFromPayload } : {}),
          };
          setMessages((prev) => [...prev, aiMsg]);

          if (Array.isArray(typedPayload.quick_chips)) {
            setQuickChips(sanitizeQuickChips(typedPayload.quick_chips));
          }
          clearTypingHapticTimer();
          setIsTyping(false);
          void hapticIncomingSoft();
          return;
        }

        if (event === 'chat.reaction') {
          const messageIdRaw = typedPayload.message_id;
          const message_id =
            typeof messageIdRaw === 'string'
              ? messageIdRaw
              : typeof messageIdRaw === 'number'
                ? String(messageIdRaw)
                : null;
          const requestIdRaw = typedPayload.request_id;
          const request_id =
            typeof requestIdRaw === 'string' && requestIdRaw.trim()
              ? requestIdRaw.trim()
              : null;
          const reactionRaw = typedPayload.reaction;
          const reaction: MessageReaction | null =
            reactionRaw === 'like' ? 'like' : reactionRaw === 'dislike' ? 'dislike' : null;
          if (!message_id && !request_id) return;
          setMessages((prev) =>
            prev.map((m) => {
              const match =
                Boolean(message_id && m.id === message_id) ||
                Boolean(request_id && m.requestId === request_id);
              return match ? { ...m, reaction, reactionPending: false } : m;
            }),
          );
          return;
        }

        if (event === 'chat.status' && typedPayload.status === 'done') {
          clearTypingHapticTimer();
          setIsTyping(false);
          return;
        }

        if (event === 'chat.error') {
          clearTypingHapticTimer();
          setIsTyping(false);
        }
      })
      .on('connected', () => {
        console.log('[Chat] connesso');
      })
      .on('disconnected', () => {
        console.log('[Chat] disconnesso');
      });

    return () => {
      subscription.unsubscribe();
      ActionCable.disconnectConsumer(consumerUrl);
    };
  }, [clearTypingHapticTimer, token]);

  useEffect(() => {
    return () => {
      clearTypingHapticTimer();
    };
  }, [clearTypingHapticTimer]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      let opts: SendMessageOptions | undefined;
      if (wantsNearbyRestaurantContext(text)) {
        try {
          const ok = await ensureLocationPermission();
          if (ok) {
            const { latitude, longitude } = await getCurrentCoordinates();
            opts = {
              ...opts,
              location_context: {
                latitude,
                longitude,
                captured_at: new Date().toISOString(),
              },
            };
          }
        } catch {
          /* posizione non disponibile */
        }
      }
      if (Platform.OS === 'ios') {
        try {
          const linked = await AsyncStorage.getItem(APPLE_HEALTH_STORAGE_KEYS.linked);
          if (linked === '1') {
            const snap = await fetchAppleHealthSnapshotCached();
            const serialized = serializeAppleHealthSnapshot(snap);
            const compacted = compactAppleHealthPayload(serialized);
            const withTs = {
              ...compacted,
              recorded_at: new Date().toISOString(),
              raw_data: serialized,
            };
            if (isHealthDataFresh(withTs)) {
              opts = { ...opts, health_data: withTs };
            }
          }
        } catch (e) {
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('[Chat] HealthKit snapshot skipped:', e);
          }
        }
      }
      await sendMessage(text, opts);
    },
    onMutate: (text) => {
      clearTypingHapticTimer();
      const userMsg: AiMessage = {
        id: makeId('user'),
        role: 'user',
        text,
        cards: [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);
      typingHapticTimerRef.current = setTimeout(() => {
        hapticTypingStart();
        typingHapticTimerRef.current = null;
      }, 500);
    },
    onError: (err) => {
      clearTypingHapticTimer();
      setIsTyping(false);
      const msg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Errore di rete';
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Chat] invio messaggio fallito:', err);
      }
      Alert.alert('Messaggio non inviato', msg);
    },
  });

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMutation.mutate(text);
    },
    [sendMutation],
  );

  const confirmChatAction = useCallback(async (payload: ConfirmChatPayload) => {
    try {
      await confirmChatActionApi(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore di rete';
      Alert.alert('Conferma non riuscita', msg);
      throw e;
    }
  }, []);

  const reactionMutation = useMutation({
    mutationFn: async (
      vars:
        | { message_id: string; reaction: MessageReaction | null; request_id?: never }
        | { request_id: string; reaction: MessageReaction | null; message_id?: never },
    ) => {
      return setMessageReaction({
        ...vars,
        conversation_id: lastConversationIdRef.current,
      });
    },
    onSuccess: (data, vars) => {
      const resolvedId = data.message_id != null ? String(data.message_id) : null;
      setMessages((prev) =>
        prev.map((m) => {
          const matchesRequest =
            'request_id' in vars && vars.request_id && m.requestId === vars.request_id;
          const matchesMessageId =
            'message_id' in vars && vars.message_id && m.id === vars.message_id;
          if (!matchesRequest && !matchesMessageId) return m;
          let next: AiMessage = {
            ...m,
            reaction: (data.reaction ?? m.reaction) as MessageReaction | null,
            reactionPending: false,
          };
          if (resolvedId && m.id !== resolvedId && (matchesRequest || matchesMessageId)) {
            seenIds.current.delete(m.id);
            seenIds.current.add(resolvedId);
            if (m.requestId) requestIdToLocalIdRef.current.set(m.requestId, resolvedId);
            next = { ...next, id: resolvedId };
          }
          return next;
        }),
      );
    },
    onError: (err, vars) => {
      const msg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Errore di rete';
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Chat] reaction sync fallito:', err);
      }
      setMessages((prev) =>
        prev.map((m) => {
          const hit =
            ('message_id' in vars && vars.message_id && m.id === vars.message_id) ||
            ('request_id' in vars && vars.request_id && m.requestId === vars.request_id);
          return hit ? { ...m, reactionPending: true } : m;
        }),
      );
      Alert.alert('Reazione non sincronizzata', msg);
    },
  });

  const openReactionPicker = useCallback((messageId: string) => {
    setReactionPickerForId(messageId);
  }, []);

  const closeReactionPicker = useCallback(() => {
    setReactionPickerForId(null);
  }, []);

  const setReaction = useCallback(
    (messageId: string, reaction: MessageReaction | null) => {
      const target = messagesRef.current.find((m) => m.id === messageId);
      const useRequestId =
        Boolean(target?.requestId && target.id && isClientGeneratedMessageId(target.id));

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reaction, reactionPending: true } : m,
        ),
      );
      if (useRequestId && target?.requestId) {
        reactionMutation.mutate({ request_id: target.requestId, reaction });
      } else {
        reactionMutation.mutate({ message_id: messageId, reaction });
      }
      setReactionPickerForId(null);
    },
    [reactionMutation],
  );

  const reactionUi = useMemo(
    () => ({ pickerForId: reactionPickerForId }),
    [reactionPickerForId],
  );

  return {
    messages,
    quickChips,
    isTyping,
    isHistoryLoading,
    isHistoryRefreshing,
    isLoadingOlder,
    hasMoreHistory,
    isSending: sendMutation.isPending,
    sendMessage: send,
    loadLatestHistory,
    refreshLatestHistory,
    loadOlderHistory,
    confirmChatAction,
    reactionUi,
    openReactionPicker,
    closeReactionPicker,
    setReaction,
  };
}
