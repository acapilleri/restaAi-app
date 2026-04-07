/**
 * Modello Gemma GGUF **senza** `require()` nel bundle JS: file di centinaia di MB superano il limite
 * di stringa di Node/Metro durante il packaging.
 *
 * **iOS:** aggiungi `gemma-3-1b-it-Q4_K_M.gguf` al target in Xcode (Copy Bundle Resources), poi usa
 * questo nome con `is_model_asset: true` — `llama.rn` lo risolve con `NSBundle`.
 *
 * **Android:** `is_model_asset` non risolve come su iOS; usa un path file system assoluto al `.gguf`
 * (es. copia in documenti) oppure una copia in cache gestita da codice nativo.
 */
export const BUNDLED_LLM_IOS_RESOURCE_NAME = 'gemma-3-1b-it-Q4_K_M.gguf';

/** Valore salvato in AsyncStorage / init quando si usa Gemma come risorsa bundle su iOS. */
export const BUNDLED_LLM_MODEL_PATH = BUNDLED_LLM_IOS_RESOURCE_NAME;
