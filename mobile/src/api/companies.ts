import { apiFetch } from './client';

export type CompanyRow = {
  companyId: string;
  role: 'DIRECTOR' | 'EMPLOYEE';
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
