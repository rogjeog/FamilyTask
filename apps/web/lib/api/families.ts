import { apiFetch } from './client';
import type {
  Family,
  CreateFamilyInput,
  JoinFamilyInput,
  RenameFamilyInput,
  ChangeMemberRoleInput,
  DeleteFamilyInput,
} from './types';

export async function createFamily(data: CreateFamilyInput): Promise<Family> {
  return apiFetch<Family>('/families', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function joinFamily(data: JoinFamilyInput): Promise<Family> {
  return apiFetch<Family>('/families/join', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMyFamily(): Promise<Family | null> {
  return apiFetch<Family | null>('/families/me');
}

export async function regenerateInvite(): Promise<Family> {
  return apiFetch<Family>('/families/me/invite', { method: 'POST' });
}

export async function leaveFamily(): Promise<void> {
  return apiFetch<void>('/families/me/leave', { method: 'POST' });
}

export async function renameFamily(data: RenameFamilyInput): Promise<Family> {
  return apiFetch<Family>('/families/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteFamily(data: DeleteFamilyInput): Promise<void> {
  return apiFetch<void>('/families/me', {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
}

export async function kickMember(userId: string): Promise<Family> {
  return apiFetch<Family>(`/families/me/members/${userId}`, {
    method: 'DELETE',
  });
}

export async function changeMemberRole(
  userId: string,
  data: ChangeMemberRoleInput,
): Promise<Family> {
  return apiFetch<Family>(`/families/me/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
