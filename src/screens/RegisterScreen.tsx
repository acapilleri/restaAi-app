import React, { useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

type Props = { onSwitchLogin: () => void };

export function RegisterScreen({ onSwitchLogin }: Props) {
  const { register, isLoading } = useAuth();
  const [first_name, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password_confirmation, setPasswordConfirmation] = useState('');

  const handleSubmit = async () => {
    const name = first_name.trim();
    const e = email.trim();
    if (!name || !e || !password || !password_confirmation) {
      Alert.alert('Attenzione', 'Compila tutti i campi.');
      return;
    }
    if (password !== password_confirmation) {
      Alert.alert('Attenzione', 'Le password non coincidono.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Attenzione', 'La password deve avere almeno 6 caratteri.');
      return;
    }
    try {
      await register({ first_name: name, email: e, password, password_confirmation });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registrazione fallita. Riprova.';
      Alert.alert('Errore', message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={20}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Registrati</Text>
            <Text style={styles.subtitle}>Crea il tuo account DietaAI</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome"
              placeholderTextColor={colors.textMuted}
              value={first_name}
              onChangeText={setFirstName}
              autoCapitalize="words"
              editable={!isLoading}
            />
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
            <TextInput
              style={styles.input}
              placeholder="Conferma password"
              placeholderTextColor={colors.textMuted}
              value={password_confirmation}
              onChangeText={setPasswordConfirmation}
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
                <Text style={styles.btnPrimaryText}>Registrati</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.switchBtn} onPress={onSwitchLogin} disabled={isLoading}>
              <Text style={styles.switchText}>Hai già un account? Accedi</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  keyboard: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
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
