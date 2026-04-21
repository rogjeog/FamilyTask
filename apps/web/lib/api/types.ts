// ─── Auth types ───────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

// Minimal family snapshot returned by GET /auth/me (no inviteCode, no members list).
// Use Family (from GET /families/me) for rich data.
export interface UserFamily {
  id: string;
  name: string;
  role: 'PARENT' | 'CHILD' | 'OTHER';
  joinedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

// Flat shape matching the actual GET /auth/me response body.
export interface MeResponse extends User {
  family: UserFamily | null;
}

// ─── Family types ─────────────────────────────────────────────────────────────

export interface FamilyMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'PARENT' | 'CHILD' | 'OTHER';
  joinedAt: string;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: FamilyMember[];
}

export interface CreateFamilyInput {
  name: string;
}

export interface JoinFamilyInput {
  inviteCode: string;
}

export interface RenameFamilyInput {
  name: string;
}

export interface ChangeMemberRoleInput {
  role: 'PARENT' | 'CHILD' | 'OTHER';
}

export interface DeleteFamilyInput {
  confirmationName: string;
}

// ─── Task types ───────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'COMPLETED'
  | 'REWARDED'
  | 'REJECTED';

export interface Task {
  id: string;
  familyId: string;
  requesterId: string;
  requesterName: string;
  assigneeId: string;
  assigneeName: string;
  title: string;
  description: string | null;
  points: number;
  dueAt: string | null;
  status: TaskStatus;
  recurrenceRule: string | null;
  proofUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEvent {
  id: string;
  taskId: string;
  actorId: string;
  actorName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  note: string | null;
  createdAt: string;
}

export interface TaskWithEvents extends Task {
  events: TaskEvent[];
}

export interface TaskReminderConfig {
  id: string;
  userId: string;
  taskId: string;
  offsetsMinutes: number[];
}

export interface CreateTaskInput {
  assigneeId: string;
  title: string;
  description?: string;
  points: number;
  dueAt?: string;
  recurrenceRule?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  points?: number;
  dueAt?: string | null;
  recurrenceRule?: string | null;
}

export interface ListTasksQuery {
  status?: TaskStatus[];
  assigneeId?: string;
  requesterId?: string;
  dueAtFrom?: string;
  dueAtTo?: string;
  cursor?: string;
  limit?: number;
}

export interface TasksPage {
  tasks: Task[];
  nextCursor: string | null;
}
