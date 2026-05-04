import { apiFetch } from './client';
import type { MemberRow } from './companies';

export type BrigadeDto = {
  id: string;
  companyId: string;
  name: string;
  masterUserId: string;
  masterName: string;
  members: MemberRow[];
};

export function listBrigades(companyId: string) {
  return apiFetch<BrigadeDto[]>(`/companies/${companyId}/brigades`);
}

export function createBrigade(
  companyId: string,
  body: { masterUserId: string; name?: string; memberUserIds: string[] },
) {
  return apiFetch<BrigadeDto>(`/companies/${companyId}/brigades`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateBrigade(
  companyId: string,
  brigadeId: string,
  body: {
    name?: string;
    masterUserId?: string;
    memberUserIds?: string[];
  },
) {
  return apiFetch<BrigadeDto>(
    `/companies/${companyId}/brigades/${brigadeId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export function deleteBrigade(companyId: string, brigadeId: string) {
  return apiFetch<{ ok: boolean }>(
    `/companies/${companyId}/brigades/${brigadeId}`,
    { method: 'DELETE' },
  );
}
