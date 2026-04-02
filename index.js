/**
 * @format
 */

import 'react-native-gesture-handler';
/** Deve precedere messaging così l'app Firebase default è registrata prima dei moduli che la usano. */
import '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    if (__DEV__) {
      console.log('[FCM] Background message', remoteMessage?.messageId);
    }
  });
} catch (e) {
  if (__DEV__) {
    console.warn('[FCM] setBackgroundMessageHandler non registrato', e);
  }
}

AppRegistry.registerComponent(appName, () => App);
