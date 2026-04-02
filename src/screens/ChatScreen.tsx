import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { MessageRenderer } from '../components/chat/MessageRenderer';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { QuickChips } from '../components/chat/QuickChips';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import { useChat } from '../hooks/useChat';
import { hapticLight } from '../utils/haptics';
import type { MainParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import { getChatKeyboardAutoClose } from '../chat/keyboardPreference';
import { APPLE_HEALTH_STORAGE_KEYS, fetchAppleHealthSnapshotCached } from '../services/appleHealth';

export function ChatScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<DrawerNavigationProp<MainParamList>>();
  const route = useRoute<RouteProp<MainParamList, 'Chat'>>();
  const {
    messages,
    isTyping,
    isSending,
    isHistoryLoading,
    isHistoryRefreshing,
    isLoadingOlder,
    loadOlderHistory,
    refreshLatestHistory,
    sendMessage,
    quickChips,
    confirmChatAction,
    reactionUi,
    openReactionPicker,
    closeReactionPicker,
    setReaction,
  } = useChat();
  const [input, setInput] = useState('');
  const [keyboardAutoClose, setKeyboardAutoClose] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const lastMessageCountRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const lastHandledTriggerRef = useRef<string | null>(null);
  const initialPrompt = route.params?.initialPrompt?.trim() ?? '';
  const autoSend = route.params?.autoSend === true;
  const triggerId = route.params?.triggerId;
  const scrollToLatest = (animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setInput('');
    scrollToLatest(true);
    requestAnimationFrame(() => {
      if (keyboardAutoClose) Keyboard.dismiss();
      else inputRef.current?.focus();
    });
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const enabled = await getChatKeyboardAutoClose();
      if (active) setKeyboardAutoClose(enabled);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!autoSend || !initialPrompt) return;
    const key = triggerId ?? initialPrompt;
    if (lastHandledTriggerRef.current === key) return;
    lastHandledTriggerRef.current = key;
    sendMessage(initialPrompt);
    scrollToLatest(true);
  }, [autoSend, initialPrompt, sendMessage, triggerId]);

  useEffect(() => {
    const becameLonger = messages.length > lastMessageCountRef.current;
    if (becameLonger && !isLoadingOlder && isNearBottomRef.current) {
      scrollToLatest(true);
    }
    lastMessageCountRef.current = messages.length;
  }, [isLoadingOlder, messages.length]);

  useFocusEffect(
    React.useCallback(() => {
      // All'ingresso in schermata, porta in vista l'ultimo messaggio.
      scrollToLatest(false);
      const timer = setTimeout(() => scrollToLatest(true), 120);

      const keyboardShowSub = Keyboard.addListener('keyboardDidShow', () => {
        scrollToLatest(true);
      });

      let prefetchCancelled = false;
      const warmHealthSnapshotCache = async () => {
        if (Platform.OS !== 'ios') return;
        try {
          const linked = await AsyncStorage.getItem(APPLE_HEALTH_STORAGE_KEYS.linked);
          if (linked !== '1' || prefetchCancelled) return;
          await fetchAppleHealthSnapshotCached();
        } catch {
          // ignore: cache warm-up only
        }
      };
      warmHealthSnapshotCache().catch(() => {});

      return () => {
        prefetchCancelled = true;
        clearTimeout(timer);
        keyboardShowSub.remove();
      };
    }, []),
  );

  const handleListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y ?? 0;
    const contentHeight = e.nativeEvent.contentSize?.height ?? contentHeightRef.current;
    const viewportHeight = e.nativeEvent.layoutMeasurement?.height ?? viewportHeightRef.current;
    contentHeightRef.current = contentHeight;
    viewportHeightRef.current = viewportHeight;
    isNearBottomRef.current = contentHeight - (y + viewportHeight) <= 80;
    setShowScrollDown(!isNearBottomRef.current);

    if (y <= 40) loadOlderHistory();
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    contentHeightRef.current = height;
  };

  const SCREEN_BG = colors.chatScreenBg;
  const LINE = colors.chatLine;
  const SHELL_BG = colors.chatShellBg;

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
        },
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
        headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
        statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' },
        headerSub: { fontSize: 11, fontWeight: '600', color: colors.primary },
        chatArea: {
          flex: 1,
          backgroundColor: SCREEN_BG,
          position: 'relative',
        },
        listContent: { paddingHorizontal: 4, paddingTop: 18, paddingBottom: 34 },
        initialLoading: {
          position: 'absolute',
          top: 10,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 5,
        },
        loadingOlderOverlay: {
          position: 'absolute',
          top: 10,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 5,
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
        scrollDownBtn: {
          position: 'absolute',
          alignSelf: 'center',
          bottom: 12,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(0, 0, 0, 0.82)',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 3,
          shadowColor: colors.shadow,
          shadowOpacity: 0.18,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        },
        scrollDownIcon: {
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '700',
        },
      }),
    [colors],
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
            <DrawerMenuButton placement="trailing" />
          </View>

          <View style={styles.chatArea}>
            {isHistoryLoading ? (
              <View style={styles.initialLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
            {isLoadingOlder ? (
              <View style={styles.loadingOlderOverlay} pointerEvents="none">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <MessageRenderer
                  message={item}
                  onConfirmChatAction={confirmChatAction}
                  reactionPickerOpen={reactionUi.pickerForId === item.id}
                  onOpenReactionPicker={openReactionPicker}
                  onCloseReactionPicker={closeReactionPicker}
                  onSetReaction={setReaction}
                />
              )}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={handleContentSizeChange}
              refreshing={isHistoryRefreshing}
              onRefresh={refreshLatestHistory}
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
              keyboardShouldPersistTaps="handled"
            />
            {showScrollDown ? (
              <TouchableOpacity
                style={styles.scrollDownBtn}
                onPress={() => {
                  hapticLight();
                  listRef.current?.scrollToEnd({ animated: true });
                }}
                accessibilityLabel="Vai all'ultimo messaggio"
              >
                <Text style={styles.scrollDownIcon}>↓</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.inputArea}>
            {quickChips.length > 0 ? (
              <QuickChips
                chips={quickChips.map((chip) => chip.label)}
                onPress={(chip) => {
                  const selected = quickChips.find((entry) => entry.label === chip);
                  if (selected?.action?.type === 'navigate') {
                    navigation.navigate(selected.action.route);
                    return;
                  }
                  if (selected?.action?.type === 'message') {
                    sendMessage(selected.action.text);
                    scrollToLatest(true);
                    return;
                  }
                  sendMessage(chip);
                  scrollToLatest(true);
                }}
              />
            ) : null}
            <View style={styles.inputShell}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Scrivi un messaggio..."
                placeholderTextColor={colors.textHint}
                onSubmitEditing={handleSend}
                onFocus={() => scrollToLatest(true)}
                returnKeyType="send"
                multiline
                blurOnSubmit={keyboardAutoClose}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || isSending) && styles.sendBtnOff]}
                onPress={handleSend}
                disabled={isSending || !input.trim()}
                accessibilityLabel="Invia"
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
