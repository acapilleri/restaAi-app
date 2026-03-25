import axios, { AxiosError } from 'axios';
import { API_BASE } from '../config/api';
import { getStoredToken } from './authStorage';

export type OnUnauthorized = () => void;

let onUnauthorized: OnUnauthorized | null = null;

export function setOnUnauthorized(cb: OnUnauthorized | null) {
  onUnauthorized = cb;
}

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

client.interceptors.request.use(
  async (config) => {
    const token = await getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (err) => Promise.reject(err),
);

client.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<{ error?: string; details?: unknown }>) => {
    const status = err.response?.status;
    const data = err.response?.data;

    if (status === 401) {
      onUnauthorized?.();
      return Promise.reject(Object.assign(err, { _isAuthError: true }));
    }

    if (status === 503) {
      const message = data?.error ?? 'Servizio AI temporaneamente non disponibile. Riprova tra poco.';
      return Promise.reject(Object.assign(err, { message }));
    }

    const fallback =
      status === 400
        ? data?.error ?? 'Parametro mancante'
        : status === 404
          ? data?.error ?? 'Non trovato'
          : status === 422
            ? data?.error ?? 'Validazione fallita'
            : err.message ?? 'Errore di rete';
    err.message = fallback;
    return Promise.reject(err);
  },
);

export default client;
