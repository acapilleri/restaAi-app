import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { DrawerMenuButton } from '../components/navigation/DrawerMenuButton';
import { getChatKeyboardAutoClose, setChatKeyboardAutoClose } from '../chat/keyboardPreference';
import { getStoredLanguage, setStoredLanguage, type AppLanguage } from '../api/authStorage';
import type { ProfiloStackParamList } from '../navigation/types';

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string; sub: string }[] = [
  { value: 'system', label: 'Sistema', sub: 'Segue le impostazioni del dispositivo' },
  { value: 'light', label: 'Chiaro', sub: 'Tema chiaro sempre' },
  { value: 'dark', label: 'Scuro', sub: 'Tema scuro sempre' },
];

const LANGUAGE_OPTIONS: { value: AppLanguage; label: string; sub: string }[] = [
  { value: 'it', label: 'Italiano', sub: 'Mostra giorni e testi del piano in italiano' },
  { value: 'en', label: 'English', sub: 'Show plan days and labels in English' },
];

export function ConfiguraScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfiloStackParamList, 'Configura'>>();
  const { colors, preference, setPreference } = useTheme();
  const [chatKeyboardAutoClose, setChatKeyboardAutoCloseState] = useState(true);
  const [language, setLanguage] = useState<AppLanguage>('it');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: 20 },
        scroll: { flex: 1 },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          marginTop: 8,
        },
        backHit: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: -4,
        },
        title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, flex: 1 },
        card: {
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingVertical: 8,
          paddingHorizontal: 16,
          marginBottom: 24,
        },
        sectionLabel: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.textMuted,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: 10,
          marginTop: 4,
        },
        preferenceRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingVertical: 8,
        },
        preferenceTextCol: { flex: 1 },
        preferenceTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
        preferenceSub: { marginTop: 3, fontSize: 12, color: colors.textSecondary },
        appearanceRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
        },
        appearanceRowFirst: {
          borderTopWidth: 0,
        },
        appearanceTextCol: { flex: 1, paddingRight: 12 },
        appearanceLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
        appearanceSub: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
        checkWrap: { width: 28, alignItems: 'flex-end' },
      }),
    [colors],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const enabled = await getChatKeyboardAutoClose();
      if (active) setChatKeyboardAutoCloseState(enabled);
      const storedLanguage = await getStoredLanguage();
      if (active) setLanguage(storedLanguage);
    })();
    return () => {
      active = false;
    };
  }, []);

  const onToggleKeyboardAutoClose = useCallback(async (enabled: boolean) => {
    setChatKeyboardAutoCloseState(enabled);
    hapticLight();
    await setChatKeyboardAutoClose(enabled);
  }, []);

  const onPickAppearance = useCallback(
    async (value: ThemePreference) => {
      if (value === preference) return;
      hapticLight();
      await setPreference(value);
    },
    [preference, setPreference],
  );

  const onPickLanguage = useCallback(
    async (value: AppLanguage) => {
      if (value === language) return;
      hapticLight();
      setLanguage(value);
      await setStoredLanguage(value);
    },
    [language],
  );

  const switchTrackOff = colors.borderStrong;
  const switchThumbOff = colors.bgSecondary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backHit}
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Indietro"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="chevron-back" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Configura</Text>
        <DrawerMenuButton placement="trailing" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Chat</Text>
        <View style={styles.card}>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceTextCol}>
              <Text style={styles.preferenceTitle}>Chiudi tastiera dopo invio chat</Text>
              <Text style={styles.preferenceSub}>Default attivo. Disattiva per tenerla aperta.</Text>
            </View>
            <Switch
              value={chatKeyboardAutoClose}
              onValueChange={(v) => {
                void onToggleKeyboardAutoClose(v);
              }}
              trackColor={{ false: switchTrackOff, true: colors.primaryMuted }}
              thumbColor={chatKeyboardAutoClose ? colors.primary : switchThumbOff}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Aspetto</Text>
        <View style={styles.card}>
          {APPEARANCE_OPTIONS.map((opt, index) => {
            const selected = preference === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.appearanceRow, index === 0 && styles.appearanceRowFirst]}
                onPress={() => {
                  void onPickAppearance(opt.value);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.appearanceTextCol}>
                  <Text style={styles.appearanceLabel}>{opt.label}</Text>
                  <Text style={styles.appearanceSub}>{opt.sub}</Text>
                </View>
                <View style={styles.checkWrap}>
                  {selected ? <Icon name="checkmark-circle" size={24} color={colors.primary} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Lingua</Text>
        <View style={styles.card}>
          {LANGUAGE_OPTIONS.map((opt, index) => {
            const selected = language === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.appearanceRow, index === 0 && styles.appearanceRowFirst]}
                onPress={() => {
                  void onPickLanguage(opt.value);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={styles.appearanceTextCol}>
                  <Text style={styles.appearanceLabel}>{opt.label}</Text>
                  <Text style={styles.appearanceSub}>{opt.sub}</Text>
                </View>
                <View style={styles.checkWrap}>
                  {selected ? <Icon name="checkmark-circle" size={24} color={colors.primary} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
