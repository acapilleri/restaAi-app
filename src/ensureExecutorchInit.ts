/**
 * Deve essere chiamato quando il runtime nativo ha registrato ETInstaller.
 * Se chiamato troppo presto (import sincrono in index.js), TurboModuleRegistry.get('ETInstaller')
 * è spesso null → initExecutorch non gira → ResourceFetcher senza adapter → modello mai scaricato.
 */
import { TurboModuleRegistry } from 'react-native';

let didInit = false;

export function hasETInstallerModule(): boolean {
  try {
    return TurboModuleRegistry.get('ETInstaller') != null;
  } catch {
    return false;
  }
}

export function ensureExecutorchInitialized(): boolean {
  if (didInit) return true;
  if (!hasETInstallerModule()) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initExecutorch } = require('react-native-executorch');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BareResourceFetcher } = require('react-native-executorch-bare-resource-fetcher');
    initExecutorch({ resourceFetcher: BareResourceFetcher });
    didInit = true;
    if (__DEV__) {
      console.log('[ExecuTorch] initExecutorch OK (BareResourceFetcher registrato)');
    }
    return true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[ExecuTorch] initExecutorch fallito:', e);
    }
    return false;
  }
}
