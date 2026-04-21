import Link from 'next/link';
import { User, Star, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { TaskStatusBadge } from './task-status-badge';
import type { Task } from '@/lib/api/types';

interface Props {
  task: Task;
  currentUserId: string;
}

function formatDueAt(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskCard({ task, currentUserId }: Props) {
  const isAssignee = task.assigneeId === currentUserId;
  const isRequester = task.requesterId === currentUserId;
  const dueLabel = formatDueAt(task.dueAt);

  return (
    <Link href={`/tasks/${task.id}`} className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-text-primary leading-snug flex-1">
              {task.title}
            </span>
            <TaskStatusBadge status={task.status} />
          </div>

          <div className="flex items-center gap-4 text-xs text-text-secondary flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {isAssignee ? 'À faire par vous' : `Pour ${task.assigneeName}`}
            </span>
            {task.points > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {task.points} pts
              </span>
            )}
            {dueLabel && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {dueLabel}
              </span>
            )}
          </div>

          {isRequester && !isAssignee && (
            <p className="text-xs text-text-secondary">
              Demandé par vous
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
