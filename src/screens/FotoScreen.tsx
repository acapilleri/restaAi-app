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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { DrawerMenuButton } from '../components/navigation/DrawerMenuButton';
import { getPhotos, uploadPhoto, deletePhoto } from '../api/photos';
import type { PhotosResponse } from '../api/photos';

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

export function FotoScreen() {
  const { colors } = useTheme();
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
        photoGrid: { flexDirection: 'row', gap: 12, marginBottom: 14 },
        photoCard: { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
        photoCardActive: { borderWidth: 2, borderColor: colors.primary },
        photoImg: { height: 120, width: '100%', backgroundColor: colors.bgSecondary },
        photoMeta: { padding: 10, paddingHorizontal: 12, backgroundColor: colors.bgSecondary },
        photoMetaActive: { backgroundColor: colors.greenPill },
        photoDate: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
        photoKg: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
        photoDateActive: { fontSize: 12, color: colors.primaryDarkLabel },
        photoKgActive: { fontSize: 15, color: colors.primaryDark, fontWeight: '500' },
        aiComment: {
          backgroundColor: colors.greenPill,
          borderRadius: 14,
          padding: 14,
          paddingHorizontal: 16,
          marginBottom: 14,
        },
        aiCommentLbl: { fontSize: 12, color: colors.primaryDarkLabel, fontWeight: '500', marginBottom: 6 },
        aiCommentTxt: { fontSize: 15, color: colors.primaryDark, lineHeight: 22 },
        progressCard: {
          backgroundColor: colors.bgCard,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          padding: 14,
          paddingHorizontal: 16,
          marginBottom: 14,
        },
        progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
        progressLbl: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
        progressPct: { fontSize: 13, color: colors.primary, fontWeight: '500' },
        miniStats: { flexDirection: 'row', gap: 10, marginBottom: 14 },
        miniStat: { flex: 1, backgroundColor: colors.bgSecondary, borderRadius: 12, padding: 12, alignItems: 'center' },
        miniVal: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
        miniLbl: { fontSize: 12, color: colors.textSecondary },
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
        listRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          gap: 12,
        },
        listThumb: { width: 56, height: 56, borderRadius: 8 },
        listMeta: { flex: 1 },
        listDate: { fontSize: 14, color: colors.textPrimary },
        listKg: { fontSize: 13, color: colors.textSecondary },
        listDeleteHint: { fontSize: 11, color: colors.textMuted },
      }),
    [colors],
  );

  const [data, setData] = useState<PhotosResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getPhotos();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento foto');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    hapticLight();
    setRefreshing(true);
    load();
  }, [load]);

  const handleAddPhoto = useCallback(() => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8 },
      async (res) => {
        if (res.didCancel || !res.assets?.[0]) return;
        const asset = res.assets[0];
        const uri = asset.uri ?? asset.android?.uri;
        if (!uri) return;
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append('photo', {
            uri,
            type: asset.type ?? 'image/jpeg',
            name: asset.fileName ?? 'photo.jpg',
          } as unknown as Blob);
          formData.append('taken_on', new Date().toISOString().split('T')[0]);
          await uploadPhoto(formData);
          await load();
        } catch (e) {
          Alert.alert('Errore', e instanceof Error ? e.message : 'Upload fallito');
        } finally {
          setUploading(false);
        }
      },
    );
  }, [load]);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert('Elimina foto', 'Vuoi eliminare questa foto?', [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePhoto(id);
              await load();
            } catch (e) {
              Alert.alert('Errore', e instanceof Error ? e.message : 'Eliminazione fallita');
            }
          },
        },
      ]);
    },
    [load],
  );

  const comparison = data?.comparison;
  const photos = data?.photos ?? [];
  const progress = data?.photos?.length
    ? Math.round(
        (photos.filter((p) => p.weight_at_photo != null).length / photos.length) * 100,
      )
    : 0;

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
            <Text style={[styles.title, styles.titleWithMenu]}>Progresso foto</Text>
            <Text style={styles.months}>{photos.length} foto</Text>
            <DrawerMenuButton placement="trailing" />
          </View>

          {loading && !data ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error && !data ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : comparison?.first && comparison?.latest ? (
            <View style={styles.photoGrid}>
              <View style={styles.photoCard}>
                <Image
                  source={{ uri: comparison.first.url }}
                  style={styles.photoImg}
                  resizeMode="cover"
                />
                <View style={styles.photoMeta}>
                  <Text style={styles.photoDate}>{formatDate(comparison.first.taken_on)}</Text>
                  <Text style={styles.photoKg}>
                    {comparison.first.weight_at_photo != null
                      ? `${comparison.first.weight_at_photo} kg`
                      : '—'}
                  </Text>
                </View>
              </View>
              <View style={[styles.photoCard, styles.photoCardActive]}>
                <Image
                  source={{ uri: comparison.latest.url }}
                  style={styles.photoImg}
                  resizeMode="cover"
                />
                <View style={[styles.photoMeta, styles.photoMetaActive]}>
                  <Text style={styles.photoDateActive}>{formatDate(comparison.latest.taken_on)}</Text>
                  <Text style={styles.photoKgActive}>
                    {comparison.latest.weight_at_photo != null
                      ? `${comparison.latest.weight_at_photo} kg`
                      : '—'}
                  </Text>
                </View>
              </View>
            </View>
          ) : photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.slice(0, 2).map((p) => (
                <View key={p.id} style={styles.photoCard}>
                  <Image source={{ uri: p.url }} style={styles.photoImg} resizeMode="cover" />
                  <View style={styles.photoMeta}>
                    <Text style={styles.photoDate}>{formatDate(p.taken_on)}</Text>
                    <Text style={styles.photoKg}>
                      {p.weight_at_photo != null ? `${p.weight_at_photo} kg` : '—'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {comparison?.analysis ? (
            <View style={styles.aiComment}>
              <Text style={styles.aiCommentLbl}>analisi AI del progresso</Text>
              <Text style={styles.aiCommentTxt}>{comparison.analysis}</Text>
            </View>
          ) : null}

          {data && (comparison?.first || comparison?.latest) ? (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLbl}>percorso verso obiettivo</Text>
                <Text style={styles.progressPct}>{progress}%</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.miniStats}>
            <View style={styles.miniStat}>
              <Text style={styles.miniVal}>{photos.length}</Text>
              <Text style={styles.miniLbl}>foto totali</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={handleAddPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.uploadBtnText}>aggiungi foto oggi</Text>
            )}
          </TouchableOpacity>

          {photos.length > 0 ? (
            <View style={styles.listSection}>
              <Text style={styles.listSectionTitle}>Tutte le foto</Text>
              {photos.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.listRow}
                  onLongPress={() => handleDelete(p.id)}
                >
                  <Image source={{ uri: p.url }} style={styles.listThumb} resizeMode="cover" />
                  <View style={styles.listMeta}>
                    <Text style={styles.listDate}>{formatDate(p.taken_on)}</Text>
                    <Text style={styles.listKg}>
                      {p.weight_at_photo != null ? `${p.weight_at_photo} kg` : '—'}
                    </Text>
                  </View>
                  <Text style={styles.listDeleteHint}>Tieni premuto per eliminare</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
