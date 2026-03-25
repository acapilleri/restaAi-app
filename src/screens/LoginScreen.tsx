import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Props = { onSwitchRegister: () => void };

export function LoginScreen({ onSwitchRegister }: Props) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const behavior = useMemo(() => Platform.OS === 'ios' ? 'padding' : undefined, []);
 
  const handleSubmit = async () => {
    const e = email.trim();
    const p = password;
    if (!e || !p) {
      Alert.alert('Attenzione', 'Inserisci email e password.');
      return;
    }
    try {
      await login(e, p);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Accesso fallito. Riprova.';
      Alert.alert('Errore', message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={behavior}
        keyboardVerticalOffset={20}
      >
        <View style={styles.card}>
          <Text style={styles.title}>DietaAI</Text>
          <Text style={styles.subtitle}>Accedi al tuo account</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}

            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, isLoading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.btnPrimaryText}>Accedi</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.switchBtn} onPress={onSwitchRegister} disabled={isLoading}>
            <Text style={styles.switchText}>Non hai un account? Registrati</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  keyboard: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  card: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnPrimary: { backgroundColor: colors.primary },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { fontSize: 16, fontWeight: '600', color: colors.textOnPrimary },
  switchBtn: { marginTop: 16, alignItems: 'center' },
  switchText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
});
