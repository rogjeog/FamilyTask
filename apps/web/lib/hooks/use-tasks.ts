import { useInfiniteQuery } from '@tanstack/react-query';
import { listTasks } from '@/lib/api/tasks';
import type { ListTasksQuery } from '@/lib/api/types';

export function useTasks(filters: Omit<ListTasksQuery, 'cursor'> = {}) {
  return useInfiniteQuery({
    queryKey: ['tasks', filters],
    queryFn: ({ pageParam }) =>
      listTasks({ ...filters, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
