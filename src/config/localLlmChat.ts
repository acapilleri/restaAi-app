/**
 * SlidingWindowContextStrategy (react-native-executorch) riserva `bufferTokens` dal
 * contesto massimo per la generazione: tokenBudgetPrompt = maxContextLength - bufferTokens.
 * Valori troppo bassi (es. DEFAULT 512) lasciano poco margine alla risposta con cronologia lunga.
 */
export const LOCAL_LLM_SLIDING_WINDOW_BUFFER_TOKENS = 1536;
