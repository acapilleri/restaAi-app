import {
  getDietPlanPresignedUrl,
  scanDietPlan,
  uploadDietPlanImageAndScan,
} from '../../src/api/dietPlan';

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('../../src/api/client', () => ({
  __esModule: true,
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('dietPlan api adapter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('requests a presigned url for diet scan uploads', async () => {
    mockGet.mockResolvedValue({
      data: {
        upload_url: 'https://upload.example.test',
        public_url: 'https://cdn.example.test/diet/1/scan.jpg',
        key: 'diet_plans/1/scan.jpg',
      },
    });

    await expect(getDietPlanPresignedUrl('scan.jpg', 'image/jpeg')).resolves.toEqual({
      upload_url: 'https://upload.example.test',
      public_url: 'https://cdn.example.test/diet/1/scan.jpg',
      key: 'diet_plans/1/scan.jpg',
    });

    expect(mockGet).toHaveBeenCalledWith('/diet_plan/presign', {
      params: { filename: 'scan.jpg', content_type: 'image/jpeg' },
    });
  });

  it('accepts nested camelCase presign payloads', async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          uploadUrl: 'https://upload.example.test',
          publicUrl: 'https://cdn.example.test/diet/1/scan.jpg',
        },
      },
    });

    await expect(getDietPlanPresignedUrl('scan.jpg', 'image/jpeg')).resolves.toEqual({
      upload_url: 'https://upload.example.test',
      public_url: 'https://cdn.example.test/diet/1/scan.jpg',
    });
  });

  it('derives the public url from legacy presign payloads that only return key', async () => {
    mockGet.mockResolvedValue({
      data: {
        upload_url: 'https://r2.example.test/bucket/diet/scan.jpg?X-Amz-Signature=abc123',
        key: 'diet/scan.jpg',
      },
    });

    await expect(getDietPlanPresignedUrl('scan.jpg', 'image/jpeg')).resolves.toEqual({
      upload_url: 'https://r2.example.test/bucket/diet/scan.jpg?X-Amz-Signature=abc123',
      public_url: 'https://r2.example.test/bucket/diet/scan.jpg',
      key: 'diet/scan.jpg',
    });
  });

  it('posts the uploaded image url to diet scan', async () => {
    mockPost.mockResolvedValue({
      data: { text: 'Piano estratto' },
    });

    await expect(scanDietPlan('https://cdn.example.test/diet/1/scan.jpg')).resolves.toEqual({
      text: 'Piano estratto',
    });

    expect(mockPost).toHaveBeenCalledWith('/diet_plan/scan', {
      image_url: 'https://cdn.example.test/diet/1/scan.jpg',
      r2_key: undefined,
    });
  });

  it('uploads the image to R2 before scanning it', async () => {
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
        public_url: 'https://cdn.example.test/diet/1/scan.jpg',
        key: 'diet_plans/1/scan.jpg',
      },
    });
    mockPost.mockResolvedValue({
      data: { text: 'Testo OCR' },
    });

    await expect(
      uploadDietPlanImageAndScan({
        uri: 'file:///diet.jpg',
        fileName: 'diet-photo.jpg',
        type: 'image/jpeg',
      }),
    ).resolves.toEqual({ text: 'Testo OCR' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'file:///diet.jpg');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://upload.example.test', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });
    expect(mockPost).toHaveBeenCalledWith('/diet_plan/scan', {
      image_url: 'https://cdn.example.test/diet/1/scan.jpg',
      r2_key: 'diet_plans/1/scan.jpg',
    });
  });

  it('scans with a derived public url when the presign response only returns key', async () => {
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
        upload_url: 'https://r2.example.test/bucket/diet/scan.jpg?X-Amz-Signature=abc123',
        key: 'diet/scan.jpg',
      },
    });
    mockPost.mockResolvedValue({
      data: { text: 'Testo OCR' },
    });

    await expect(
      uploadDietPlanImageAndScan({
        uri: 'file:///diet.jpg',
        fileName: 'diet-photo.jpg',
        type: 'image/jpeg',
      }),
    ).resolves.toEqual({ text: 'Testo OCR' });

    expect(mockPost).toHaveBeenCalledWith('/diet_plan/scan', {
      image_url: 'https://r2.example.test/bucket/diet/scan.jpg',
      r2_key: 'diet/scan.jpg',
    });
  });
});
