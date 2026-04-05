import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FotoScreen } from '../screens/FotoScreen';
import { FotoDetailScreen } from '../screens/FotoDetailScreen';
import type { FotoStackParamList } from './types';

const Stack = createNativeStackNavigator<FotoStackParamList>();

export function FotoStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="FotoMain"
        component={FotoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FotoDetail"
        component={FotoDetailScreen}
        options={{ title: 'Dettaglio Body Check' }}
      />
    </Stack.Navigator>
  );
}
