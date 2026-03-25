import axios from 'axios';
import { API_BASE } from '../config/api';
import { setStoredToken } from './authStorage';

export type User = { id: number; email: string; first_name: string };

/** Backend restituisce user: { id, email } (nome da GET /profile dopo) */
function toUser(raw: { id: number; email: string; name?: string }): User {
  const first = raw.name?.trim().split(/\s+/)[0] || raw.email?.split('@')[0] || '';
  return { id: raw.id, email: raw.email, first_name: first };
}

export type LoginPayload = { user: { email: string; password: string } };
export type LoginResponse = { token: string; user: { id: number; email: string } };

export type RegisterPayload = {
  user: { name: string; email: string; password: string; password_confirmation: string };
};
export type RegisterResponse = { token: string; user: { id: number; email: string } };

/** Login: token nel body della response (backend DietaAI) */
export async function login(payload: LoginPayload): Promise<{ user: User; token: string }> {
  const res = await axios.post<LoginResponse>(`${API_BASE}/auth/login`, payload);
  const token = res.data.token;
  if (!token) throw new Error('Token non ricevuto dal server');
  await setStoredToken(token);
  return { user: toUser(res.data.user), token };
}

/** Register: backend si aspetta user.name (non first_name) */
export async function register(payload: RegisterPayload): Promise<{ user: User; token?: string }> {
  const res = await axios.post<RegisterResponse>(`${API_BASE}/auth/register`, payload);
  const token = res.data.token;
  if (token) await setStoredToken(token);
  return { user: toUser(res.data.user), token: token || undefined };
}

export async function logout(): Promise<void> {
  const api = (await import('./client')).default;
  try {
    await api.delete('/auth/logout');
  } catch {
    // ignore
  }
  const { removeStoredToken } = await import('./authStorage');
  await removeStoredToken();
}
