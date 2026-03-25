/**
 * Endpoint per la chat AI (Vercel AI SDK).
 * Imposta CHAT_API_URL nel tuo .env o qui per usare un backend reale.
 * Esempio backend: Next.js API route con streamText + toUIMessageStreamResponse.
 */
export const CHAT_API_URL =
  (typeof process !== 'undefined' && process.env?.CHAT_API_URL) ||
  '';
