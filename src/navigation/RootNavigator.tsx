import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { TabNavigator } from './TabNavigator';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { token, isChecked } = useAuth();

  if (!isChecked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login">
          {({ navigation }) => (
            <LoginScreen onSwitchRegister={() => navigation.replace('Register')} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Register">
          {({ navigation }) => (
            <RegisterScreen onSwitchLogin={() => navigation.replace('Login')} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    );
  }

  return <TabNavigator />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgPrimary },
});
