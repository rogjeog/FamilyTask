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
