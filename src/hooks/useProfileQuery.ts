import { useQuery } from '@tanstack/react-query';
import { getProfile, PROFILE_QUERY_KEY } from '../api/profile';
import { useAuth } from '../context/AuthContext';

export function useProfileQuery() {
  const { token } = useAuth();
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => getProfile(),
    enabled: !!token,
    staleTime: 60_000,
  });
}
