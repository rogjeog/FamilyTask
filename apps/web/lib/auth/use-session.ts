import { useQuery } from '@tanstack/react-query';
import { me } from '@/lib/api/auth';
import type { User, MeResponse } from '@/lib/api/types';

export interface Session {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Extracts a User from the flat MeResponse shape returned by GET /auth/me.
function toUser(data: MeResponse): User {
  return {
    id: data.id,
    email: data.email,
    displayName: data.displayName,
    avatarUrl: data.avatarUrl,
    createdAt: data.createdAt,
  };
}

export function useSession(): Session {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: me,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: data ? toUser(data) : null,
    isLoading,
    isAuthenticated: !!data,
  };
}
