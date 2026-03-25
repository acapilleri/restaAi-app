const ZWSP = '\u200B';

/**
 * Inserisce "soft wrap points" (ZWSP) in token lunghi senza spazi (es. URL, parole lunghe)
 * per evitare clipping/troncamenti nelle Text di React Native.
 *
 * Non cambia il testo visibile, ma abilita l'andata a capo in piu' punti.
 */
export function softWrapText(input: string): string {
  if (typeof input !== 'string' || !input) return '';

  // Evita costi inutili sui messaggi normali.
  if (input.length < 30) return input;

  // Inserisci ZWSP dopo separatori comuni negli URL e nei token lunghi.
  // Nota: non lo inseriamo dopo ogni carattere per non influire sul rendering.
  return input.replace(/([/_.\-?&=:#])/g, `$1${ZWSP}`);
}

