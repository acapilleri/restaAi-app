/**
 * AI Diet Adherence — React Native
 * @format
 */

import React, { useMemo } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient();

function AppWithNavigationTheme() {
  const { colors, resolvedScheme } = useTheme();
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

  return (
    <>
      <StatusBar
        barStyle={resolvedScheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bgPrimary}
      />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </QueryClientProvider>
    </>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppWithNavigationTheme />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
