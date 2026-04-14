import { apiFetch } from './client';

export type DayEntryDto = {
  id: string;
  date: string;
  userId: string;
  authorName?: string;
  notes: string;
  version: number;
  lat: number | null;
  lng: number | null;
  geoSource: 'MANUAL' | 'AUTO' | null;
  geoAccuracy: number | null;
  geoCapturedAt: string | null;
  photos: { id: string; storageKey: string; url: string; sortOrder: number }[];
  updatedAt: string;
};

export function listDayEntries(
  companyId: string,
  from: string,
  to: string,
  userId?: string,
) {
  const q = new URLSearchParams({ from, to });
  if (userId) q.set('userId', userId);
  return apiFetch<DayEntryDto[]>(
    `/companies/${companyId}/day-entries?${q.toString()}`,
  );
}

export function upsertDayEntry(
  companyId: string,
  date: string,
  body: Record<string, unknown>,
) {
  return apiFetch<DayEntryDto>(`/companies/${companyId}/day-entries/${date}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function presignUpload(contentType: string, extension: string) {
  return apiFetch<{ uploadUrl: string; storageKey: string; publicUrl: string }>(
    '/storage/presign',
    { method: 'POST', body: JSON.stringify({ contentType, extension }) },
  );
}
