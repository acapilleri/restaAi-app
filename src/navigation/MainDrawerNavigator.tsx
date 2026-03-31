import React, { useMemo } from 'react';
import { createDrawerNavigator, DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import type { AppStackParamList } from './rootTypes';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { FotoScreen } from '../screens/FotoScreen';
import { ChatDemosScreen } from '../screens/ChatDemosScreen';
import { ProfiloStackNavigator } from './ProfiloStackNavigator';
import { SaluteStackNavigator } from './SaluteStackNavigator';
import type { MainParamList } from './types';

const Drawer = createDrawerNavigator<MainParamList>();

const DRAWER_ITEMS: { name: keyof MainParamList; label: string; ion: string }[] = [
  { name: 'Chat', label: 'chat', ion: 'chatbubble-ellipses' },
  { name: 'Profilo', label: 'profilo', ion: 'person' },
  { name: 'Salute', label: 'salute', ion: 'heart-outline' },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        drawerScroll: {
          backgroundColor: colors.bgPrimary,
        },
        drawerContent: {
          paddingHorizontal: 12,
        },
        drawerTitle: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.textMuted,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 12,
          marginLeft: 12,
        },
        drawerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingVertical: 14,
          paddingHorizontal: 12,
          borderRadius: 12,
        },
        drawerRowActive: {
          backgroundColor: colors.greenPill,
        },
        drawerLabel: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.textPrimary,
        },
        drawerLabelActive: {
          color: colors.primaryDark,
        },
        drawerDivider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.divider,
          marginVertical: 12,
          marginHorizontal: 12,
        },
        devLabelCol: { flex: 1 },
        drawerLabelDev: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.textMuted,
        },
        drawerLabelDevSub: {
          fontSize: 11,
          fontWeight: '500',
          color: colors.textHint,
          marginTop: 2,
        },
      }),
    [colors],
  );

  const active = props.state.routes[props.state.index]?.name;

  return (
    <DrawerContentScrollView
      {...props}
      style={styles.drawerScroll}
      contentContainerStyle={[styles.drawerContent, { paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: insets.bottom + 16 }]}
    >
      <Text style={styles.drawerTitle}>Menu</Text>
      {DRAWER_ITEMS.map((item) => {
        const focused = active === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[styles.drawerRow, focused && styles.drawerRowActive]}
            onPress={() => {
              hapticLight();
              props.navigation.navigate(item.name);
              props.navigation.closeDrawer();
            }}
            activeOpacity={0.85}
          >
            <Icon name={item.ion} size={22} color={focused ? colors.primary : colors.textSecondary} />
            <Text style={[styles.drawerLabel, focused && styles.drawerLabelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
      {__DEV__ ? (
        <>
          <View style={styles.drawerDivider} />
          <TouchableOpacity
            style={styles.drawerRow}
            onPress={() => {
              hapticLight();
              const stackNav = props.navigation.getParent<NativeStackNavigationProp<AppStackParamList>>();
              stackNav?.navigate('OnboardingChat');
              props.navigation.closeDrawer();
            }}
            activeOpacity={0.85}
          >
            <Icon name="flask-outline" size={22} color={colors.textMuted} />
            <View style={styles.devLabelCol}>
              <Text style={styles.drawerLabelDev}>Onboarding</Text>
              <Text style={styles.drawerLabelDevSub}>solo build di sviluppo</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.drawerRow}
            onPress={() => {
              hapticLight();
              props.navigation.navigate('ChatDemos');
              props.navigation.closeDrawer();
            }}
            activeOpacity={0.85}
          >
            <Icon name="albums-outline" size={22} color={colors.textMuted} />
            <View style={styles.devLabelCol}>
              <Text style={styles.drawerLabelDev}>Chat demos</Text>
              <Text style={styles.drawerLabelDevSub}>card demo + chat vuota</Text>
            </View>
          </TouchableOpacity>
        </>
      ) : null}
    </DrawerContentScrollView>
  );
}

export function MainDrawerNavigator() {
  const { colors } = useTheme();
  const drawerPanel = useMemo(
    () => ({
      width: 288 as const,
      backgroundColor: colors.bgPrimary,
    }),
    [colors.bgPrimary],
  );

  return (
    <Drawer.Navigator
      drawerContent={CustomDrawerContent}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.35)',
        drawerStyle: drawerPanel,
        swipeEdgeWidth: 56,
      }}
    >
      <Drawer.Screen name="Chat" component={ChatScreen} />
      <Drawer.Screen name="ChatDemos" component={ChatDemosScreen} />
      <Drawer.Screen name="Today" component={HomeScreen} />
      <Drawer.Screen name="Foto" component={FotoScreen} />
      <Drawer.Screen name="Profilo" component={ProfiloStackNavigator} />
      <Drawer.Screen name="Salute" component={SaluteStackNavigator} />
    </Drawer.Navigator>
  );
}
