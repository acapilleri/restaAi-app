import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../api/auth';
import * as authApi from '../api/auth';
import { getStoredToken, removeStoredToken } from '../api/authStorage';
import { setOnUnauthorized } from '../api/client';
import { PROFILE_QUERY_KEY } from '../api/profile';
import { syncDailySummaryToBackend } from '../services/appleHealth';

type AuthState = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isChecked: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { first_name: string; email: string; password: string; password_confirmation: string }) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: false,
    isChecked: false,
  });

  const clearSession = useCallback(async () => {
    await removeStoredToken();
    queryClient.removeQueries({ queryKey: PROFILE_QUERY_KEY });
    setState((s) => ({ ...s, user: null, token: null }));
  }, [queryClient]);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearSession();
    });
    return () => setOnUnauthorized(null);
  }, [clearSession]);

  useEffect(() => {
    if (!state.token || !state.user) return;
    void syncDailySummaryToBackend();
  }, [state.token, state.user?.id]);

  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active' && state.token && state.user) {
        void syncDailySummaryToBackend();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [state.token, state.user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getStoredToken();
      if (!token) {
        if (!cancelled) setState((s) => ({ ...s, token: null, user: null, isChecked: true }));
        return;
      }
      if (!cancelled) setState((s) => ({ ...s, token, isChecked: true }));
      try {
        const { getProfile } = await import('../api/profile');
        const res = await getProfile();
        if (!cancelled && res?.profile) {
          queryClient.setQueryData(PROFILE_QUERY_KEY, res);
        }
        const profile = res?.profile;
        if (!cancelled && profile) {
          const firstName =
            profile.name?.trim().split(/\s+/)[0] ||
            profile.email?.split('@')[0] ||
            '';
          setState((s) => ({
            ...s,
            user: {
              id: profile.id,
              email: profile.email,
              first_name: firstName,
            },
          }));
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, user: null }));
      }
    })();
    return () => { cancelled = true; };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const { user, token } = await authApi.login({ user: { email, password } });
      setState((s) => ({ ...s, user, token, isLoading: false }));
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false }));
      throw e;
    }
  }, []);

  const register = useCallback(
    async (payload: { first_name: string; email: string; password: string; password_confirmation: string }) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const { user, token } = await authApi.register({
          user: {
            name: payload.first_name,
            email: payload.email,
            password: payload.password,
            password_confirmation: payload.password_confirmation,
          },
        });
        setState((s) => ({ ...s, user, token: token ?? null, isLoading: false }));
      } catch (e) {
        setState((s) => ({ ...s, isLoading: false }));
        throw e;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true }));
    await authApi.logout();
    queryClient.removeQueries({ queryKey: PROFILE_QUERY_KEY });
    setState((s) => ({ ...s, user: null, token: null, isLoading: false }));
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const token = await getStoredToken();
    if (!token) return;
    try {
      const { getProfile } = await import('../api/profile');
      const res = await getProfile();
      queryClient.setQueryData(PROFILE_QUERY_KEY, res);
      const profile = res?.profile;
      if (profile) {
        const firstName =
          profile.name?.trim().split(/\s+/)[0] ||
          profile.email?.split('@')[0] ||
          '';
        setState((s) => ({
          ...s,
          user: {
            id: profile.id,
            email: profile.email,
            first_name: firstName,
          },
        }));
      }
    } catch {
      // ignore
    }
  }, [queryClient]);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    clearSession,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
