import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { useRoute, RouteProp } from '@react-navigation/native';
import { MessageRenderer } from '../components/chat/MessageRenderer';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { useChat } from '../hooks/useChat';
import type { TabParamList } from '../navigation/types';

export function ChatScreen() {
  const route = useRoute<RouteProp<TabParamList, 'Chat'>>();
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
    confirmWeight,
    reactionUi,
    openReactionPicker,
    closeReactionPicker,
    setReaction,
  } = useChat();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const lastMessageCountRef = useRef(0);
  const offsetYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const lastHandledTriggerRef = useRef<string | null>(null);
  const initialPrompt = route.params?.initialPrompt?.trim() ?? '';
  const autoSend = route.params?.autoSend === true;
  const triggerId = route.params?.triggerId;

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
    listRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    if (!autoSend || !initialPrompt) return;
    const key = triggerId ?? initialPrompt;
    if (lastHandledTriggerRef.current === key) return;
    lastHandledTriggerRef.current = key;
    sendMessage(initialPrompt);
    listRef.current?.scrollToEnd({ animated: true });
  }, [autoSend, initialPrompt, sendMessage, triggerId]);

  useEffect(() => {
    const becameLonger = messages.length > lastMessageCountRef.current;
    if (becameLonger && !isLoadingOlder && isNearBottomRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
    lastMessageCountRef.current = messages.length;
  }, [isLoadingOlder, messages.length]);

  const handleListScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y ?? 0;
    const contentHeight = e.nativeEvent.contentSize?.height ?? contentHeightRef.current;
    const viewportHeight = e.nativeEvent.layoutMeasurement?.height ?? viewportHeightRef.current;
    offsetYRef.current = y;
    contentHeightRef.current = contentHeight;
    viewportHeightRef.current = viewportHeight;
    isNearBottomRef.current = contentHeight - (y + viewportHeight) <= 80;

    if (y <= 40) loadOlderHistory();
  };

  const handleContentSizeChange = (_width: number, height: number) => {
    contentHeightRef.current = height;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          renderItem={({ item }) => (
            <MessageRenderer
              message={item}
              onConfirmWeight={confirmWeight}
              reactionPickerOpen={reactionUi.pickerForId === item.id}
              onOpenReactionPicker={openReactionPicker}
              onCloseReactionPicker={closeReactionPicker}
              onSetReaction={setReaction}
            />
          )}
          contentContainerStyle={styles.list}
          onContentSizeChange={handleContentSizeChange}
          refreshing={isHistoryRefreshing}
          onRefresh={refreshLatestHistory}
          onScroll={handleListScroll}
          scrollEventThrottle={16}
          ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          keyboardShouldPersistTaps="handled"
        />

        {isHistoryLoading ? (
          <View style={styles.initialLoading}>
            <ActivityIndicator size="small" color="#1D9E75" />
          </View>
        ) : null}
        {isLoadingOlder ? (
          <View style={styles.loadingOlderOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#1D9E75" />
          </View>
        ) : null}

        <View style={styles.composerContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Scrivi un messaggio..."
              placeholderTextColor="#999"
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              editable={!isSending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={isSending || !input.trim()}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F1EC' },
  list: { padding: 8, paddingBottom: 8 },
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
    top: 44,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  composerContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.07)',
    paddingTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 52,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F1EC',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111',
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendIcon: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
