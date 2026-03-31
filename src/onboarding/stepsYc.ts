export type OnboardingYcStep = {
  label: string;
  coach: string;
  chips: string[];
  extract: string | null;
};

export const ONBOARDING_YC_STEPS: OnboardingYcStep[] = [
  {
    label: 'Capire il problema',
    coach:
      "La maggior parte delle persone non fallisce la dieta perché non sa cosa mangiare.\n\nFallisce quando la vita reale entra in mezzo: bar, ufficio, ristorante, frigo vuoto.",
    chips: ['Succede anche a me', 'Verissimo', 'Esatto'],
    extract: null,
  },
  {
    label: 'Mostrare il valore',
    coach:
      "Ed è qui che entro in gioco io.\n\nNon creo solo un piano: ti aiuto a eseguirlo nel momento critico.\n\nFacciamo una prova? La tua dieta dice: pollo + riso. Sei al bar. Cosa trovi?",
    chips: ['Toast e bresaola', 'Tonno e pane', 'Solo un panino'],
    extract: 'Problema riconosciuto: la dieta salta nei momenti reali',
  },
  {
    label: 'Magic moment',
    coach:
      'Perfetto. Posso adattare il pasto senza farti uscire dal protocollo.\n\nEsempio: 1 panino con bresaola, verdure grigliate se disponibili e niente salse.\n\nRisultato: resti vicino ai macro del tuo pranzo originale.',
    chips: ['Ok, ha senso', 'E se sono al ristorante?', 'E se ho solo snack?'],
    extract: 'Sostituzione generata: pasto adattato ai macro target',
  },
  {
    label: 'Setup minimo',
    coach:
      'Ottimo. Ora posso personalizzarlo davvero per te.\n\nMandami solo 4 dati: età, altezza, peso e obiettivo. Poi costruisco il tuo protocollo e lo eseguiamo insieme nella vita reale.',
    chips: ['45 anni, 178 cm, 98 kg, obiettivo 85 kg', 'Inserisco i dati', 'Prima voglio vedere il menù di oggi'],
    extract: 'Aha moment completato: il coach adatta la dieta alla realtà',
  },
];

export const ONBOARDING_MENU_CHIP = 'Prima voglio vedere il menù di oggi';

/** Usati se GET /api/v1/onboarding non è disponibile */
export const FALLBACK_ONBOARDING_YC_STEPS = ONBOARDING_YC_STEPS;
export const FALLBACK_ONBOARDING_MENU_CHIP = ONBOARDING_MENU_CHIP;
