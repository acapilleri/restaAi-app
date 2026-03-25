import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { hapticLight } from '../utils/haptics';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { DietScreen } from '../screens/DietScreen';
import { FotoScreen } from '../screens/FotoScreen';
import { ProfiloScreen } from '../screens/ProfiloScreen';
import { HealthScreen } from '../screens/HealthScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Today: 'home',
  Chat: 'chatbubble-ellipses',
  Dieta: 'calendar',
  Salute: 'fitness',
  Foto: 'images',
  Profilo: 'person',
};

export function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => hapticLight(),
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          { paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10), height: 62 + Math.max(insets.bottom, 10) },
        ],
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => (
          <Icon name={TAB_ICONS[route.name]} size={size ?? 24} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Today" component={HomeScreen} options={{ tabBarLabel: 'today' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'chat' }} />
      <Tab.Screen name="Dieta" component={DietScreen} options={{ tabBarLabel: 'dieta' }} />
      <Tab.Screen name="Salute" component={HealthScreen} options={{ tabBarLabel: 'salute' }} />
      <Tab.Screen name="Foto" component={FotoScreen} options={{ tabBarLabel: 'foto' }} />
      <Tab.Screen name="Profilo" component={ProfiloScreen} options={{ tabBarLabel: 'profilo' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgPrimary,
    borderTopWidth: 0.5,
    borderTopColor: colors.tabBarBorder,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
});
