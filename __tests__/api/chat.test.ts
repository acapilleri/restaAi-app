import { sendMessage } from '../../src/api/chat';

const mockPost = jest.fn();

jest.mock('../../src/api/client', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: jest.fn(),
  },
}));

describe('chat api adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends chat message as trigger-only request', async () => {
    mockPost.mockResolvedValue({
      data: { text: 'ignored' },
    });

    await expect(sendMessage('101 kg')).resolves.toBeUndefined();
    expect(mockPost).toHaveBeenCalledWith('/chat', {
      message: '101 kg',
    });
  });

  it('includes health_data when provided', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const health_data = {
      steps_today: 5000,
      active_energy_kcal_today: 320,
      last_weight_kg: 72.5,
      last_weight_date: '2026-03-28T10:00:00.000Z',
      heart_rate_bpm: 72,
      resting_heart_rate_bpm: 58,
      hrv_sdnn_ms: 45,
      body_fat_percent: 18,
      lean_body_mass_kg: 59,
      bmi: 22.1,
      oxygen_saturation_percent: 98,
      sleep_asleep_hours_recent: 7.2,
      distance_walking_running_km_today: 4.2,
      flights_climbed_today: 8,
      basal_energy_kcal_today: 1400,
      dietary_energy_kcal_today: 1800,
    };

    await expect(sendMessage('ciao', { health_data })).resolves.toBeUndefined();
    expect(mockPost).toHaveBeenCalledWith('/chat', {
      message: 'ciao',
      health_data,
    });
  });
});
