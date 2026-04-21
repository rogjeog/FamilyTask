export class UserResponse {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export class FamilyInfo {
  id: string;
  name: string;
  role: string;
  joinedAt: Date;
}

export class AuthResponse {
  user: UserResponse;
  accessToken: string;
}

export class MeResponse extends UserResponse {
  family: FamilyInfo | null;
}
