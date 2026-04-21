'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/use-session';
import { useFamily } from '@/lib/hooks/use-family';
import { useTasks } from '@/lib/hooks/use-tasks';
import { TaskCard } from '@/components/tasks/task-card';
import { TaskFilters } from '@/components/tasks/task-filters';
import { CreateTaskDialog } from '@/components/tasks/create-task-dialog';
import type { ListTasksQuery } from '@/lib/api/types';

export default function TasksPage() {
  const { user } = useSession();
  const { family } = useFamily();
  const [filters, setFilters] = useState<Omit<ListTasksQuery, 'cursor' | 'limit'>>({});
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTasks(filters);

  const tasks = data?.pages.flatMap((p) => p.tasks) ?? [];

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-background border-b border-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Tâches</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!family}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvelle tâche
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        {family && user && (
          <TaskFilters
            filters={filters}
            onChange={setFilters}
            members={family.members}
            currentUserId={user.id}
          />
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-text-secondary">Aucune tâche pour l&apos;instant.</p>
            {family && (
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                Créer une tâche
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id ?? ''}
              />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
            </Button>
          </div>
        )}
      </main>

      {family && user && (
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          members={family.members}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}
