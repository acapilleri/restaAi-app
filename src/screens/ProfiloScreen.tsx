import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getProfile, updateProfile } from '../api/profile';
import type { Profile } from '../api/profile';
import { colors } from '../theme/colors';
import { hapticLight } from '../utils/haptics';

const MENU_ITEMS = [
  { label: 'La mia dieta', bg: colors.greenPill, action: 'dieta' as const },
  { label: 'Dati personali', bg: '#EBF3FF', action: 'edit' as const },
  { label: 'Abbonamento Premium', bg: '#FFF3E0', action: 'premium' as const },
  { label: 'Storico pesate', bg: colors.bgSecondary, action: 'weights' as const },
];

export function ProfiloScreen() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    goal_weight_kg: '',
    height_cm: '',
    age: '',
    plan_type: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getProfile();
      setProfile(res.profile);
      setEditForm({
        name: res.profile.name ?? '',
        goal_weight_kg: res.profile.goal_weight_kg != null ? String(res.profile.goal_weight_kg) : '',
        height_cm: res.profile.height_cm != null ? String(res.profile.height_cm) : '',
        age: res.profile.age != null ? String(res.profile.age) : '',
        plan_type: res.profile.plan_type ?? '',
      });
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Caricamento fallito');
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

  const handleLogout = useCallback(() => {
    Alert.alert('Esci', 'Vuoi uscire dall\'account?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  const handleMenu = useCallback((action: string) => {
    if (action === 'edit') setEditModal(true);
    if (action === 'premium') Alert.alert('Premium', 'Funzionalità in arrivo.');
    if (action === 'weights') Alert.alert('Storico pesate', 'Apri la tab Today per il riepilogo peso.');
    if (action === 'dieta') Alert.alert('La mia dieta', 'Apri la tab Dieta per il piano.');
  }, []);

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    try {
      const payload: Parameters<typeof updateProfile>[0] = {
        name: editForm.name.trim() || undefined,
        goal_weight_kg: editForm.goal_weight_kg ? parseFloat(editForm.goal_weight_kg) : undefined,
        height_cm: editForm.height_cm ? parseInt(editForm.height_cm, 10) : undefined,
        age: editForm.age ? parseInt(editForm.age, 10) : undefined,
        plan_type: editForm.plan_type.trim() || undefined,
      };
      const res = await updateProfile(payload);
      setProfile(res.profile);
      setEditModal(false);
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Salvataggio fallito');
    } finally {
      setSaving(false);
    }
  }, [editForm]);

  const displayName = profile ? (profile.name || profile.email) : (user?.first_name ?? user?.email ?? '—');
  const initial = (displayName[0] || 'U').toUpperCase();

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
          <Text style={styles.title}>Profilo</Text>

          {loading && !profile ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{initial}</Text>
                </View>
                <View>
                  <Text style={styles.profileName}>{displayName}</Text>
                  <Text style={styles.profileSub}>
                    {profile?.email}
                    {profile?.premium ? ' · Premium' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.profileStatRow}>
                <View style={styles.profileStat}>
                  <Text style={[styles.psVal, styles.psValGreen]}>
                    {profile?.weight_lost != null ? `−${profile.weight_lost}` : '—'}
                  </Text>
                  <Text style={styles.psLbl}>kg persi</Text>
                </View>
                <View style={styles.profileStat}>
                  <Text style={styles.psVal}>{profile?.memories_count ?? '—'}</Text>
                  <Text style={styles.psLbl}>memorie</Text>
                </View>
                <View style={styles.profileStat}>
                  <Text style={styles.psVal}>{profile?.current_weight ?? '—'}</Text>
                  <Text style={styles.psLbl}>kg oggi</Text>
                </View>
              </View>
              <View style={styles.menuCard}>
                {MENU_ITEMS.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={styles.menuItem}
                    onPress={() => handleMenu(item.action)}
                  >
                    <View style={styles.menuLeft}>
                      <View style={[styles.menuIcon, { backgroundColor: item.bg }]} />
                      <Text style={styles.menuLabel}>{item.label}</Text>
                    </View>
                    <Text style={styles.menuChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {profile?.premium ? (
                <View style={styles.premiumBox}>
                  <Text style={styles.premiumLbl}>premium attivo</Text>
                  <Text style={styles.premiumTxt}>Prossimo rinnovo: vedi impostazioni abbonamento</Text>
                </View>
              ) : null}
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutBtnText}>Esci dall&apos;account</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={editModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dati personali</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nome"
              placeholderTextColor={colors.textMuted}
              value={editForm.name}
              onChangeText={(t) => setEditForm((f) => ({ ...f, name: t }))}
              editable={!saving}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Peso obiettivo (kg)"
              placeholderTextColor={colors.textMuted}
              value={editForm.goal_weight_kg}
              onChangeText={(t) => setEditForm((f) => ({ ...f, goal_weight_kg: t }))}
              keyboardType="decimal-pad"
              editable={!saving}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Altezza (cm)"
              placeholderTextColor={colors.textMuted}
              value={editForm.height_cm}
              onChangeText={(t) => setEditForm((f) => ({ ...f, height_cm: t }))}
              keyboardType="number-pad"
              editable={!saving}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Età"
              placeholderTextColor={colors.textMuted}
              value={editForm.age}
              onChangeText={(t) => setEditForm((f) => ({ ...f, age: t }))}
              keyboardType="number-pad"
              editable={!saving}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Tipo piano (es. perdere peso)"
              placeholderTextColor={colors.textMuted}
              value={editForm.plan_type}
              onChangeText={(t) => setEditForm((f) => ({ ...f, plan_type: t }))}
              editable={!saving}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setEditModal(false)}
                disabled={saving}
              >
                <Text style={styles.modalBtnCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnOk}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.modalBtnOkText}>Salva</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  scroll: { flex: 1 },
  pad: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },
  loadingBox: { padding: 24, alignItems: 'center' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { fontSize: 22, fontWeight: '600', color: colors.textOnPrimary },
  profileName: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  profileSub: { fontSize: 14, color: colors.textSecondary },
  profileStatRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  profileStat: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  psVal: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  psValGreen: { color: colors.primary },
  psLbl: { fontSize: 12, color: colors.textSecondary },
  menuCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 10 },
  menuLabel: { fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  menuChevron: { fontSize: 18, color: colors.textHint },
  premiumBox: {
    backgroundColor: colors.greenPill,
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  premiumLbl: { fontSize: 12, color: colors.primaryDarkLabel, fontWeight: '500', marginBottom: 4 },
  premiumTxt: { fontSize: 15, color: colors.primaryDark },
  logoutBtn: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  logoutBtnText: { fontSize: 15, color: colors.amber, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
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
  modalBtnOkText: { fontSize: 15, fontWeight: '600', color: colors.textOnPrimary },
});
