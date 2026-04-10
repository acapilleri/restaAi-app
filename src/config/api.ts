import { NativeModules, Platform } from 'react-native';

/**
 * DietaAI API — base URL e flag di ambiente.
 * JWT: 7 giorni. Salvataggio in storage con chiave "dietaai_jwt".
 *
 * In dev, senza override:
 * - device fisico / Metro remoto -> IP del Mac derivato da Metro, porta 3000
 * - iOS simulator -> http://localhost:3000
 * - Android emulator -> http://10.0.2.2:3000
 * Se serve, imposta DEV_API_HOST_OVERRIDE a una base URL esplicita.
 */

const DEVELOPMENT = __DEV__ === true;
/** Backend produzione (Heroku); stesso valore usato in release. */
const REMOTE_API_HOST = 'https://resta-ai-6bf7dd4ee671.herokuapp.com';
/**
 * Override host dev; `null` = auto-detect da Metro o fallback simulatore/emulatore.
 * Esempio LAN (device fisico + API sul Mac): `http://192.168.1.58:3000` — cambia IP/porta se serve.
 */
const DEV_API_HOST_OVERRIDE: string | null = 'http://192.168.1.58:3000';

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
  return normalized || null;
}

function detectMetroHost(): string | null {
  const scriptURL =
    typeof NativeModules.SourceCode?.scriptURL === 'string' ? NativeModules.SourceCode.scriptURL : '';
  if (!scriptURL) return null;

  try {
    const host = new URL(scriptURL).hostname.trim();
    if (!host || host === 'localhost' || host === '127.0.0.1') {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

function defaultDevBaseUrl(): string {
  const metroHost = detectMetroHost();
  if (metroHost) {
    return `http://${metroHost}:3000`;
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export const BASE_URL = DEVELOPMENT
  ? normalizeBaseUrl(DEV_API_HOST_OVERRIDE) ?? defaultDevBaseUrl()
  : REMOTE_API_HOST;

export const API_BASE = `${BASE_URL}/api/v1`;

function toCableUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.startsWith('https://')) {
    return `${trimmed.replace('https://', 'wss://')}/cable`;
  }
  if (trimmed.startsWith('http://')) {
    return `${trimmed.replace('http://', 'ws://')}/cable`;
  }
  return `${trimmed}/cable`;
}

export const CABLE_URL = toCableUrl(BASE_URL);
