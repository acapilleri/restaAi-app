import { collectRawBundle, type RawSensorBundle } from './SensorBundleService';

export async function collectSensors(): Promise<RawSensorBundle> {
  return collectRawBundle();
}

export type { RawSensorBundle } from './SensorBundleService';
