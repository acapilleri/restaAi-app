import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getDashboard } from '../api/dashboard';
import { createWeight } from '../api/weights';
import { fetchRecipeAlternatives } from '../api/recipes';
import { useQuery } from '@tanstack/react-query';
import { RecipeAlternativeCard } from '../components/RecipeAlternativeCard';
import type { DashboardResponse, DashboardUser } from '../api/dashboard';
import type { DietPlanMeal } from '../api/dietPlan';
import type { AppColors } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { DrawerMenuButton } from '../components/navigation/DrawerMenuButton';

const DAY_NAMES_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MEAL_LABELS = ['colazione', 'pranzo', 'spuntino', 'cena'];
const MEAL_TIMES = ['08:00', '13:00', '16:30', '20:00'];

/** Restituisce label e orario in base al nome del pasto (es. "Colazione" → colazione, 08:00). Fallback su index se il nome non è riconosciuto. */
function getMealDisplay(mealName: string, index: number): { label: string; time: string } {
  const normalized = (mealName || '').trim().toLowerCase();
  const byName: Record<string, number> = {
    colazione: 0,
    breakfast: 0,
    pranzo: 1,
    lunch: 1,
    spuntino: 2,
    snack: 2,
    merenda: 2,
    cena: 3,
    dinner: 3,
  };
  const i = byName[normalized] ?? index % MEAL_LABELS.length;
  return {
    label: MEAL_LABELS[i],
    time: MEAL_TIMES[i],
  };
}

const MOCK_MEALS: DietPlanMeal[] = [
  {
    name: 'Avena con frutti di bosco',
    foods: 'Latte parzialmente scremato 200ml · avena 40g · mirtilli 80g · cannella q.b.',
    calories: 350,
    protein: 12,
    carbs: 55,
    fat: 8,
  },
  {
    name: 'Riso e pollo',
    foods: 'Riso 70g · petto di pollo 120g · zucchine grigliate · olio evo 10g',
    calories: 550,
    protein: 45,
    carbs: 65,
    fat: 12,
  },
  {
    name: 'Yogurt e mandorle',
    foods: 'Yogurt greco 0% 150g · mandorle 15g · miele 5g',
    calories: 150,
    protein: 14,
    carbs: 8,
    fat: 9,
  },
  {
    name: 'Salmone e verdure',
    foods: 'Salmone 150g · broccoli al vapore · pane integrale 40g · limone',
    calories: 600,
    protein: 48,
    carbs: 42,
    fat: 18,
  },
];

function formatFoodsWithSpaces(foods: string | undefined | null): string {
  let s = typeof foods === 'string' ? foods : '';
  if (!s.trim()) return s;
  // Se il backend ha inviato un array serializzato come stringa, parsalo e unisci
  const trimmed = s.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        s = parsed.map((x) => (typeof x === 'string' ? x : String(x)).trim()).filter(Boolean).join(' · ');
      }
    } catch {
      // non è JSON valido, usa la stringa così com'è
    }
  }
  return s
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const MOCKUP_WIDTH = 240;

function SkeletonCard() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 180,
        height: 130,
        backgroundColor: colors.bgSecondary,
        borderRadius: 14,
        marginRight: 10,
      }}
    />
  );
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return s;
  }
}

export function HomeScreen() {
  const { user, token, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const scale = width / MOCKUP_WIDTH;
  const s = (px: number) => Math.round(px * scale);
  const styles = useMemo(() => makeHomeStyles(s, colors), [width, colors]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightSaving, setWeightSaving] = useState(false);
  const [selectedMealIndex, setSelectedMealIndex] = useState(0);

  const todayMeals: DietPlanMeal[] = (dashboard?.today_meals ?? []) as DietPlanMeal[];
  const displayMeals = todayMeals.length > 0 ? todayMeals : MOCK_MEALS;

  const { data: recipesData, isLoading: recipesLoading } = useQuery({
    queryKey: ['recipeAlternatives'],
    queryFn: fetchRecipeAlternatives,
    staleTime: 1000 * 60 * 60,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
  const recipes = recipesData?.recipes ?? [];

  useEffect(() => {
    if (selectedMealIndex >= displayMeals.length) {
      setSelectedMealIndex(0);
    }
  }, [displayMeals.length, selectedMealIndex]);

  // GET /api/v1/dashboard is the only Home request; it includes user, today, stats, briefing, and today_meals.
  const load = useCallback(async () => {
    try {
      setError(null);
      const dashRes = await getDashboard();
      setDashboard(dashRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    hapticLight();
    setRefreshing(true);
    load();
  }, [load]);

  const openWeightModal = useCallback(() => {
    setWeightModalVisible(true);
    setWeightInput('');
  }, []);

  const saveWeight = useCallback(async () => {
    const trimmed = weightInput.trim().replace(',', '.');
    const value = parseFloat(trimmed);
    if (!Number.isFinite(value) || value <= 0 || value >= 300) {
      Alert.alert('Peso non valido', 'Inserisci un valore tra 1 e 300 kg (es. 72.5)');
      return;
    }
    setWeightSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await createWeight(value, today);
      setWeightModalVisible(false);
      setWeightInput('');
      await load();
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile salvare il peso');
    } finally {
      setWeightSaving(false);
    }
  }, [weightInput, load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (token && !user) refreshUser();
  }, [token, user, refreshUser]);

  const dashUser = dashboard?.user as { name?: string; first_name?: string; firstName?: string } | undefined;
  const dashboardName =
    dashUser?.first_name?.trim() ||
    dashUser?.firstName?.trim() ||
    (dashUser?.name ? dashUser.name.split(/\s+/)[0]?.trim() : null);
  const userName = user?.first_name?.trim() || user?.email?.split('@')[0];
  const name = dashboardName || userName || 'Utente';
  const dateStr = dashboard?.today?.date ? formatDate(dashboard.today.date) : '—';
  const planSummary = dashboard?.today?.plan_summary;
  const dashUserData = dashboard?.user as DashboardUser | undefined;
  const currentWeight = dashUserData?.current_weight ?? dashUserData?.weight ?? undefined;
  const targetWeight = dashUserData?.target_weight ?? dashUserData?.goal_weight_kg ?? undefined;
  const weightLost = dashUserData?.weight_lost ?? undefined;

  if (loading && !dashboard) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.pad}>
          {error ? (
            <View>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => onRefresh()}>
                <Text style={styles.retryBtnText}>Riprova</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.topRow}>
            <View style={styles.topRowCenter}>
              <Text style={styles.date}>{dateStr}</Text>
              <Text style={styles.greeting}>Ciao, {name}</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(name[0] || 'U').toUpperCase()}</Text>
            </View>
            <DrawerMenuButton placement="trailing" />
          </View>

          {planSummary ? (
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>
                piano di oggi — {planSummary.calories} kcal
              </Text>
              <Text style={styles.heroTitle}>{planSummary.day}</Text>
              {(planSummary.protein_g != null || planSummary.carbs_g != null || planSummary.fat_g != null) ? (
                <View style={styles.macroRow}>
                  {planSummary.protein_g != null ? (
                    <View style={styles.macro}>
                      <Text style={styles.macroNum}>{planSummary.protein_g}</Text>
                      <Text style={styles.macroLbl}>proteine g</Text>
                    </View>
                  ) : null}
                  {planSummary.carbs_g != null ? (
                    <View style={styles.macro}>
                      <Text style={styles.macroNum}>{planSummary.carbs_g}</Text>
                      <Text style={styles.macroLbl}>carboidrati g</Text>
                    </View>
                  ) : null}
                  {planSummary.fat_g != null ? (
                    <View style={styles.macro}>
                      <Text style={styles.macroNum}>{planSummary.fat_g}</Text>
                      <Text style={styles.macroLbl}>grassi g</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>piano di oggi</Text>
              <Text style={styles.heroTitle}>
                {dashboard?.today?.has_diet ? 'Carica piano nella tab Dieta' : 'Nessun piano caricato'}
              </Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={openWeightModal}
              activeOpacity={0.8}
            >
              <Text style={styles.statLbl}>peso oggi</Text>
              <Text style={styles.statVal}>
                {currentWeight != null ? currentWeight : '—'}
                <Text style={styles.statUnit}> kg</Text>
              </Text>
              {dashboard?.today?.weighed_today ? (
                <Text style={[styles.statSub, styles.statSubG]}>registrato oggi</Text>
              ) : currentWeight == null ? (
                <Text style={[styles.statSub, styles.statSubHint]}>Tocca per inserire</Text>
              ) : null}
            </TouchableOpacity>
            <View style={styles.statCard}>
              <Text style={styles.statLbl}>obiettivo</Text>
              <Text style={styles.statVal}>
                {targetWeight != null ? `→ ${targetWeight}` : '—'}
                <Text style={styles.statUnit}> kg</Text>
              </Text>
              {weightLost != null ? (
                <Text style={[styles.statSub, styles.statSubA]}>−{weightLost} finora</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.mealsSection}>
            <View style={styles.mealsSectionHeader}>
              <Text style={styles.mealsSectionTitle}>Pasti di oggi</Text>
              <Text style={styles.mealsSectionHint}>scorri per vedere tutti →</Text>
            </View>
            <FlatList
              data={displayMeals}
                keyExtractor={(m, i) => `${m.name}-${i}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mealsListContent}
                renderItem={({ item, index }) => {
                  const isSelected = index === selectedMealIndex;
                  const { label, time } = getMealDisplay(item.name, index);
                  const hasMacros = [item.protein, item.carbs, item.fat].some((v) => v != null && Number.isFinite(v) && v > 0);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.mealCardSlider,
                        isSelected && styles.mealCardSliderSelected,
                      ]}
                      onPress={() => {
                        hapticLight();
                        setSelectedMealIndex(index);
                      }}
                      activeOpacity={0.97}
                    >
                      <View style={styles.mealCardBody}>
                        <Text style={styles.mealCardMeta}>
                          {time} · {label}
                        </Text>
                        <Text style={styles.mealCardName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.mealCardFoods} numberOfLines={2}>
                          {formatFoodsWithSpaces(item.foods)}
                        </Text>
                        <Text style={styles.mealCardKcal}>{item.calories} kcal</Text>
                        {hasMacros ? (
                          <View style={styles.mealCardMacroRow}>
                            <Text style={styles.mealCardMacroItem}>
                              P <Text style={styles.mealCardMacroVal}>{item.protein != null && Number.isFinite(item.protein) ? `${item.protein}g` : '—'}</Text>
                            </Text>
                            <Text style={styles.mealCardMacroItem}>
                              C <Text style={styles.mealCardMacroVal}>{item.carbs != null && Number.isFinite(item.carbs) ? `${item.carbs}g` : '—'}</Text>
                            </Text>
                            <Text style={styles.mealCardMacroItem}>
                              G <Text style={styles.mealCardMacroVal}>{item.fat != null && Number.isFinite(item.fat) ? `${item.fat}g` : '—'}</Text>
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
          </View>

          <Text style={styles.altTitle}>RICETTE ALTERNATIVE — STESSI MACRO</Text>
          {recipesLoading ? (
            <FlatList
              horizontal
              data={[1, 2, 3]}
              keyExtractor={(i) => String(i)}
              renderItem={() => <SkeletonCard />}
              showsHorizontalScrollIndicator={false}
              snapToInterval={190}
              decelerationRate="fast"
              contentContainerStyle={styles.altListContent}
            />
          ) : (
            <FlatList
              horizontal
              data={recipes}
              style={styles.altList}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.altItemWrap}>
                <View style={styles.altCardWrap}>
                  <RecipeAlternativeCard
                    recipeId={item.id}
                    mealType={item.meal_type}
                    name={item.name}
                    ingredients={item.ingredients}
                    protein={item.protein}
                    carbs={item.carbs}
                    fat={item.fat}
                  />
                </View>
                </View>
              )}
              showsHorizontalScrollIndicator={false}
              snapToInterval={190}
              decelerationRate="fast"
              removeClippedSubviews={false}
              contentContainerStyle={styles.altListContent}
            />
          )}

          {dashboard?.briefing?.suggestion_today ? (
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionText}>{dashboard.briefing.suggestion_today}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={weightModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.weightModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.weightModalContent}>
            <Text style={styles.weightModalTitle}>Inserisci peso (kg)</Text>
            <TextInput
              style={styles.weightModalInput}
              placeholder="es. 72.5"
              placeholderTextColor={colors.textMuted}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              editable={!weightSaving}
            />
            <View style={styles.weightModalActions}>
              <TouchableOpacity
                style={styles.weightModalBtnCancel}
                onPress={() => { setWeightModalVisible(false); setWeightInput(''); }}
                disabled={weightSaving}
              >
                <Text style={styles.weightModalBtnCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.weightModalBtnOk, !weightInput.trim() && styles.weightModalBtnDisabled]}
                onPress={saveWeight}
                disabled={weightSaving || !weightInput.trim()}
              >
                {weightSaving ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.weightModalBtnOkText}>Salva</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeHomeStyles(s: (px: number) => number, colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    scroll: { flex: 1 },
    pad: {
      position: 'relative' as const,
      paddingHorizontal: s(13),
      paddingTop: s(10),
      paddingBottom: s(24),
    },
    topRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: s(10),
    },
    topRowCenter: {
      flex: 1,
    },
    date: { fontSize: s(10), color: colors.textSecondary, fontWeight: '500' as const },
    greeting: { fontSize: s(16), fontWeight: '500' as const, color: colors.textPrimary },
    avatar: {
      width: s(32),
      height: s(32),
      borderRadius: s(16),
      backgroundColor: colors.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    avatarText: { fontSize: s(12), fontWeight: '500' as const, color: colors.textOnPrimary },
    hero: {
      backgroundColor: colors.primary,
      borderRadius: s(12),
      paddingVertical: s(11),
      paddingHorizontal: s(13),
      marginBottom: s(9),
    },
    heroLabel: {
      fontSize: s(9),
      color: colors.primaryMuted,
      fontWeight: '500' as const,
      marginBottom: s(3),
    },
    heroTitle: {
      fontSize: s(14),
      fontWeight: '500' as const,
      color: colors.textOnPrimary,
      marginBottom: s(7),
    },
    macroRow: { flexDirection: 'row' as const, gap: s(5) },
    macro: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: s(7),
      paddingVertical: s(5),
      paddingHorizontal: s(6),
      alignItems: 'center' as const,
    },
    macroNum: { fontSize: s(13), fontWeight: '500' as const, color: colors.textOnPrimary },
    macroLbl: { fontSize: s(8), color: colors.primaryMuted },
    statsRow: { flexDirection: 'row' as const, gap: s(7), marginBottom: s(9) },
    statCard: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderWidth: 0.5,
      borderColor: colors.border,
      borderRadius: s(10),
      paddingVertical: s(8),
      paddingHorizontal: s(10),
    },
    statLbl: {
      fontSize: s(8),
      color: colors.textSecondary,
      fontWeight: '500' as const,
      marginBottom: s(2),
    },
    statVal: { fontSize: s(17), fontWeight: '500' as const, color: colors.textPrimary },
    statUnit: { fontSize: s(10), color: colors.textSecondary, fontWeight: '400' as const },
    statSub: { fontSize: s(9), marginTop: s(1) },
    statSubG: { color: colors.primary },
    statSubA: { color: colors.amber },
    statSubHint: { color: colors.textSecondary, fontSize: s(8) },
    suggestionRow: { marginBottom: s(9) },
    suggestionText: { fontSize: s(11), color: colors.textSecondary },
    mealsSection: { marginBottom: s(14) },
    mealsSectionHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: s(6),
    },
    mealsSectionTitle: {
      fontSize: s(12),
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },
    mealsSectionHint: {
      fontSize: s(8),
      color: colors.textSecondary,
    },
    mealsListContent: { paddingRight: s(12) },
    mealCardSlider: {
      width: s(110),
      backgroundColor: colors.bgCard,
      borderRadius: s(12),
      borderWidth: 1.5,
      borderColor: 'transparent',
      overflow: 'hidden' as const,
      marginRight: s(8),
    },
    mealCardSliderSelected: {
      borderColor: colors.primary,
    },
    mealCardBody: { paddingVertical: s(3), paddingHorizontal: s(6) },
    mealCardMeta: {
      fontSize: s(6),
      color: colors.textSecondary,
      fontWeight: '500' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.4,
      marginBottom: s(0),
    },
    mealCardName: {
      fontSize: s(9),
      fontWeight: '500' as const,
      color: colors.textPrimary,
      marginBottom: s(2),
    },
    mealCardFoods: {
      fontSize: s(7),
      color: colors.textSecondary,
      lineHeight: s(9),
      marginBottom: s(3),
    },
    mealCardKcal: {
      fontSize: s(7),
      color: colors.primary,
      fontWeight: '500' as const,
    },
    mealCardMacroRow: { flexDirection: 'row' as const, gap: s(4), marginTop: s(1) },
    mealCardMacroItem: { fontSize: s(6), color: colors.textSecondary },
    mealCardMacroVal: { color: colors.textPrimary, fontWeight: '500' as const },
    altTitle: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: colors.primary,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      marginBottom: 10,
      marginHorizontal: 16,
    },
    altList: {
      overflow: 'visible' as const,
    },
    altListContent: {
      paddingHorizontal: 16,
      paddingRight: 24,
      paddingTop: 14,
      overflow: 'visible' as const,
      zIndex: 1,
    },
    altItemWrap: {
      overflow: 'visible' as const,
      position: 'relative' as const,
      zIndex: 1,
      elevation: 1,
    },
    altCardWrap: {
      marginRight: 10,
      overflow: 'visible' as const,
    },
    loadingBox: { padding: 24, alignItems: 'center' as const },
    errorText: { fontSize: 14, color: colors.amber, marginBottom: 8 },
    retryBtn: {
      marginTop: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    retryBtnText: { fontSize: 14, fontWeight: '600' as const, color: colors.textOnPrimary },
    weightModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: 24,
    },
    weightModalContent: {
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      padding: 20,
    },
    weightModalTitle: { fontSize: 16, fontWeight: '600' as const, color: colors.textPrimary, marginBottom: 12 },
    weightModalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: colors.textPrimary,
      marginBottom: 16,
    },
    weightModalActions: { flexDirection: 'row' as const, gap: 12, justifyContent: 'flex-end' },
    weightModalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16 },
    weightModalBtnCancelText: { fontSize: 15, color: colors.textSecondary },
    weightModalBtnOk: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 80,
      alignItems: 'center' as const,
    },
    weightModalBtnOkText: { fontSize: 15, fontWeight: '600' as const, color: colors.textOnPrimary },
    weightModalBtnDisabled: { opacity: 0.5 },
  });
}
