import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfiloScreen } from '../screens/ProfiloScreen';
import { ConfiguraScreen } from '../screens/ConfiguraScreen';
import { DietaStackNavigator } from './DietaStackNavigator';
import type { ProfiloStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfiloStackParamList>();

/** Stack sotto il drawer: da Profilo si aprono Configura e Dieta (stack interno) con back coerente. */
export function ProfiloStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfiloMain" component={ProfiloScreen} />
      <Stack.Screen name="Configura" component={ConfiguraScreen} />
      <Stack.Screen name="Dieta" component={DietaStackNavigator} />
    </Stack.Navigator>
  );
}
