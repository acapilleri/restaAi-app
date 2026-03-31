import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { OnboardingChatScreen } from '../screens/OnboardingChatScreen';
import { MainDrawerNavigator } from './MainDrawerNavigator';
import { ActivityIndicator, View } from 'react-native';
import type { AppStackParamList, AuthStackParamList } from './rootTypes';
import { getOnboardingCompleted, setOnboardingCompleted } from '../onboarding/onboardingStorage';
import { resolveOnboardingUserKey } from '../onboarding/onboardingUserKey';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgPrimary }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function AuthenticatedNavigator() {
  const { user, token } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setOnboardingDone(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const key = await resolveOnboardingUserKey(user);
        let done = await getOnboardingCompleted(key);
        if (!done) {
          try {
            const { getProfile } = await import('../api/profile');
            const res = await getProfile();
            const p = res.profile;
            if (p?.age != null && p?.height_cm != null && p?.goal_weight_kg != null) {
              await setOnboardingCompleted(key);
              done = true;
            }
          } catch {
            // ignore
          }
        }
        if (!cancelled) setOnboardingDone(done);
      } catch {
        if (!cancelled) setOnboardingDone(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user?.id, user?.email]);

  if (onboardingDone === null) {
    return <LoadingScreen />;
  }

  return (
    <AppStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={onboardingDone ? 'Main' : 'OnboardingChat'}
    >
      <AppStack.Screen name="OnboardingChat" component={OnboardingChatScreen} />
      <AppStack.Screen name="Main" component={MainDrawerNavigator} />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const { token, isChecked } = useAuth();

  if (!isChecked) {
    return <LoadingScreen />;
  }

  if (!token) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login">
          {({ navigation }) => (
            <LoginScreen onSwitchRegister={() => navigation.replace('Register')} />
          )}
        </AuthStack.Screen>
        <AuthStack.Screen name="Register">
          {({ navigation }) => (
            <RegisterScreen onSwitchLogin={() => navigation.replace('Login')} />
          )}
        </AuthStack.Screen>
      </AuthStack.Navigator>
    );
  }

  return <AuthenticatedNavigator />;
}
