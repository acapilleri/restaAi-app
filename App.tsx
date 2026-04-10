/**
 * AI Diet Adherence — React Native
 * @format
 */

import React, { useEffect, useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { PROFILE_QUERY_KEY } from './src/api/profile';
import { AuthProvider } from './src/context/AuthContext';
import { SensorFusionProvider } from './src/context/SensorFusionContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { subscribeForegroundMessages, subscribeTokenRefresh } from './src/services/pushMessaging';
import { setConfig as setBackgroundDownloaderConfig } from '@kesha-antonov/react-native-background-downloader';
import { initExecutorch } from 'react-native-executorch';
import { BareResourceFetcher } from 'react-native-executorch-bare-resource-fetcher';
import { NativeInferenceBridge } from './src/components/NativeInferenceBridge';
import { loadAndSyncIosGeofencePoisFromStorage } from './src/services/iosGeofencePois';

if (__DEV__) {
  try {
    setBackgroundDownloaderConfig({
      isLogsEnabled: true,
      logCallback: (tag, message, ...args) => {
        console.log('[BackgroundDownloader]', tag, message, ...args);
      },
    });
  } catch (e) {
    console.warn('[BackgroundDownloader] setConfig non applicato (nativo non pronto?)', e);
  }
}

initExecutorch({ resourceFetcher: BareResourceFetcher });

const queryClient = new QueryClient();

function AppWithNavigationTheme() {
  const queryClient = useQueryClient();
  const { colors, resolvedScheme } = useTheme();
  const linking = useMemo(
    () => ({
      // `restaai://dieta` has "dieta" as host, so we support both host-based and path-based prefixes.
      prefixes: ['restaai://dieta', 'restaai://'],
      config: {
        screens: {
          Main: {
            screens: {
              Dieta: {
                screens: {
                  DietaMain: '',
                },
              },
            },
          },
        },
      },
    }),
    [],
  );
  const navTheme = useMemo(
    () => ({
      ...(resolvedScheme === 'dark' ? DarkTheme : DefaultTheme),
      colors: {
        ...(resolvedScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.primary,
        background: colors.bgPrimary,
        card: colors.bgCard,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.primary,
      },
    }),
    [resolvedScheme, colors],
  );

  useEffect(() => {
    const unsubMsg = subscribeForegroundMessages((remoteMessage) => {
      const data = remoteMessage?.data;
      if (
        data &&
        (data.type === 'nudge' || data.category === 'nudge' || data.nudge === '1')
      ) {
        try {
          void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        } catch {
          /* evita crash se la cache non è pronta */
        }
      }
      if (__DEV__) {
        console.log('[FCM] Foreground message', remoteMessage?.messageId);
      }
    });
    const unsubToken = subscribeTokenRefresh((token) => {
      if (__DEV__) {
        console.log('[FCM] Token refresh', token?.slice(0, 16));
      }
    });
    return () => {
      unsubMsg();
      unsubToken();
    };
  }, [queryClient]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void loadAndSyncIosGeofencePoisFromStorage();
  }, []);

  return (
    <>
      <StatusBar
        barStyle={resolvedScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgPrimary}
      />
      <AuthProvider>
        <NavigationContainer theme={navTheme} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SensorFusionProvider>
          <NativeInferenceBridge />
          <ThemeProvider>
            <QueryClientProvider client={queryClient}>
              <AppWithNavigationTheme />
            </QueryClientProvider>
          </ThemeProvider>
        </SensorFusionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
