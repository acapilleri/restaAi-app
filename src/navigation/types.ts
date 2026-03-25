export type ChatPromptSource = 'home_meal' | 'home_recipe' | 'home_weight' | 'home_plan';

export type TabParamList = {
  Today: undefined;
  Chat: {
    initialPrompt?: string;
    autoSend?: boolean;
    source?: ChatPromptSource;
    triggerId?: string;
  } | undefined;
  Dieta: undefined;
  Salute: undefined;
  Foto: undefined;
  Profilo: undefined;
};
