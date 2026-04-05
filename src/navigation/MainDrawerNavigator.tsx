import React, { useMemo } from 'react';
import { createDrawerNavigator, DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { HEALTHKIT_HISTORICAL_SYNC_STORAGE_KEY, syncHistoricalHealthData } from '../services/healthKitHistoricalSync';
import type { AppStackParamList } from './rootTypes';
import { HomeScreen } from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ChatDemosScreen } from '../screens/ChatDemosScreen';
import { DietaStackNavigator } from './DietaStackNavigator';
import { FotoStackNavigator } from './FotoStackNavigator';
import { ProfiloStackNavigator } from './ProfiloStackNavigator';
import { SaluteStackNavigator } from './SaluteStackNavigator';
import type { MainParamList } from './types';

const Drawer = createDrawerNavigator<MainParamList>();

const DRAWER_ITEMS: { name: keyof MainParamList; label: string; ion: string }[] = [
  { name: 'Chat', label: 'chat', ion: 'chatbubble-ellipses' },
  { name: 'Dieta', label: 'dieta', ion: 'nutrition-outline' },
  { name: 'Foto', label: 'body check', ion: 'camera-outline' },
  { name: 'Salute', label: 'salute', ion: 'heart-outline' },
  { name: 'Profilo', label: 'profilo', ion: 'person' },
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
          <TouchableOpacity
            style={styles.drawerRow}
            onPress={async () => {
              hapticLight();
              if (Platform.OS !== 'ios') {
                Alert.alert('Solo iOS', 'Lo storico HealthKit è disponibile solo su iOS.');
                props.navigation.closeDrawer();
                return;
              }
              try {
                await AsyncStorage.removeItem(HEALTHKIT_HISTORICAL_SYNC_STORAGE_KEY);
                const ok = await syncHistoricalHealthData();
                if (ok) {
                  await AsyncStorage.setItem(HEALTHKIT_HISTORICAL_SYNC_STORAGE_KEY, 'true');
                  Alert.alert('Fatto', 'Storico HealthKit risincronizzato.');
                } else {
                  Alert.alert('Errore', 'Impossibile completare la risincronizzazione.');
                }
              } catch {
                Alert.alert('Errore', 'Impossibile completare la risincronizzazione.');
              }
              props.navigation.closeDrawer();
            }}
            activeOpacity={0.85}
          >
            <Icon name="pulse-outline" size={22} color={colors.textMuted} />
            <View style={styles.devLabelCol}>
              <Text style={styles.drawerLabelDev}>Re-sync HealthKit history</Text>
              <Text style={styles.drawerLabelDevSub}>forza import ~90 giorni (3 mesi)</Text>
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
      <Drawer.Screen name="Dieta" component={DietaStackNavigator} />
      <Drawer.Screen name="ChatDemos" component={ChatDemosScreen} />
      <Drawer.Screen name="Today" component={HomeScreen} />
      <Drawer.Screen name="Foto" component={FotoStackNavigator} />
      <Drawer.Screen name="Salute" component={SaluteStackNavigator} />
      <Drawer.Screen name="Profilo" component={ProfiloStackNavigator} />
    </Drawer.Navigator>
  );
}
