import { useQuery } from '@tanstack/react-query';
import { me } from '@/lib/api/auth';
import type { User, FamilyInfo } from '@/lib/api/types';

export interface Session {
  user: User | null;
  family: FamilyInfo | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useSession(): Session {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: me,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data?.user ?? null,
    family: data?.family ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
  };
}
