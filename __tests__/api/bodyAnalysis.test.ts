import {
  compareBodyAnalyses,
  createBodyAnalysis,
  deleteBodyAnalysis,
  getBodyAnalyses,
  getPresignedUrl,
  normalizeBodyAnalysis,
  uploadAndAnalyze,
  uploadToR2,
} from '../../src/api/bodyAnalysis';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock('../../src/api/client', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe('bodyAnalysis api adapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('requests a presigned url with filename and content type', async () => {
    mockGet.mockResolvedValue({
      data: {
        upload_url: 'https://upload.example.test',
        public_url: 'https://cdn.example.test/body/1/photo.jpg',
        key: 'body_analyses/1/photo.jpg',
      },
    });

    await expect(getPresignedUrl('photo.jpg', 'image/jpeg')).resolves.toEqual({
      upload_url: 'https://upload.example.test',
      public_url: 'https://cdn.example.test/body/1/photo.jpg',
      key: 'body_analyses/1/photo.jpg',
    });

    expect(mockGet).toHaveBeenCalledWith('/body_analyses/presign', {
      params: { filename: 'photo.jpg', content_type: 'image/jpeg' },
    });
  });

  it('uploads a local file to R2 with PUT', async () => {
    const blob = { mock: 'blob' };
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        blob: jest.fn(() => Promise.resolve(blob)),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

    await expect(
      uploadToR2('https://upload.example.test', 'file:///photo.jpg', 'image/jpeg'),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'file:///photo.jpg');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://upload.example.test', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
  });

  it('creates a body analysis with normalized payload', async () => {
    mockPost.mockResolvedValue({
      data: {
        id: '9',
        taken_on: '2026-04-02',
        photo_url: 'https://cdn.example.test/body/1/photo.jpg',
        readings: {
          posture_score: '8',
          body_fat_estimate: '15-20%',
          strong_areas: ['spalle'],
        },
        ai_summary: 'Buon allineamento generale.',
      },
    });

    await expect(
      createBodyAnalysis('https://cdn.example.test/body/1/photo.jpg', '2026-04-02'),
    ).resolves.toEqual({
      id: 9,
      taken_on: '2026-04-02',
      photo_url: 'https://cdn.example.test/body/1/photo.jpg',
      readings: {
        posture_score: 8,
        posture_notes: '',
        body_fat_estimate: '15-20%',
        waist_to_hip_ratio_estimate: '',
        waist_to_shoulder_ratio_estimate: '',
        body_shape_note: '',
        muscle_distribution: '',
        strong_areas: ['spalle'],
        areas_to_improve: [],
        overall_progress_note: '',
        suggested_focus: '',
        notes: '',
      },
      comparison: {
        comparison_summary: '',
        progress_summary: '',
        progress_trend: 'non_determinabile',
      },
      ai_summary: 'Buon allineamento generale.',
    });

    expect(mockPost).toHaveBeenCalledWith('/body_analyses', {
      photo_url: 'https://cdn.example.test/body/1/photo.jpg',
      r2_key: undefined,
      date: '2026-04-02',
    });
  });

  it('loads and normalizes list and compare responses', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            taken_on: '2026-04-01',
            photo_url: 'https://cdn.example.test/body/1/a.jpg',
            readings: { posture_score: 6 },
            ai_summary: 'Prima lettura',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          analyses: [
            {
              id: 1,
              taken_on: '2026-04-01',
              photo_url: 'https://cdn.example.test/body/1/a.jpg',
              readings: { posture_score: 6 },
              ai_summary: 'Prima lettura',
            },
            {
              id: 2,
              taken_on: '2026-04-08',
              photo_url: 'https://cdn.example.test/body/1/b.jpg',
              readings: { posture_score: 8 },
              ai_summary: 'Seconda lettura',
            },
          ],
          delta: { posture_score_delta: '2', days_elapsed: '7' },
        },
      });

    await expect(getBodyAnalyses()).resolves.toEqual([
      normalizeBodyAnalysis({
        id: 1,
        taken_on: '2026-04-01',
        photo_url: 'https://cdn.example.test/body/1/a.jpg',
        readings: { posture_score: 6 },
        ai_summary: 'Prima lettura',
      }),
    ]);

    await expect(compareBodyAnalyses([1, 2])).resolves.toEqual({
      analyses: [
        normalizeBodyAnalysis({
          id: 1,
          taken_on: '2026-04-01',
          photo_url: 'https://cdn.example.test/body/1/a.jpg',
          readings: { posture_score: 6 },
          ai_summary: 'Prima lettura',
        }),
        normalizeBodyAnalysis({
          id: 2,
          taken_on: '2026-04-08',
          photo_url: 'https://cdn.example.test/body/1/b.jpg',
          readings: { posture_score: 8 },
          ai_summary: 'Seconda lettura',
        }),
      ],
      delta: { posture_score_delta: 2, days_elapsed: 7 },
    });

    expect(mockGet).toHaveBeenNthCalledWith(1, '/body_analyses');
    expect(mockGet).toHaveBeenNthCalledWith(2, '/body_analyses/compare', {
      params: { ids: [1, 2] },
    });
  });

  it('runs the complete upload and analysis flow', async () => {
    const blob = { mock: 'blob' };
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        blob: jest.fn(() => Promise.resolve(blob)),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

    mockGet.mockResolvedValue({
      data: {
        upload_url: 'https://upload.example.test',
        public_url: 'https://cdn.example.test/body/1/photo.jpg',
        key: 'body_analyses/1/photo.jpg',
      },
    });
    mockPost.mockResolvedValue({
      data: {
        id: 5,
        taken_on: '2026-04-02',
        photo_url: 'https://cdn.example.test/body/1/photo.jpg',
        readings: { posture_score: 7, notes: 'Solida base.' },
        ai_summary: 'Solida base.',
      },
    });

    await expect(
      uploadAndAnalyze({
        uri: 'file:///photo.jpg',
        fileName: 'body-photo.jpg',
        type: 'image/jpeg',
      }),
    ).resolves.toEqual({
      id: 5,
      taken_on: '2026-04-02',
      photo_url: 'https://cdn.example.test/body/1/photo.jpg',
      readings: {
        posture_score: 7,
        posture_notes: '',
        body_fat_estimate: '',
        waist_to_hip_ratio_estimate: '',
        waist_to_shoulder_ratio_estimate: '',
        body_shape_note: '',
        muscle_distribution: '',
        strong_areas: [],
        areas_to_improve: [],
        overall_progress_note: '',
        suggested_focus: '',
        notes: 'Solida base.',
      },
      comparison: {
        comparison_summary: '',
        progress_summary: '',
        progress_trend: 'non_determinabile',
      },
      ai_summary: 'Solida base.',
    });

    expect(mockPost).toHaveBeenCalledWith('/body_analyses', {
      photo_url: 'https://cdn.example.test/body/1/photo.jpg',
      r2_key: 'body_analyses/1/photo.jpg',
      date: expect.any(String),
    });
  });

  it('deletes a body analysis by id', async () => {
    mockDelete.mockResolvedValue({ data: { message: 'Eliminata.' } });

    await expect(deleteBodyAnalysis(42)).resolves.toEqual({ message: 'Eliminata.' });

    expect(mockDelete).toHaveBeenCalledWith('/body_analyses/42');
  });
});
