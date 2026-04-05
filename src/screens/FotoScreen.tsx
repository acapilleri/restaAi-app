import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
// eslint-disable-next-line @react-native/no-deep-imports
import Alert from 'react-native/Libraries/Alert/Alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { DrawerMenuButtonWithBadge as DrawerMenuButton } from '../components/navigation/DrawerMenuButtonWithBadge';
import { getBodyAnalyses, uploadAndAnalyze } from '../api/bodyAnalysis';
import type { BodyAnalysis } from '../api/bodyAnalysis';
import type { FotoStackParamList } from '../navigation/types';
import { formatBodyCheckDateTime } from '../utils/formatBodyCheckDateTime';

function formatDate(s: string) {
  return formatBodyCheckDateTime(s, { month: 'short' });
}

const PHOTO_PICKER_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 0.8,
  selectionLimit: 1,
};

export function FotoScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<FotoStackParamList, 'FotoMain'>>();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bgPrimary },
        scroll: { flex: 1 },
        pad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
        topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
        title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
        titleWithMenu: { flex: 1, marginRight: 8 },
        months: { fontSize: 15, color: colors.primary, fontWeight: '500' },
        loadingBox: { padding: 24, alignItems: 'center' },
        errorText: { fontSize: 14, color: colors.amber, marginBottom: 14 },
        emptyCard: {
          backgroundColor: colors.bgCard,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 14,
        },
        emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
        emptyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
        latestCard: {
          backgroundColor: colors.bgCard,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          marginBottom: 14,
        },
        latestImage: { width: '100%', height: 220, backgroundColor: colors.bgSecondary },
        latestBody: { padding: 14 },
        latestDate: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginBottom: 6 },
        latestTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
        latestHint: { fontSize: 13, color: colors.textSecondary },
        aiComment: {
          backgroundColor: colors.greenPill,
          borderRadius: 14,
          padding: 14,
          paddingHorizontal: 16,
          marginBottom: 14,
        },
        aiCommentLbl: { fontSize: 12, color: colors.primaryDarkLabel, fontWeight: '500', marginBottom: 6 },
        aiCommentTxt: { fontSize: 15, color: colors.primaryDark, lineHeight: 22 },
        uploadBtn: {
          backgroundColor: colors.primary,
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          marginBottom: 20,
        },
        uploadBtnText: { fontSize: 16, fontWeight: '600', color: colors.textOnPrimary },
        listSection: { marginTop: 8 },
        listSectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 10 },
        historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
        historyCard: {
          width: '48%',
          borderRadius: 14,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgCard,
        },
        historyImage: { width: '100%', height: 150, backgroundColor: colors.bgSecondary },
        historyBody: { padding: 10 },
        historyDate: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
        historyHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
      }),
    [colors],
  );

  const [analyses, setAnalyses] = useState<BodyAnalysis[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getBodyAnalyses();
      setAnalyses(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento analisi corpo');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    hapticLight();
    setRefreshing(true);
    load();
  }, [load]);

  const openDetail = useCallback(
    (analysis: BodyAnalysis) => {
      navigation.navigate('FotoDetail', { analysis });
    },
    [navigation],
  );

  const handleAddPhoto = useCallback(() => {
    const processPickerResponse = async (res: {
      errorCode?: string;
      didCancel?: boolean;
      assets?: Array<{
        uri?: string;
        fileName?: string | null;
        type?: string | null;
        android?: { uri?: string };
      }>;
    }) => {
      if (res.errorCode) {
        Alert.alert('Errore', 'Impossibile usare la foto scelta. Controlla i permessi e riprova.');
        return;
      }
      if (res.didCancel || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const uri = asset.uri ?? asset.android?.uri;
      if (!uri) return;
      setUploading(true);
      try {
        await uploadAndAnalyze({
          uri,
          type: asset.type,
          fileName: asset.fileName,
        });
        await load();
        Alert.alert('Analisi completata', 'Lettura salvata.');
      } catch (e) {
        Alert.alert('Errore', e instanceof Error ? e.message : 'Upload o analisi fallita. Riprova.');
      } finally {
        setUploading(false);
      }
    };

    const openCamera = () => {
      launchCamera(PHOTO_PICKER_OPTIONS, async (res) => {
        if (res.errorCode) {
          if (res.errorCode === 'camera_unavailable') {
            launchImageLibrary(PHOTO_PICKER_OPTIONS, (fallbackRes) => {
              processPickerResponse(fallbackRes).catch(() => {});
            });
            return;
          }
          if (res.errorCode === 'permission') {
            Alert.alert('Errore', 'Permesso fotocamera negato. Controlla i permessi e riprova.');
            return;
          }
          Alert.alert('Errore', 'Impossibile aprire la fotocamera. Controlla i permessi e riprova.');
          return;
        }
        await processPickerResponse(res);
      });
    };

    const openLibrary = () => {
      launchImageLibrary(PHOTO_PICKER_OPTIONS, async (res) => {
        if (res.errorCode) {
          if (res.errorCode === 'permission') {
            Alert.alert('Errore', 'Permesso galleria negato. Controlla i permessi e riprova.');
            return;
          }
          Alert.alert('Errore', 'Impossibile aprire la galleria. Controlla i permessi e riprova.');
          return;
        }
        await processPickerResponse(res);
      });
    };

    Alert.alert('Nuovo Body Check', 'Scatta una foto o scegline una dalla galleria.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Galleria', onPress: openLibrary },
      { text: 'Fotocamera', onPress: openCamera },
    ]);
  }, [load]);

  const latestAnalysis = analyses[0] ?? null;
  const latestSummary = latestAnalysis?.ai_summary || latestAnalysis?.readings.notes || '';

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
            <Text style={[styles.title, styles.titleWithMenu]}>Body Check</Text>
            <Text style={styles.months}>{analyses.length} body check</Text>
            <DrawerMenuButton placement="trailing" />
          </View>

          {loading && analyses.length === 0 ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error && analyses.length === 0 ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : latestAnalysis ? (
            <TouchableOpacity
              style={styles.latestCard}
              onPress={() => openDetail(latestAnalysis)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: latestAnalysis.photo_url }}
                style={styles.latestImage}
                resizeMode="cover"
              />
              <View style={styles.latestBody}>
                <Text style={styles.latestDate}>{formatDate(latestAnalysis.taken_on)}</Text>
                <Text style={styles.latestTitle}>Ultimo Body Check</Text>
                <Text style={styles.latestHint}>Tocca per vedere il dettaglio completo.</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nessun Body Check disponibile</Text>
              <Text style={styles.emptyText}>
                Fai un Body Check per salvare lo storico e leggere l'analisi nella schermata di dettaglio.
              </Text>
            </View>
          )}

          {latestSummary ? (
            <View style={styles.aiComment}>
              <Text style={styles.aiCommentLbl}>riassunto più recente</Text>
              <Text style={styles.aiCommentTxt}>{latestSummary}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handleAddPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.uploadBtnText}>nuovo Body Check</Text>
            )}
          </TouchableOpacity>

          {analyses.length > 0 ? (
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>Storico Body Check</Text>
              <View style={styles.historyGrid}>
                {analyses.map((analysis) => (
                  <TouchableOpacity
                    key={analysis.id}
                    style={styles.historyCard}
                    onPress={() => openDetail(analysis)}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: analysis.photo_url }}
                      style={styles.historyImage}
                      resizeMode="cover"
                    />
                    <View style={styles.historyBody}>
                      <Text style={styles.historyDate}>{formatDate(analysis.taken_on)}</Text>
                      <Text style={styles.historyHint}>Apri analisi</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
