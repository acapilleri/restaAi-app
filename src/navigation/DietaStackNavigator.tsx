import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DietScreen } from '../screens/DietScreen';
import type { DietaStackParamList } from './types';

const Stack = createNativeStackNavigator<DietaStackParamList>();

/** Stack sotto Profilo → Dieta: stesso modello di Configura/Salute per back e future schermate. */
export function DietaStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DietaMain" component={DietScreen} />
    </Stack.Navigator>
  );
}
