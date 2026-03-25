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
});
