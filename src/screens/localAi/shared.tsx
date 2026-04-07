/**
 * Utilità condivise tra chat locale ExecuTorch e schermata sensori + AI.
 */

import React from 'react';
import { Text, type TextStyle } from 'react-native';
import type { Message } from 'react-native-executorch';

export const SYSTEM_PROMPT =
  'Sei un assistente utile per nutrizione e abitudini. Rispondi in italiano in modo chiaro e completo quando serve';

export const SYSTEM_PROMPT_WITH_SENSORS = `${SYSTEM_PROMPT}

Quando il messaggio utente include dati sensori (campo JSON), rispondi in italiano in DUE parti separate da una riga che contiene SOLO tre trattini --- (sola riga, nient'altro sulla riga).

IMPORTANTE: scrivi solo testo normale. Vietato: markdown, blocchi codice, triple backtick, grassetto asterischi, fence.

Prima parte: prima della riga ---, con titolo esatto «Comprensione dai sensori», 3–6 righe su cosa deduci dal JSON (situazione, orario, attività se i dati bastano). Se un campo è null, dillo senza inventare.

Seconda parte: dopo la riga --- rispondi in modo concreto alla «Domanda».

Comprensione dai sensori
(breve testo qui)

---
(risposta alla domanda qui)`;

/** Riga che contiene solo tre trattini (separator richiesto al modello); tollera CR, spazi, inizio testo. */
const SENSOR_REPLY_DIVIDER_RE = /(?:^|\r?\n)[ \t]*---[ \t]*\r?\n/;

/**
 * Rimuove righe solo ``` / ```lang e fence avvolgenti che alcuni LLM locali emettono al posto del testo.
 */
export function stripMarkdownFencesForDisplay(raw: string): string {
  let t = String(raw ?? '').replace(/\r\n/g, '\n');
  t = t
    .split('\n')
    .filter((line) => !/^\s*```[\w]*\s*$/.test(line))
    .join('\n');
  const trimmed = t.trim();
  const wrapped = /^(?:```[\w]*\s*\n)([\s\S]*?)(?:\n```\s*)$/;
  const m = trimmed.match(wrapped);
  if (m) return m[1].trim();
  return trimmed;
}

/**
 * Splitta la risposta LLM in comprensione vs risposta utile.
 * Finché non compare --- come riga, tutto è trattato come testo unico (streaming).
 */
export function parseSensorLlmReply(text: string): {
  comprehension: string | null;
  answer: string;
  hasDivider: boolean;
} {
  const t = text.trim();
  if (!t) return { comprehension: null, answer: '', hasDivider: false };
  const m = SENSOR_REPLY_DIVIDER_RE.exec(t);
  if (!m) {
    return { comprehension: null, answer: t, hasDivider: false };
  }
  const comprehension = t.slice(0, m.index).trim();
  const answer = t.slice(m.index + m[0].length).trim();
  return {
    comprehension: comprehension || null,
    answer: answer || '',
    hasDivider: true,
  };
}

/** Spezza per paragrafi (doppio a capo) così il testo lungo in chat non è un muro unico. */
export function FormattedParagraphs({
  text,
  style,
  textAlign,
}: {
  text: string;
  style: TextStyle;
  textAlign?: 'left' | 'right' | 'center';
}) {
  const safe = text == null ? '' : String(text);
  const align = textAlign ? { textAlign } : undefined;
  if (!safe.trim()) {
    return (
      <Text selectable style={[style, align]}>
        {safe || ' '}
      </Text>
    );
  }
  const parts = safe
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return (
      <Text selectable style={[style, align]}>
        {safe.trim()}
      </Text>
    );
  }
  return (
    <Text selectable style={[style, align]}>
      {parts.join('\n\n')}
    </Text>
  );
}

/** Intervallo campionamento live sensori (troppo aggressivo → crash nativi). */
export const SENSOR_LIVE_INTERVAL_MS = 2000;

/** Sul flusso sensori: meno cronologia per lasciare token alla risposta (generate manuale). */
export const MAX_PRIOR_MESSAGES_SENSOR = 4;

export function trimPriorForSensorContext(prior: Message[]): Message[] {
  if (prior.length <= MAX_PRIOR_MESSAGES_SENSOR) return prior;
  const sliced = prior.slice(-MAX_PRIOR_MESSAGES_SENSOR);
  if (sliced[0]?.role === 'assistant') {
    return sliced.slice(1);
  }
  return sliced;
}
