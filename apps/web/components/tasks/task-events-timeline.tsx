import type { TaskEvent, TaskStatus } from '@/lib/api/types';

interface Props {
  events: TaskEvent[];
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  COMPLETED: 'Terminée',
  REWARDED: 'Validée',
  REJECTED: 'Refusée',
};

function eventLabel(event: TaskEvent): string {
  if (!event.fromStatus) {
    return `${event.actorName} a créé la tâche`;
  }
  const from = STATUS_LABELS[event.fromStatus] ?? event.fromStatus;
  const to = STATUS_LABELS[event.toStatus] ?? event.toStatus;
  return `${event.actorName} • ${from} → ${to}`;
}

export function TaskEventsTimeline({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Historique
      </p>
      <ol className="space-y-3 mt-2">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
              <span className="w-px flex-1 bg-border mt-1" />
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-sm text-text-primary">{eventLabel(event)}</p>
              {event.note && (
                <p className="text-xs text-text-secondary mt-0.5 italic">
                  &ldquo;{event.note}&rdquo;
                </p>
              )}
              <time
                dateTime={event.createdAt}
                className="text-xs text-text-secondary"
              >
                {new Date(event.createdAt).toLocaleString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
