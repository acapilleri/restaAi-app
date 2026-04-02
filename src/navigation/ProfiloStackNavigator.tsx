import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfiloScreen } from '../screens/ProfiloScreen';
import { ConfiguraScreen } from '../screens/ConfiguraScreen';
import type { ProfiloStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfiloStackParamList>();

/** Stack sotto il drawer: da Profilo si apre Configura con back coerente. */
export function ProfiloStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfiloMain" component={ProfiloScreen} />
      <Stack.Screen name="Configura" component={ConfiguraScreen} />
    </Stack.Navigator>
  );
}
