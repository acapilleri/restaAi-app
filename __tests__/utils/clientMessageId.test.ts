import { isClientGeneratedMessageId } from '../../src/utils/clientMessageId';

describe('isClientGeneratedMessageId', () => {
  it('returns true for makeId-style assistant ids', () => {
    expect(isClientGeneratedMessageId('assistant-1710000000000-12345')).toBe(true);
  });

  it('returns true for system-log and user prefixes', () => {
    expect(isClientGeneratedMessageId('system-log-1710000000000-1')).toBe(true);
    expect(isClientGeneratedMessageId('user-1710000000000-99')).toBe(true);
  });

  it('returns false for typical server numeric or uuid ids', () => {
    expect(isClientGeneratedMessageId('42')).toBe(false);
    expect(isClientGeneratedMessageId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });
});
