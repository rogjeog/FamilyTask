import { useQuery } from '@tanstack/react-query';
import { getMyFamily } from '@/lib/api/families';
import type { Family } from '@/lib/api/types';

export interface FamilyState {
  family: Family | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useFamily(): FamilyState {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['family'],
    queryFn: getMyFamily,
    retry: false,
    staleTime: 60_000,
  });

  return {
    family: data ?? null,
    isLoading,
    refetch,
  };
}
