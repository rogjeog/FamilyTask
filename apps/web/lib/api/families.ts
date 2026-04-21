import { apiFetch } from './client';
import type { Family, CreateFamilyInput, JoinFamilyInput } from './types';

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

export async function regenerateInvite(familyId: string): Promise<Family> {
  return apiFetch<Family>(`/families/${familyId}/invite`, { method: 'POST' });
}
