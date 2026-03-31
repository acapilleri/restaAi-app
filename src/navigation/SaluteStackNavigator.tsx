import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HealthScreen } from '../screens/HealthScreen';
import { HealthMetricStoricoScreen } from '../screens/HealthMetricStoricoScreen';
import type { SaluteStackParamList } from './types';

const Stack = createNativeStackNavigator<SaluteStackParamList>();

/** Stack Salute nel drawer: riepilogo HealthKit + schermate storico. */
export function SaluteStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Salute" component={HealthScreen} />
      <Stack.Screen name="SaluteStorico" component={HealthMetricStoricoScreen} />
    </Stack.Navigator>
  );
}
