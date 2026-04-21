import { apiFetch } from './client';
import type {
  Task,
  TaskWithEvents,
  TaskReminderConfig,
  TasksPage,
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
} from './types';

function buildQuery(query: ListTasksQuery): string {
  const params = new URLSearchParams();
  if (query.status?.length) {
    query.status.forEach((s) => params.append('status', s));
  }
  if (query.assigneeId) params.set('assigneeId', query.assigneeId);
  if (query.requesterId) params.set('requesterId', query.requesterId);
  if (query.dueAtFrom) params.set('dueAtFrom', query.dueAtFrom);
  if (query.dueAtTo) params.set('dueAtTo', query.dueAtTo);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listTasks(query: ListTasksQuery = {}): Promise<TasksPage> {
  return apiFetch<TasksPage>(`/tasks${buildQuery(query)}`);
}

export async function getTask(id: string): Promise<TaskWithEvents> {
  return apiFetch<TaskWithEvents>(`/tasks/${id}`);
}

export async function createTask(data: CreateTaskInput): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput,
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
}

export async function acceptTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/accept`, { method: 'POST' });
}

export async function rejectTask(
  id: string,
  data: { reason?: string },
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function completeTask(
  id: string,
  data: { proofUrl?: string },
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function validateTask(id: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/validate`, { method: 'POST' });
}

export async function disputeTask(
  id: string,
  data: { reason: string },
): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}/dispute`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function setReminders(
  id: string,
  offsetsMinutes: number[],
): Promise<TaskReminderConfig> {
  return apiFetch<TaskReminderConfig>(`/tasks/${id}/reminders`, {
    method: 'PUT',
    body: JSON.stringify({ offsetsMinutes }),
  });
}
