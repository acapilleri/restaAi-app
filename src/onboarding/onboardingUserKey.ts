import type { User } from '../api/auth';

/** Chiave stabile per flag onboarding (per account). */
export async function resolveOnboardingUserKey(user: User | null): Promise<string> {
  if (user?.id != null) return `u:${user.id}`;
  if (user?.email) return `e:${user.email}`;
  const { getProfile } = await import('../api/profile');
  const res = await getProfile();
  const p = res.profile;
  if (p?.id != null) return `u:${p.id}`;
  if (p?.email) return `e:${p.email}`;
  return 'anon';
}
