'use client';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FamilyMember, ListTasksQuery, TaskStatus } from '@/lib/api/types';

interface Props {
  filters: Omit<ListTasksQuery, 'cursor' | 'limit'>;
  onChange: (filters: Omit<ListTasksQuery, 'cursor' | 'limit'>) => void;
  members: FamilyMember[];
  currentUserId: string;
}

const ALL_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'ACCEPTED', label: 'Acceptée' },
  { value: 'COMPLETED', label: 'Terminée' },
  { value: 'REWARDED', label: 'Validée' },
  { value: 'REJECTED', label: 'Refusée' },
];

export function TaskFilters({ filters, onChange, members, currentUserId }: Props) {
  function toggleStatus(status: TaskStatus) {
    const current = filters.status ?? [];
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    onChange({ ...filters, status: next.length > 0 ? next : undefined });
  }

  return (
    <div className="flex flex-wrap gap-4 items-start py-2">
      {/* Status checkboxes */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Statut
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {ALL_STATUSES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <Checkbox
                checked={(filters.status ?? []).includes(value)}
                onCheckedChange={() => toggleStatus(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Assignee filter */}
      <div className="space-y-1 min-w-[160px]">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Assigné à
        </p>
        <Select
          value={filters.assigneeId ?? 'all'}
          onValueChange={(v) =>
            onChange({ ...filters, assigneeId: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les membres</SelectItem>
            <SelectItem value={currentUserId}>Moi</SelectItem>
            {members
              .filter((m) => m.userId !== currentUserId)
              .map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.displayName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Requester filter */}
      <div className="space-y-1 min-w-[160px]">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Créé par
        </p>
        <Select
          value={filters.requesterId ?? 'all'}
          onValueChange={(v) =>
            onChange({ ...filters, requesterId: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les membres</SelectItem>
            <SelectItem value={currentUserId}>Moi</SelectItem>
            {members
              .filter((m) => m.userId !== currentUserId)
              .map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.displayName}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
