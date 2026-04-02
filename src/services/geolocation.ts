import { Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, check, openSettings, request, RESULTS } from 'react-native-permissions';

function locationPermission() {
  return Platform.OS === 'ios' ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
}

export async function ensureLocationPermission(): Promise<boolean> {
  const perm = locationPermission();
  const status = await check(perm);
  if (status === RESULTS.GRANTED || status === RESULTS.LIMITED) {
    return true;
  }
  if (status === RESULTS.UNAVAILABLE) {
    return false;
  }
  const next = await request(perm);
  return next === RESULTS.GRANTED || next === RESULTS.LIMITED;
}

export async function getLocationPermissionStatus() {
  const status = await check(locationPermission());
  return status;
}

export async function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      reject,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        forceRequestLocation: true,
        showLocationDialog: true,
      },
    );
  });
}

export { openSettings };
