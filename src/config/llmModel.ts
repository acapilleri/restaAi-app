/** Chiave AsyncStorage per il path del modello Llama (file system o id numerico asset). */
export const LLM_MODEL_PATH_KEY = 'llm_model_path';

/** Se `'true'`, `llm_model_path` è un asset Metro (`require(...)` → id numerico), non un path file. */
export const LLM_MODEL_IS_ASSET_KEY = 'llm_model_is_asset';

/**
 * Se true e non c’è path in AsyncStorage, su **iOS** si inizializza Llama col GGUF nel **bundle nativo**
 * (file aggiunto in Xcode, non tramite Metro). Su Android non è applicato — usa un path file nella schermata Sensor bundle.
 */
export const USE_BUNDLED_LLM_WHEN_NO_PATH = true;

/**
 * Path assoluto al file `.gguf` sul dispositivo, usato se `llm_model_path` non è ancora impostato in AsyncStorage
 * e `USE_BUNDLED_LLM_WHEN_NO_PATH` è false (o per override manuale).
 */
export const DEFAULT_LLM_FILESYSTEM_PATH = '';
