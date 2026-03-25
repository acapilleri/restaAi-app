import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const defaultOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

/**
 * Trigger light impact (tap, button press).
 */
export function hapticLight() {
  ReactNativeHapticFeedback.trigger('impactLight', defaultOptions);
}

/**
 * Trigger medium impact (selection change, toggle).
 */
export function hapticMedium() {
  ReactNativeHapticFeedback.trigger('impactMedium', defaultOptions);
}

/**
 * Trigger heavy impact (success, important action).
 */
export function hapticHeavy() {
  ReactNativeHapticFeedback.trigger('impactHeavy', defaultOptions);
}

/**
 * Trigger selection feedback (picker, list item).
 */
export function hapticSelection() {
  ReactNativeHapticFeedback.trigger('selection', defaultOptions);
}

/**
 * Notification: success.
 */
export function hapticSuccess() {
  ReactNativeHapticFeedback.trigger('notificationSuccess', defaultOptions);
}

/**
 * Notification: warning.
 */
export function hapticWarning() {
  ReactNativeHapticFeedback.trigger('notificationWarning', defaultOptions);
}

/**
 * Notification: error.
 */
export function hapticError() {
  ReactNativeHapticFeedback.trigger('notificationError', defaultOptions);
}
