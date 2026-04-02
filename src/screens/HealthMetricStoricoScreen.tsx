import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import type { SaluteStackParamList } from '../navigation/types';
import {
  fetchSaluteMetricHistory,
  parseSaluteMetricId,
  saluteMetricTitle,
  type StoricoRow,
} from '../services/appleHealth';

type Nav = NativeStackNavigationProp<SaluteStackParamList, 'SaluteStorico'>;
type R = RouteProp<SaluteStackParamList, 'SaluteStorico'>;

export function HealthMetricStoricoScreen() {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: 16 },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          marginTop: 8,
        },
        backHit: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: -4,
          marginRight: -2,
        },
        title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, flex: 1 },
        loader: { marginTop: 32 },
        scroll: { flex: 1 },
        scrollContent: { paddingBottom: 32 },
        row: {
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
        },
        rowLast: { borderBottomWidth: 0 },
        rowText: { gap: 4 },
        primary: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
        secondary: { fontSize: 13, color: colors.textSecondary },
        centered: { paddingTop: 32, paddingHorizontal: 8 },
        emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
      }),
    [colors],
  );

  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const rawMetric = route.params?.metric;
  const metric = typeof rawMetric === 'string' ? parseSaluteMetricId(rawMetric) : rawMetric;

  const [rows, setRows] = useState<StoricoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!metric || Platform.OS !== 'ios') {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSaluteMetricHistory(metric);
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [metric]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const title = metric ? saluteMetricTitle(metric) : 'Storico';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <DrawerMenuButton placement="trailing" />
      </View>

      {!metric ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Metrica non valida.</Text>
        </View>
      ) : Platform.OS !== 'ios' ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Disponibile solo su iPhone con Apple Salute.</Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : rows.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Nessun dato nel periodo.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {rows.map((row, index) => (
            <View
              key={`${row.date.getTime()}-${index}`}
              style={[styles.row, index === rows.length - 1 && styles.rowLast]}
            >
              <View style={styles.rowText}>
                <Text style={styles.primary}>{row.primaryLine}</Text>
                {row.secondaryLine ? <Text style={styles.secondary}>{row.secondaryLine}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
