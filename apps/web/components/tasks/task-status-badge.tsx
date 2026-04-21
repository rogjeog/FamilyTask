import { Badge } from '@/components/ui/badge';
import type { TaskStatus } from '@/lib/api/types';

interface Props {
  status: TaskStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; variant: 'secondary' | 'primary' | 'warning' | 'success' | 'danger' }
> = {
  PENDING: { label: 'En attente', variant: 'secondary' },
  ACCEPTED: { label: 'Acceptée', variant: 'primary' },
  COMPLETED: { label: 'Terminée', variant: 'warning' },
  REWARDED: { label: 'Validée', variant: 'success' },
  REJECTED: { label: 'Refusée', variant: 'danger' },
};

export function TaskStatusBadge({ status, className }: Props) {
  const { label, variant } = STATUS_CONFIG[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
