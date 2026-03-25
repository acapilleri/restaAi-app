import { Platform } from 'react-native';

/**
 * DietaAI API — base URL e flag di ambiente.
 * JWT: 7 giorni. Salvataggio in storage con chiave "dietaai_jwt".
 *
 * In dev, senza override:
 * - iOS simulator → http://localhost:3000
 * - Android emulator → http://10.0.2.2:3000
 * Su dispositivo fisico imposta DEV_API_HOST_OVERRIDE all'IP LAN del Mac (es. http://192.168.1.10:3000).
 */

const DEVELOPMENT = typeof __DEV__ !== 'undefined' && __DEV__;

/** Es. 'http://192.168.1.10:3000' per iPhone/Android fisico; null = host automatico */
const DEV_API_HOST_OVERRIDE: string | null = 'http://192.168.1.57:3000';

function defaultDevBaseUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

const DEV_API_HOST = DEVELOPMENT
  ? (DEV_API_HOST_OVERRIDE?.trim() || defaultDevBaseUrl())
  : '';

export const BASE_URL = DEVELOPMENT ? DEV_API_HOST : 'https://api.dietaai.app';

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
