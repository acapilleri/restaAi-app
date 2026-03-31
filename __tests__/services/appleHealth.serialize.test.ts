import {
  compactAppleHealthPayload,
  serializeAppleHealthSnapshot,
  type AppleHealthSnapshot,
} from '../../src/services/appleHealth';

describe('serializeAppleHealthSnapshot', () => {
  it('maps fields to snake_case JSON and ISO date', () => {
    const at = new Date('2026-03-15T14:30:00.000Z');
    const snap: AppleHealthSnapshot = {
      stepsToday: 8421,
      activeEnergyKcalToday: 410,
      lastWeightKg: 70.2,
      lastWeightDate: at,
      heartRateBpm: 75,
      restingHeartRateBpm: 55,
      hrvSdnnMs: 42,
      bodyFatPercent: 20,
      leanBodyMassKg: 56,
      bmi: 21.5,
      oxygenSaturationPercent: 97,
      sleepAsleepHoursRecent: 6.5,
      distanceWalkingRunningKmToday: 5.1,
      flightsClimbedToday: 12,
      basalEnergyKcalToday: 1350,
      dietaryEnergyKcalToday: 1900,
    };

    const full = serializeAppleHealthSnapshot(snap);
    expect(full).toEqual({
      steps_today: 8421,
      active_energy_kcal_today: 410,
      last_weight_kg: 70.2,
      last_weight_date: '2026-03-15T14:30:00.000Z',
      heart_rate_bpm: 75,
      resting_heart_rate_bpm: 55,
      hrv_sdnn_ms: 42,
      body_fat_percent: 20,
      lean_body_mass_kg: 56,
      bmi: 21.5,
      oxygen_saturation_percent: 97,
      sleep_asleep_hours_recent: 6.5,
      distance_walking_running_km_today: 5.1,
      flights_climbed_today: 12,
      basal_energy_kcal_today: 1350,
      dietary_energy_kcal_today: 1900,
    });
    expect(compactAppleHealthPayload(full)).toEqual(full);
  });
});

describe('compactAppleHealthPayload', () => {
  it('returns empty object when all values are null', () => {
    const snap: AppleHealthSnapshot = {
      stepsToday: null,
      activeEnergyKcalToday: null,
      lastWeightKg: null,
      lastWeightDate: null,
      heartRateBpm: null,
      restingHeartRateBpm: null,
      hrvSdnnMs: null,
      bodyFatPercent: null,
      leanBodyMassKg: null,
      bmi: null,
      oxygenSaturationPercent: null,
      sleepAsleepHoursRecent: null,
      distanceWalkingRunningKmToday: null,
      flightsClimbedToday: null,
      basalEnergyKcalToday: null,
      dietaryEnergyKcalToday: null,
    };

    expect(compactAppleHealthPayload(serializeAppleHealthSnapshot(snap))).toEqual({});
  });

  it('keeps only keys with defined values', () => {
    const snap: AppleHealthSnapshot = {
      stepsToday: 100,
      activeEnergyKcalToday: null,
      lastWeightKg: 68,
      lastWeightDate: null,
      heartRateBpm: null,
      restingHeartRateBpm: null,
      hrvSdnnMs: null,
      bodyFatPercent: null,
      leanBodyMassKg: null,
      bmi: null,
      oxygenSaturationPercent: null,
      sleepAsleepHoursRecent: null,
      distanceWalkingRunningKmToday: null,
      flightsClimbedToday: null,
      basalEnergyKcalToday: null,
      dietaryEnergyKcalToday: null,
    };

    expect(compactAppleHealthPayload(serializeAppleHealthSnapshot(snap))).toEqual({
      steps_today: 100,
      last_weight_kg: 68,
    });
  });

  it('drops NaN numbers', () => {
    const emptySnap: AppleHealthSnapshot = {
      stepsToday: null,
      activeEnergyKcalToday: null,
      lastWeightKg: null,
      lastWeightDate: null,
      heartRateBpm: null,
      restingHeartRateBpm: null,
      hrvSdnnMs: null,
      bodyFatPercent: null,
      leanBodyMassKg: null,
      bmi: null,
      oxygenSaturationPercent: null,
      sleepAsleepHoursRecent: null,
      distanceWalkingRunningKmToday: null,
      flightsClimbedToday: null,
      basalEnergyKcalToday: null,
      dietaryEnergyKcalToday: null,
    };
    const payload = serializeAppleHealthSnapshot(emptySnap);
    payload.bmi = NaN;
    expect(compactAppleHealthPayload(payload)).toEqual({});
  });

  it('preserves numeric zero', () => {
    const snap: AppleHealthSnapshot = {
      stepsToday: 0,
      activeEnergyKcalToday: null,
      lastWeightKg: null,
      lastWeightDate: null,
      heartRateBpm: null,
      restingHeartRateBpm: null,
      hrvSdnnMs: null,
      bodyFatPercent: null,
      leanBodyMassKg: null,
      bmi: null,
      oxygenSaturationPercent: null,
      sleepAsleepHoursRecent: null,
      distanceWalkingRunningKmToday: null,
      flightsClimbedToday: null,
      basalEnergyKcalToday: null,
      dietaryEnergyKcalToday: null,
    };

    expect(compactAppleHealthPayload(serializeAppleHealthSnapshot(snap))).toEqual({ steps_today: 0 });
  });
});
