import { Alert, Platform } from 'react-native';

/**
 * DietaAI API — base URL e flag di ambiente.
 * JWT: 7 giorni. Salvataggio in storage con chiave "dietaai_jwt".
 *
 * In dev, senza override:
 * - iOS simulator → http://localhost:3000
 * - Android emulator → http://10.0.2.2:3000
 * Su dispositivo fisico imposta DEV_API_HOST_OVERRIDE all'IP LAN del Mac (es. http://192.168.1.10:3000).
 * Default dev: Heroku (REMOTE_API_HOST). Imposta `null` per usare locale.
 */

const DEVELOPMENT = __DEV__ === true;
/** Backend produzione (Heroku); stesso valore usato in release. */
const REMOTE_API_HOST = 'https://resta-ai-6bf7dd4ee671.herokuapp.com';
const DEV_API_HOST = 'http://localhost:3000';
/** Override host dev; `REMOTE_API_HOST` = Heroku in dev. `null` = localhost/10.0.2.2 */
const DEV_API_HOST_OVERRIDE: string | null = REMOTE_API_HOST;
function defaultDevBaseUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

export const BASE_URL = DEVELOPMENT ? DEV_API_HOST : REMOTE_API_HOST;

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
