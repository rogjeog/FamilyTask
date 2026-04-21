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

export interface FamilyInfo {
  id: string;
  name: string;
  role: 'PARENT' | 'CHILD' | 'OTHER';
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface MeResponse {
  user: User;
  family?: FamilyInfo;
}
