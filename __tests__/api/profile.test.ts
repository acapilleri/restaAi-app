/**
 * @format
 */

import { normalizeProfileResponse } from '../../src/api/profile';

describe('normalizeProfileResponse', () => {
  it('parses unread_nudge_count as number', () => {
    const { profile } = normalizeProfileResponse({
      profile: {
        id: 1,
        email: 'a@b.c',
        name: 'Test',
        unread_nudge_count: 3,
      },
    });
    expect(profile.unread_nudge_count).toBe(3);
  });

  it('accepts nudge_unread_count alias', () => {
    const { profile } = normalizeProfileResponse({
      profile: {
        id: 1,
        email: 'a@b.c',
        name: 'Test',
        nudge_unread_count: 2,
      },
    });
    expect(profile.unread_nudge_count).toBe(2);
  });

  it('parses string unread_nudge_count', () => {
    const { profile } = normalizeProfileResponse({
      profile: {
        id: 1,
        email: 'a@b.c',
        name: 'Test',
        unread_nudge_count: '5',
      },
    });
    expect(profile.unread_nudge_count).toBe(5);
  });

  it('floors and clamps nudge count to non-negative int', () => {
    const { profile } = normalizeProfileResponse({
      profile: {
        id: 1,
        email: 'a@b.c',
        name: 'Test',
        unread_nudge_count: 2.7,
      },
    });
    expect(profile.unread_nudge_count).toBe(2);
  });

  it('does not set unread_nudge_count when absent', () => {
    const { profile } = normalizeProfileResponse({
      profile: { id: 1, email: 'a@b.c', name: 'Test' },
    });
    expect(profile.unread_nudge_count).toBeUndefined();
  });
});
