import { apiFetch } from './client';

export type CompanyRole = 'DIRECTOR' | 'MASTER' | 'EMPLOYEE';

export type CompanyRow = {
  companyId: string;
  role: CompanyRole;
  companyName: string;
  inviteCode: string | null;
};

export function listMyCompanies() {
  return apiFetch<CompanyRow[]>('/companies/me');
}

export function createCompany(name: string) {
  return apiFetch<{ company: { id: string; name: string }; inviteCode: string }>(
    '/companies',
    { method: 'POST', body: JSON.stringify({ name }) },
  );
}

export function joinCompany(code: string) {
  return apiFetch<{ companyId: string; alreadyMember: boolean }>(
    '/companies/join',
    { method: 'POST', body: JSON.stringify({ code }) },
  );
}

export type Colleague = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

export function listColleagues(companyId: string) {
  return apiFetch<Colleague[]>(`/companies/${companyId}/colleagues`);
}

export type MemberRow = {
  userId: string;
  email: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
};

export function listMembers(companyId: string) {
  return apiFetch<MemberRow[]>(`/companies/${companyId}/members`);
}

export function patchMember(
  companyId: string,
  userId: string,
  body: { role?: string; status?: string },
) {
  return apiFetch<unknown>(`/companies/${companyId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function regenerateInviteCode(companyId: string) {
  return apiFetch<{ inviteCode: string }>(
    `/companies/${companyId}/invite/regenerate`,
    { method: 'POST' },
  );
}
