import { apiFetch } from './client';
import { setAccessToken, clearSession } from '@/lib/auth/session';
import type { RegisterInput, LoginInput, AuthResponse, MeResponse } from './types';

export async function register(data: RegisterInput): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setAccessToken(result.accessToken);
  return result;
}

export async function login(data: LoginInput): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setAccessToken(result.accessToken);
  return result;
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
  clearSession();
}

export async function me(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me');
}
