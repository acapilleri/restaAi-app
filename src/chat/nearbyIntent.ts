/**
 * Heuristica: il messaggio richiede contesto posizione per ristoranti / Just Eat vicini.
 * Allinea l'invio di `location_context` su POST /chat senza chiamate LLM lato client.
 */
const NEARBY_RESTAURANT_PATTERNS: RegExp[] = [
  /just\s*eat/i,
  /\b(?:ristoranti?|locali|trattorie?)\b.*\b(?:vicin|vicino|intorno|attorno|qui)\b/i,
  /\b(?:vicin\w*|intorno|attorno)\b.*\b(?:ristoranti?|locali)\b/i,
  /cosa\s+(?:mangiare|ordinare|prendere)\b.*\b(?:vicino|qui|oggi|al\s+ristorante|delivery)\b/i,
  /cosa\s+(?:mangiare|ordinare|prendere)\s*\?/i,
  /\bdove\s+(?:mangiare|andare\s+a\s+mangiare|posso\s+mangiare|pranzare|cenare)\b/i,
  /\b(?:delivery|ordinare)\b.*\b(?:vicino|oggi|pranzo|cena)\b/i,
  /\b(?:sono\s+in|mi\s+trovo\s+a|sono\s+a)\s+.+/i,
  /\bpiazza\s+[\wàèéìòù']+/i,
  /\b(?:zona|quartiere|centro)\b.*\b(?:mangiare|ristoranti?)\b/i,
];

export function wantsNearbyRestaurantContext(text: string): boolean {
  const t = typeof text === 'string' ? text.trim() : '';
  if (t.length < 3) return false;
  return NEARBY_RESTAURANT_PATTERNS.some((re) => re.test(t));
}
