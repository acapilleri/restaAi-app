import { isHealthDataFresh } from '../../src/utils/healthDataFreshness';

describe('isHealthDataFresh', () => {
  const now = new Date('2026-04-02T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns true when recorded_at is within 8 hours', () => {
    expect(
      isHealthDataFresh({
        recorded_at: new Date(now.getTime() - 7 * 60 * 60 * 1000).toISOString(),
      }),
    ).toBe(true);
  });

  it('returns false when recorded_at is older than 8 hours', () => {
    expect(
      isHealthDataFresh({
        recorded_at: new Date(now.getTime() - 9 * 60 * 60 * 1000).toISOString(),
      }),
    ).toBe(false);
  });

  it('returns false when no usable timestamp', () => {
    expect(isHealthDataFresh(undefined)).toBe(false);
    expect(isHealthDataFresh({})).toBe(false);
    expect(isHealthDataFresh({ steps_today: 100 })).toBe(false);
  });
});
