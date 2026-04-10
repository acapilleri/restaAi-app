import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { initExecutorch, useLLM, LLAMA3_2_1B_SPINQUANT } from 'react-native-executorch';
import { BareResourceFetcher } from 'react-native-executorch-bare-resource-fetcher';
import { setConfig } from '@kesha-antonov/react-native-background-downloader';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import {
  collectRawBundle,
  type RawSensorBundle,
} from '../services/SensorBundleService';

setConfig({
  isLogsEnabled: true,
  logCallback: log => {
    console.log('[BackgroundDownloader]', log);
  },
});

initExecutorch({
  resourceFetcher: BareResourceFetcher,
});

const ColorPalette = {
  primary: '#001A72',
  blueLight: '#C1C6E5',
  blueDark: '#6676AA',
  white: '#FFFFFF',
  gray100: '#F5F5F5',
  gray200: '#E0E0E0',
};

function Spinner({
  visible,
  textContent,
}: {
  visible: boolean;
  textContent: string;
}) {
  return (
    <Modal transparent={true} animationType="fade" visible={visible}>
      <View style={spinnerStyles.overlay}>
        <View style={spinnerStyles.container}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={spinnerStyles.text}>{textContent}</Text>
        </View>
      </View>
    </Modal>
  );
}

const spinnerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 15,
    color: ColorPalette.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

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
      <Text style={errorBannerStyles.message} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={onDismiss}
        style={errorBannerStyles.closeButton}
      >
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
const BASE_SYSTEM_PROMPT = `
You are a single-word classifier. Reply with exactly one word, nothing else.

You receive a JSON with sensor data. The field "context" already contains the inferred situation.
Map it to Italian:

driving/commuting → spostando
restaurant → mangiando
gym/exercising → allenando
office/home → lavorando
meeting → lavorando
resting + hour 0-7 → dormendo
unknown → sconosciuto

One word only. No punctuation. No explanation.
`.trim();

function buildSystemPrompt(bundle: RawSensorBundle): string {
  const payload = {
    collected_at: new Date().toISOString(),
    sensors: bundle,
  };
  return `${BASE_SYSTEM_PROMPT}

Dati sensori attuali (JSON):
${JSON.stringify(payload)}`;
}

function buildSystemPromptOnCollectError(err: string): string {
  return `${BASE_SYSTEM_PROMPT}

Errore durante la raccolta dei dati sensori: ${err}`;
}

export function LocalChat() {
  const [userInput, setUserInput] = useState('');
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const sendingRef = useRef(false);
  const lastSystemPromptRef = useRef<string | null>(null);

  const llm = useLLM({ model: LLAMA3_2_1B_SPINQUANT });

  useEffect(() => {
    if (!llm.isReady) return;
    llm.configure({
      chatConfig: {
        systemPrompt: `${BASE_SYSTEM_PROMPT}

(I dati sensori completi verranno allegati al system prompt ad ogni messaggio inviato dall'utente.)`,
      },
    });
    // Solo transizione isReady: oggetto llm instabile come dipendenza.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- llm
  }, [llm.isReady]);

  useEffect(() => {
    if (llm.error) setError(String(llm.error));
  }, [llm.error]);

  const sendMessage = async () => {
    const text = userInput.trim();
    if (!text || sendingRef.current || llm.isGenerating) return;

    sendingRef.current = true;
    setUserInput('');
    textInputRef.current?.clear();
    try {
      let systemPrompt: string;
      try {
        const bundle = await collectRawBundle();
        systemPrompt = buildSystemPrompt(bundle);
      } catch (e) {
        systemPrompt = buildSystemPromptOnCollectError(
          e instanceof Error ? e.message : String(e),
        );
      }
      lastSystemPromptRef.current = systemPrompt;
      llm.configure({ chatConfig: { systemPrompt } });
      await llm.sendMessage(text);
      console.log(llm.messageHistory);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      sendingRef.current = false;
    }
  };

  useEffect(() => {
    if (__DEV__ && llm.messageHistory.length > 0) {
      console.log('[History]');
      llm.messageHistory.forEach((m, i) => {
        console.log(`  [${i}] role=${m.role} content=${m.content?.slice(0, 80)}`);
      });
    }
  }, [llm.messageHistory]);

  const copyRawJsonForExternalLlm = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      screen: 'LocalChat',
      model: 'LLAMA3_2_1B_SPINQUANT',
      last_system_prompt_with_sensors: lastSystemPromptRef.current,
      message_history: llm.messageHistory,
      response_in_flight: llm.isGenerating ? (llm.response ?? null) : null,
    };
    const text = JSON.stringify(payload, null, 2);
    Share.share(
      Platform.OS === 'ios'
        ? { message: text }
        : { message: text, title: 'JSON AI locale' },
    ).catch((e: unknown) => {
      Alert.alert('Errore', e instanceof Error ? e.message : String(e));
    });
  };

  const canCopyJson = llm.messageHistory.length > 0 || llm.isGenerating;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <Spinner
          visible={!llm.isReady && !llm.error}
          textContent={`Loading model ${(llm.downloadProgress * 100).toFixed(0)}%`}
        />

        <View style={styles.appHeader}>
          <Text style={styles.headerTitle}>AI locale</Text>
          {canCopyJson ? (
            <TouchableOpacity
              onPress={copyRawJsonForExternalLlm}
              style={styles.copyJsonButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Esporta JSON grezzo per test con altri LLM"
            >
              <Text style={styles.copyJsonButtonText}>Esporta JSON</Text>
            </TouchableOpacity>
          ) : null}
          <DrawerMenuButton placement="trailing" />
        </View>

        <View style={styles.content}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          {llm.messageHistory.length > 0 || llm.isGenerating ? (
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatContainer}
              contentContainerStyle={styles.chatContent}
              onContentSizeChange={() =>
                scrollViewRef.current?.scrollToEnd({ animated: true })
              }
              keyboardShouldPersistTaps="handled"
            >
              {llm.messageHistory
              .filter(m => {
  // Nessun role o content
  if (!m.role || !m.content?.trim()) return false

  // Nascondi messaggi assistant che sono tool calls o tool results
  if (m.role === 'assistant') {
    const c = m.content.trim()
    // Tool call generato da Hammer (formato JSON)
    if (c.startsWith('[{') || c.startsWith('{"name"')) return false
    // Tool result iniettato come assistant
    if (c.startsWith('{"result"') || c.startsWith('{"tool')) return false
    // Contenuto completamente JSON
    if (c.startsWith('{') && c.endsWith('}')) return false
    if (c.startsWith('[') && c.endsWith(']')) return false
  }

  return true
})
              .map((message, index) => (
                <View
                  key={index}
                  style={[
                    styles.messageBubble,
                    message.role === 'user'
                      ? styles.userMessage
                      : styles.aiMessage,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.role === 'user'
                        ? styles.userMessageText
                        : styles.aiMessageText,
                    ]}
                  >
                    {message.content}
                  </Text>
                </View>
              ))}
              {llm.isGenerating && llm.response && (
                <View style={[styles.messageBubble, styles.aiMessage]}>
                  <Text style={styles.aiMessageText}>{llm.response}</Text>
                  <ActivityIndicator
                    size="small"
                    color={ColorPalette.primary}
                  />
                </View>
              )}
            </ScrollView>
          ) : (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeTitle}>Hello! 👋</Text>
                <Text style={styles.welcomeSubtitle}>
                  What can I help you with?
                </Text>
                <View style={styles.suggestionsContainer}>
                  {[
                    'Explain quantum computing in simple terms',
                    'Write a short poem about coding',
                    'What are the benefits of on-device AI?',
                    'Give me 3 fun facts about space',
                  ].map((prompt, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.suggestionChip}
                      onPress={() => setUserInput(prompt)}
                    >
                      <Text style={styles.suggestionChipText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              ref={textInputRef}
              style={[
                styles.textInput,
                {
                  borderColor: isTextInputFocused
                    ? ColorPalette.blueDark
                    : ColorPalette.blueLight,
                },
              ]}
              placeholder="Your message"
              placeholderTextColor={ColorPalette.blueLight}
              multiline
              onFocus={() => setIsTextInputFocused(true)}
              onBlur={() => setIsTextInputFocused(false)}
              onChangeText={setUserInput}
              value={userInput}
            />
            {userInput.trim() && !llm.isGenerating && (
              <View style={styles.sendButton}>
                <Text style={styles.sendButtonText} onPress={sendMessage}>
                  Send
                </Text>
              </View>
            )}
            {llm.isGenerating && (
              <View style={styles.sendButton}>
                <Text style={styles.sendButtonText} onPress={llm.interrupt}>
                  Stop
                </Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ColorPalette.white,
  },
  container: {
    flex: 1,
    backgroundColor: ColorPalette.white,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  copyJsonButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ColorPalette.blueLight,
    backgroundColor: '#fafbff',
  },
  copyJsonButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: ColorPalette.primary,
  },
  content: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    width: '100%',
  },
  chatContent: {
    padding: 16,
    flexGrow: 1,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: ColorPalette.primary,
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: ColorPalette.blueDark,
    textAlign: 'center',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: ColorPalette.blueLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fafbff',
  },
  suggestionChipText: {
    fontSize: 13,
    color: ColorPalette.primary,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: ColorPalette.primary,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: ColorPalette.gray100,
    borderWidth: 1,
    borderColor: ColorPalette.gray200,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: ColorPalette.white,
  },
  aiMessageText: {
    color: ColorPalette.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: ColorPalette.gray200,
    alignItems: 'flex-end',
    backgroundColor: ColorPalette.white,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: ColorPalette.primary,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: ColorPalette.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: ColorPalette.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
