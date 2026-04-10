import type { BodyAnalysis } from '../api/bodyAnalysis';
import type { SaluteMetricId } from '../services/appleHealth';

export type ChatPromptSource =
  | 'home_meal'
  | 'home_recipe'
  | 'home_weight'
  | 'home_plan'
  | 'onboarding';

/** Schermate aperte da Profilo (stack annidato nel drawer → back torna al profilo). */
export type ProfiloStackParamList = {
  ProfiloMain: undefined;
  Configura: undefined;
};

/** Apple Salute: voce principale del drawer (stack con storico metriche). */
export type SaluteStackParamList = {
  Salute: undefined;
  SaluteStorico: { metric: SaluteMetricId };
};

/** Foto corpo: overview + dettaglio analisi. */
export type FotoStackParamList = {
  FotoMain: undefined;
  FotoDetail: { analysis: BodyAnalysis };
};

/** Stack della sezione Dieta (annidato in ProfiloStack). */
export type DietaStackParamList = {
  DietaMain: undefined;
};

/** Main app drawer routes (replaces former bottom tabs). */
export type MainParamList = {
  Chat:
    | {
        initialPrompt?: string;
        autoSend?: boolean;
        source?: ChatPromptSource;
        triggerId?: string;
      }
    | undefined;
  ChatDemos: undefined;
  LocalChat: undefined;
  LocalAISensors: undefined;
  SensorLog: undefined;
  NotificationLog: undefined;
  Dieta: undefined;
  Today: undefined;
  Foto: undefined;
  Profilo: undefined;
  Salute: undefined;
};

/** @deprecated Use MainParamList */
export type TabParamList = MainParamList;
