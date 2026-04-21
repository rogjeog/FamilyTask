'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Star, User, Calendar, Link2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/use-session';
import { useTask } from '@/lib/hooks/use-task';
import { TaskStatusBadge } from '@/components/tasks/task-status-badge';
import { TaskActions } from '@/components/tasks/task-actions';
import { TaskEventsTimeline } from '@/components/tasks/task-events-timeline';
import { RemindersConfig } from '@/components/tasks/reminders-config';

interface Props {
  params: Promise<{ id: string }>;
}

export default function TaskDetailPage({ params }: Props) {
  const { id } = use(params);
  const { user } = useSession();
  const { data: task, isLoading, isError } = useTask(id);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !task) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-text-secondary">Tâche introuvable.</p>
          <Button variant="outline" asChild>
            <Link href="/tasks">Retour aux tâches</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentUserId = user?.id ?? '';
  const isAssignee = task.assigneeId === currentUserId;

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-background border-b border-border px-6 py-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/tasks">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour
          </Link>
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Title + status */}
        <div className="space-y-2">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary flex-1">
              {task.title}
            </h1>
            <TaskStatusBadge status={task.status} />
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              Par {task.requesterName} → {task.assigneeName}
            </span>
            {task.points > 0 && (
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4" />
                {task.points} point{task.points > 1 ? 's' : ''}
              </span>
            )}
            {task.dueAt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(task.dueAt).toLocaleString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Description
            </p>
            <p className="text-sm text-text-primary whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Proof URL */}
        {task.proofUrl && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Preuve
            </p>
            <a
              href={task.proofUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Link2 className="h-4 w-4" />
              Voir la preuve
            </a>
          </div>
        )}

        {/* Actions */}
        {user && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Actions
            </p>
            <TaskActions task={task} currentUserId={currentUserId} />
          </div>
        )}

        {/* Reminders — only for assignee */}
        {isAssignee && task.dueAt && (
          <RemindersConfig taskId={task.id} initialOffsets={[]} />
        )}

        {/* Events timeline */}
        <TaskEventsTimeline events={task.events} />
      </main>
    </div>
  );
}
