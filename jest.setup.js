/**
 * Jest setup for React Native
 * Mock native modules and third-party libs that break in Node.
 */

// react-native-gesture-handler (TurboModule)
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return { GestureHandlerRootView: View };
});

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// react-native-vector-icons: replace with a simple component
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// react-native-haptic-feedback (TurboModule)
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn() },
}));

// react-native-safe-area-context (provide a minimal context for @react-navigation)
const mockSafeAreaContext = {
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  insetTop: 0,
  insetBottom: 0,
  insetLeft: 0,
  insetRight: 0,
};
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const ctx = React.createContext(mockSafeAreaContext);
  return {
    SafeAreaProvider: ({ children }) => React.createElement(ctx.Provider, { value: mockSafeAreaContext }, children),
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});


// Avoid Alert.alert in tests
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// react-native-image-picker (ESM)
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

// Apple HealthKit (Nitro / iOS only — stub in Jest)
jest.mock('@kingstinct/react-native-healthkit', () => {
  const AuthorizationRequestStatus = { unknown: 0, shouldRequest: 1, unnecessary: 2 };
  const CategoryValueSleepAnalysis = {
    inBed: 0,
    asleepUnspecified: 1,
    awake: 2,
    asleepCore: 3,
    asleepDeep: 4,
    asleepREM: 5,
  };
  return {
    AuthorizationRequestStatus,
    CategoryValueSleepAnalysis,
    isHealthDataAvailableAsync: jest.fn(() => Promise.resolve(false)),
    isHealthDataAvailable: jest.fn(() => false),
    requestAuthorization: jest.fn(() => Promise.resolve(false)),
    getRequestStatusForAuthorization: jest.fn(() => Promise.resolve(AuthorizationRequestStatus.unnecessary)),
    getPreferredUnits: jest.fn(() => Promise.resolve([])),
    queryStatisticsForQuantity: jest.fn(() =>
      Promise.resolve({ sumQuantity: { quantity: 0, unit: 'count' }, sources: [] }),
    ),
    queryQuantitySamples: jest.fn(() => Promise.resolve([])),
    queryCategorySamples: jest.fn(() => Promise.resolve([])),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Theme: avoid requiring ThemeProvider in every test; default to light palette.
jest.mock('./src/context/ThemeContext', () => {
  const React = require('react');
  const { lightColors } = require('./src/theme/colors');
  const value = {
    colors: lightColors,
    preference: 'system',
    setPreference: jest.fn(() => Promise.resolve()),
    resolvedScheme: 'light',
    isDark: false,
  };
  return {
    ThemeProvider: ({ children }) => children,
    useTheme: () => value,
  };
});
