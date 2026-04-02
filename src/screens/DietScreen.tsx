import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import { getDietPlans, createDietPlan, deleteDietPlan, reactivateDietPlan, scanDietPlan } from '../api/dietPlan';
import type { DietPlanRecord, DietPlanMeal } from '../api/dietPlan';
import { getStoredLanguage, type AppLanguage } from '../api/authStorage';
import { formatWeekday, getLocaleTag } from '../utils/locale';
import type { DietaStackParamList } from '../navigation/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const DIET_COPY: Record<
  AppLanguage,
  {
    unknownDate: string;
    title: string;
    active: string;
    noPlan: string;
    allPlans: string;
    historical: string;
  }
> = {
  it: {
    unknownDate: 'data sconosciuta',
    title: 'Il tuo piano',
    active: 'attivo',
    noPlan: 'nessun piano',
    allPlans: 'Tutti i piani',
    historical: 'storico',
  },
  en: {
    unknownDate: 'unknown date',
    title: 'Your plan',
    active: 'active',
    noPlan: 'no plan',
    allPlans: 'All plans',
    historical: 'history',
  },
};

function formatMacro(value: number | undefined | null): string {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)}g` : '—';
}

function formatPlanDate(value: string, language: AppLanguage): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return DIET_COPY[language].unknownDate;
  return d.toLocaleDateString(getLocaleTag(language), { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DietScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<DietaStackParamList, 'DietaMain'>>();
  /** ProfiloStack sopra DietaStack: back torna al profilo quando si entra da «La mia dieta». */
  const profiloStackNav = navigation.getParent();
  const showBackToProfilo = profiloStackNav?.canGoBack() ?? false;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bgPrimary },
        scroll: { flex: 1 },
        pad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
        topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
        backHit: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: -4,
          marginRight: 4,
        },
        title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
        titleWithMenu: { flex: 1, marginRight: 8 },
        badge: { backgroundColor: colors.greenPill, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
        badgeOff: { backgroundColor: colors.bgSecondary },
        badgeText: { fontSize: 13, color: colors.primaryDark, fontWeight: '500' },
        badgeTextOff: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
        loadingBox: { padding: 24, alignItems: 'center' },
        errorText: { fontSize: 14, color: colors.amber, marginBottom: 14 },
        historySection: { marginBottom: 14 },
        historyTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
        historyRow: { gap: 8 },
        historyCard: {
          backgroundColor: colors.bgSecondary,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
        },
        historyCardActive: {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.greenPill,
        },
        historyCardOn: { backgroundColor: colors.primary, borderColor: colors.primary },
        historyDate: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
        historyDateOn: { color: colors.textOnPrimary },
        historyMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        historyMetaActive: { color: colors.primaryDark, fontWeight: '600' },
        historyMetaOn: { color: colors.textOnPrimary },
        daysRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
        dayPill: { backgroundColor: colors.bgSecondary, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16 },
        dayPillOn: { backgroundColor: colors.primary },
        dayPillText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
        dayPillTextOn: { color: colors.textOnPrimary },
        section: {
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 16,
          paddingHorizontal: 18,
          marginBottom: 14,
        },
        dietDay: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
        dietMeal: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        },
        dietMealLast: { borderBottomWidth: 0 },
        dietMealLeft: { flex: 1, minWidth: 0, marginRight: 12 },
        dietMealName: { fontSize: 15, color: colors.textPrimary },
        dietMealDetail: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        dietKcal: { fontSize: 15, color: colors.primary, fontWeight: '600' },
        rawDietLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },
        rawDietText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
        rawDietHint: { fontSize: 14, color: colors.textMuted, fontStyle: 'italic' },
        summaryRow: { marginBottom: 14 },
        summaryText: { fontSize: 13, color: colors.textSecondary },
        deleteBtn: { alignSelf: 'flex-start', marginBottom: 14 },
        deleteBtnText: { fontSize: 14, color: colors.amber, fontWeight: '500' },
        reactivateBtn: {
          alignSelf: 'flex-start',
          marginBottom: 14,
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 12,
        },
        reactivateBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
        uploadArea: {
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.borderStrong,
          borderRadius: 14,
          padding: 20,
          alignItems: 'center',
          marginBottom: 14,
        },
        uploadAreaTitle: { fontSize: 13, color: colors.textHint, marginBottom: 8 },
        uploadAreaText: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, textAlign: 'center' },
        uploadBtn: { marginTop: 12, backgroundColor: colors.greenPill, borderRadius: 10, padding: 12 },
        uploadBtnText: { fontSize: 15, color: colors.primaryDark, fontWeight: '500' },
        modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 16 },
        modalBtnCancelText: { fontSize: 15, color: colors.textSecondary },
        modalBtnOk: {
          backgroundColor: colors.primary,
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 10,
          minWidth: 80,
          alignItems: 'center',
        },
        modalBtnDisabled: { opacity: 0.6 },
        modalBtnOkText: { fontSize: 15, fontWeight: '600', color: colors.textOnPrimary },

        createDietRoot: { flex: 1, backgroundColor: colors.bgPrimary },
        createDietHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        createDietTitle: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
        createDietBody: { flex: 1 },
        createDietScroll: { flex: 1 },
        createDietScrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
        createDietLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
        createDietLabelPhotos: { marginTop: 20 },
        createDietHint: { fontSize: 14, color: colors.textSecondary, marginBottom: 10, lineHeight: 20 },
        createDietEditor: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          fontSize: 15,
          color: colors.textPrimary,
          minHeight: Math.min(SCREEN_HEIGHT * 0.32, 220),
          maxHeight: 280,
        },
        editorToolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
        toolbarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        toolbarBtnText: { fontSize: 14, color: colors.textSecondary },
        toolbarBtnTextDisabled: { color: colors.textMuted },
        charCount: { fontSize: 13, color: colors.textMuted },
        scanBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 12,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.primary,
          backgroundColor: colors.bgSecondary,
          marginTop: 4,
        },
        scanBtnText: { fontSize: 16, fontWeight: '600', color: colors.primary },
        createDietFooter: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bgPrimary,
        },
      }),
    [colors],
  );

  const [plan, setPlan] = useState<DietPlanRecord | null>(null);
  const [plans, setPlans] = useState<DietPlanRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadText, setUploadText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('it');

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getDietPlans();
      const allPlans = Array.isArray(res.diet_plans) ? res.diet_plans : [];
      setPlans(allPlans);
      if (allPlans.length === 0) {
        setPlan(null);
        setSelectedPlanId(null);
        setSelectedDay(null);
        return;
      }

      const selected = allPlans.find((p) => p.id === selectedPlanId) ?? allPlans[0];
      setPlan(selected);
      setSelectedPlanId(selected.id);
      const nextDays = selected?.parsed?.days ? Object.keys(selected.parsed.days) : [];
      if (nextDays.length === 0) {
        setSelectedDay(null);
      } else if (!selectedDay || !selected.parsed.days?.[selectedDay]) {
        setSelectedDay(nextDays[0]);
      }
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number } };
      if (ax.response?.status === 404) {
        setPlan(null);
        setPlans([]);
        setSelectedPlanId(null);
        setSelectedDay(null);
        setError(null);
      } else {
        setPlan(null);
        setPlans([]);
        setSelectedPlanId(null);
        setError(e instanceof Error ? e.message : 'Errore caricamento piano');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const storedLanguage = await getStoredLanguage();
        if (active) setLanguage(storedLanguage);
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const onRefresh = useCallback(() => {
    hapticLight();
    setRefreshing(true);
    load();
  }, [load]);

  const handleScanDiet = useCallback(() => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.75,
        maxWidth: 1600,
        maxHeight: 1600,
      },
      async (res) => {
        if (res.didCancel || !res.assets?.[0]) return;
        const asset = res.assets[0];
        const uri = asset.uri ?? (asset as { android?: { uri?: string } }).android?.uri;
        if (!uri) return;
        setScanning(true);
        try {
          const formData = new FormData();
          formData.append('image', {
            uri,
            type: asset.type ?? 'image/jpeg',
            name: asset.fileName ?? 'diet.jpg',
          } as unknown as Blob);
          const { text } = await scanDietPlan(formData);
          if (text) setUploadText((prev) => (prev ? `${prev}\n\n${text}` : text));
          else Alert.alert('Nessun testo', 'L\'AI non ha trovato testo nell\'immagine. Prova con una foto più nitida.');
        } catch (e) {
          Alert.alert('Scansione fallita', e instanceof Error ? e.message : 'Riprova con un\'immagine più nitida.');
        } finally {
          setScanning(false);
        }
      },
    );
  }, []);

  const handleUpload = useCallback(async () => {
    const text = uploadText.trim();
    if (!text) return;
    setUploading(true);
    try {
      await createDietPlan(text);
      setUploadModal(false);
      setUploadText('');
      await load();
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile salvare il piano');
    } finally {
      setUploading(false);
    }
  }, [uploadText, load]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Elimina piano',
      'Vuoi eliminare il piano dieta attuale?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDietPlan();
              await load();
            } catch (e) {
              Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile eliminare');
            }
          },
        },
      ],
    );
  }, [load]);

  const handleReactivate = useCallback(async () => {
    if (!plan || plan.active) return;
    try {
      await reactivateDietPlan(plan.id);
      await load();
      Alert.alert('Piano riattivato', 'La dieta selezionata e ora il tuo piano attivo.');
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile riattivare il piano');
    }
  }, [plan, load]);

  const hasRealPlan = plan != null && plan.id > 0;
  const isActivePlan = plan?.active === true;
  const days = plan?.parsed?.days ? Object.keys(plan.parsed.days) : [];
  const t = DIET_COPY[language];
  const selectedDayLabel = selectedDay ? formatWeekday(selectedDay, language, 'long') : '';
  const meals: DietPlanMeal[] = selectedDay && plan?.parsed?.days?.[selectedDay]
    ? plan.parsed.days[selectedDay]
    : [];
  const summary = plan?.parsed?.summary;
  const totalKcal = summary?.daily_calories ?? plan?.total_calories;
  const rawText = (plan?.raw_text ?? plan?.raw_content) ?? '';
  const hasParsedDays = days.length > 0;

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
          <View style={styles.topRow}>
            {showBackToProfilo ? (
              <TouchableOpacity
                style={styles.backHit}
                onPress={() => {
                  hapticLight();
                  profiloStackNav?.goBack();
                }}
                accessibilityRole="button"
                accessibilityLabel="Indietro"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon name="chevron-back" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.title, styles.titleWithMenu]}>{t.title}</Text>
            {hasRealPlan ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{t.active}</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeOff]}>
                <Text style={styles.badgeTextOff}>{t.noPlan}</Text>
              </View>
            )}
            <DrawerMenuButton placement="trailing" />
          </View>

          {loading && !plan ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error && !plan ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : hasRealPlan ? (
            <>
              {plans.length > 0 ? (
                <View style={styles.historySection}>
                  <Text style={styles.historyTitle}>{t.allPlans}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRow}>
                    {plans.map((p) => {
                      const selected = selectedPlanId === p.id;
                      const active = p.active === true;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.historyCard,
                            active && styles.historyCardActive,
                            selected && styles.historyCardOn,
                          ]}
                          onPress={() => {
                            setPlan(p);
                            setSelectedPlanId(p.id);
                            const firstDay = p?.parsed?.days ? Object.keys(p.parsed.days)[0] : null;
                            setSelectedDay(firstDay ?? null);
                          }}
                        >
                          <Text style={[styles.historyDate, selected && styles.historyDateOn]}>
                            {formatPlanDate(p.created_at, language)}
                          </Text>
                          <Text style={[styles.historyMeta, active && styles.historyMetaActive, selected && styles.historyMetaOn]}>
                            {p.active ? t.active : t.historical}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
              {hasParsedDays ? (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow}>
                    {days.map((d) => {
                      const isOn = selectedDay === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          style={[styles.dayPill, isOn && styles.dayPillOn]}
                          onPress={() => setSelectedDay(d)}
                        >
                          <Text style={[styles.dayPillText, isOn && styles.dayPillTextOn]}>
                            {formatWeekday(d, language, 'short')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.section}>
                    <Text style={styles.dietDay}>
                      {selectedDayLabel} — {totalKcal != null ? `${totalKcal} kcal` : ''}
                    </Text>
                    {meals.map((m, i) => (
                      <View
                        key={m.name}
                        style={[styles.dietMeal, i === meals.length - 1 && styles.dietMealLast]}
                      >
                        <View style={styles.dietMealLeft}>
                          <Text style={styles.dietMealName} numberOfLines={2} ellipsizeMode="tail">{m.name}</Text>
                          <Text style={styles.dietMealDetail} numberOfLines={3} ellipsizeMode="tail">{m.foods}</Text>
                        </View>
                        <Text style={styles.dietKcal}>{m.calories}</Text>
                      </View>
                    ))}
                  </View>
                  {summary ? (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryText}>
                        Proteine {formatMacro(summary.protein_g)} · Carbo {formatMacro(summary.carbs_g)} · Grassi {formatMacro(summary.fat_g)}
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.section}>
                  <Text style={styles.rawDietLabel}>Il tuo piano (testo)</Text>
                  {rawText ? (
                    <Text style={styles.rawDietText} selectable>{rawText}</Text>
                  ) : (
                    <Text style={styles.rawDietHint}>L'analisi per giorni e pasti è in corso. Tira giù per aggiornare.</Text>
                  )}
                </View>
              )}
              {isActivePlan ? (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                  <Text style={styles.deleteBtnText}>Disattiva piano attivo</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.reactivateBtn} onPress={handleReactivate}>
                  <Text style={styles.reactivateBtnText}>Riattiva questo piano</Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}

          <View style={styles.uploadArea}>
            <Text style={styles.uploadAreaTitle}>aggiorna la tua dieta</Text>
            <Text style={styles.uploadAreaText}>
              Incolla il testo del piano dalla prescrizione del nutrizionista
            </Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => setUploadModal(true)}
            >
              <Text style={styles.uploadBtnText}>carica nuova dieta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={uploadModal} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.createDietRoot} edges={['top', 'bottom']}>
          <View style={styles.createDietHeader}>
            <Text style={styles.createDietTitle}>Crea dieta</Text>
            <TouchableOpacity
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={() => { setUploadModal(false); setUploadText(''); }}
              disabled={uploading}
            >
              <Icon name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={styles.createDietBody}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              style={styles.createDietScroll}
              contentContainerStyle={styles.createDietScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.createDietLabel}>Testo del piano</Text>
              <Text style={styles.createDietHint}>
                Incolla qui il testo così com'è (dal PDF o dal nutrizionista). Puoi modificarlo prima di salvare.
              </Text>
              <TextInput
                style={styles.createDietEditor}
                placeholder="Incolla qui il testo del piano..."
                placeholderTextColor={colors.textMuted}
                value={uploadText}
                onChangeText={setUploadText}
                multiline
                textAlignVertical="top"
                editable={!uploading}
              />
              <View style={styles.editorToolbar}>
                <TouchableOpacity
                  style={styles.toolbarBtn}
                  onPress={() => setUploadText('')}
                  disabled={uploading || !uploadText}
                >
                  <Icon name="trash-outline" size={20} color={uploadText ? colors.textSecondary : colors.textMuted} />
                  <Text style={[styles.toolbarBtnText, !uploadText && styles.toolbarBtnTextDisabled]}>Pulisci</Text>
                </TouchableOpacity>
                {uploadText.length > 0 && (
                  <Text style={styles.charCount}>{uploadText.length} caratteri</Text>
                )}
              </View>

              <Text style={[styles.createDietLabel, styles.createDietLabelPhotos]}>Scansiona con l'AI</Text>
              <Text style={styles.createDietHint}>
                Fotografa o scegli un'immagine del piano cartaceo: l'AI estrae il testo e lo inserisce qui sopra.
              </Text>
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={handleScanDiet}
                disabled={uploading || scanning}
              >
                {scanning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon name="scan-outline" size={24} color={colors.primary} />
                )}
                <Text style={styles.scanBtnText}>
                  {scanning ? 'Scansione in corso...' : 'Scatta o scegli foto'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.createDietFooter}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => { setUploadModal(false); setUploadText(''); }}
                disabled={uploading}
              >
                <Text style={styles.modalBtnCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnOk, !uploadText.trim() && styles.modalBtnDisabled]}
                onPress={handleUpload}
                disabled={uploading || !uploadText.trim()}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.modalBtnOkText}>Salva</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
