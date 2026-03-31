import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { darkColors, lightColors, type AppColors } from '../theme/colors';
import { getThemePreference, setThemePreference, type ThemePreference } from '../theme/themePreference';

export type { ThemePreference };

type ThemeContextValue = {
  colors: AppColors;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => Promise<void>;
  resolvedScheme: 'light' | 'dark';
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): 'light' | 'dark' {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemScheme === 'dark' ? 'dark' : 'light';
}

function normalizeSystemScheme(scheme: string | null | undefined): 'light' | 'dark' | null {
  if (scheme === 'dark' || scheme === 'light') return scheme;
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const rawScheme = useColorScheme();
  const systemScheme = normalizeSystemScheme(rawScheme);
  const [preference, setPrefState] = useState<ThemePreference>('system');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const sub = Appearance.addChangeListener(() => forceUpdate((n) => n + 1));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const p = await getThemePreference();
      if (active) setPrefState(p);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPrefState(p);
    await setThemePreference(p);
  }, []);

  const resolvedScheme = useMemo(() => resolveScheme(preference, systemScheme), [preference, systemScheme]);

  const colors = resolvedScheme === 'dark' ? darkColors : lightColors;
  const isDark = resolvedScheme === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      preference,
      setPreference,
      resolvedScheme,
      isDark,
    }),
    [colors, preference, setPreference, resolvedScheme, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
