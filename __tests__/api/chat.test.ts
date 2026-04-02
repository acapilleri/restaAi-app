import { getChatHistory, sendMessage, setMessageReaction } from '../../src/api/chat';

const mockPost = jest.fn();
const mockGet = jest.fn();

jest.mock('../../src/api/client', () => ({
  __esModule: true,
  default: {
    post: (...args: unknown[]) => mockPost(...args),
    get: (...args: unknown[]) => mockGet(...args),
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

  it('includes location_context when provided', async () => {
    mockPost.mockResolvedValue({ data: {} });
    const location_context = {
      latitude: 37.5,
      longitude: 15.08,
      captured_at: '2026-04-01T12:00:00.000Z',
    };
    await expect(sendMessage('Sono in piazza Duomo', { location_context })).resolves.toBeUndefined();
    expect(mockPost).toHaveBeenCalledWith('/chat', {
      message: 'Sono in piazza Duomo',
      location_context,
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

  it('normalizes quick_chips from chat history payload', async () => {
    mockGet.mockResolvedValue({
      data: {
        messages: [],
        page: {
          limit: 10,
          has_more: false,
          next_before_id: null,
        },
        quick_chips: [
          'Registra peso',
          { label: 'Aggiungi dieta', action: { type: 'navigate', route: 'Dieta' } },
          { label: 'Alternative pranzo', action: { type: 'message', text: 'Alternative pranzo' } },
          { label: 'Registra peso' },
        ],
      },
    });

    await expect(getChatHistory({ limit: 10 })).resolves.toEqual({
      messages: [],
      page: {
        limit: 10,
        has_more: false,
        next_before_id: null,
      },
      quick_chips: [
        { label: 'Registra peso', action: { type: 'message', text: 'Registra peso' } },
        { label: 'Aggiungi dieta', action: { type: 'navigate', route: 'Dieta' } },
        { label: 'Alternative pranzo', action: { type: 'message', text: 'Alternative pranzo' } },
        { label: 'Registra peso', action: { type: 'message', text: 'Registra peso' } },
      ],
    });
    expect(mockGet).toHaveBeenCalledWith('/chat/history', { params: { limit: 10 } });
  });

  it('keeps quick_chips undefined when backend omits field', async () => {
    mockGet.mockResolvedValue({
      data: {
        messages: [],
        page: {
          limit: 10,
          has_more: false,
          next_before_id: null,
        },
      },
    });

    await expect(getChatHistory({ limit: 10 })).resolves.toEqual({
      messages: [],
      page: {
        limit: 10,
        has_more: false,
        next_before_id: null,
      },
    });
  });

  it('passes before_id in GET /chat/history params for pagination', async () => {
    mockGet.mockResolvedValue({
      data: {
        messages: [],
        page: {
          limit: 10,
          has_more: true,
          next_before_id: 'older-cursor',
        },
      },
    });

    await expect(getChatHistory({ limit: 10, before_id: 'id-123' })).resolves.toEqual({
      messages: [],
      page: {
        limit: 10,
        has_more: true,
        next_before_id: 'older-cursor',
      },
    });
    expect(mockGet).toHaveBeenCalledWith('/chat/history', {
      params: { limit: 10, before_id: 'id-123' },
    });
  });

  it('posts reaction with message_id', async () => {
    mockPost.mockResolvedValue({
      data: { ok: true, message_id: '42', reaction: 'like' as const },
    });

    await expect(
      setMessageReaction({ message_id: '42', reaction: 'like' }),
    ).resolves.toEqual({ ok: true, message_id: '42', reaction: 'like' });

    expect(mockPost).toHaveBeenCalledWith('/chat/reaction', {
      reaction: 'like',
      message_id: '42',
    });
  });

  it('posts reaction with request_id when message id is not yet persisted', async () => {
    mockPost.mockResolvedValue({
      data: { ok: true, message_id: '99', reaction: 'like' as const },
    });

    await expect(
      setMessageReaction({ request_id: 'req-stream-1', reaction: 'like' }),
    ).resolves.toEqual({ ok: true, message_id: '99', reaction: 'like' });

    expect(mockPost).toHaveBeenCalledWith('/chat/reaction', {
      reaction: 'like',
      request_id: 'req-stream-1',
    });
  });

  it('includes conversation_id in reaction body when provided', async () => {
    mockPost.mockResolvedValue({ data: { ok: true, reaction: null } });

    await setMessageReaction({
      message_id: '1',
      reaction: null,
      conversation_id: 'global',
    });

    expect(mockPost).toHaveBeenCalledWith('/chat/reaction', {
      reaction: null,
      message_id: '1',
      conversation_id: 'global',
    });
  });
});
