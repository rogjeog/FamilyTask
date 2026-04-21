import { useQuery } from '@tanstack/react-query';
import { getTask } from '@/lib/api/tasks';

export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => getTask(id),
    staleTime: 30_000,
  });
}
