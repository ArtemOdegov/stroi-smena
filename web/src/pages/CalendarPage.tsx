import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type CompanyRow, type DayEntry, type Member } from '../api';
import { EntryMap } from '../components/EntryMap';

function monthBounds(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export function CalendarPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [role, setRole] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const list = await api<CompanyRow[]>('/companies/me');
      const row = list.find((c) => c.companyId === companyId);
      setRole(row?.role ?? null);
      if (row?.role === 'DIRECTOR' || row?.role === 'MASTER') {
        try {
          setMembers(await api<Member[]>(`/companies/${companyId}/members`));
        } catch {
          setMembers([]);
        }
      }
    })();
  }, [companyId]);

  const { from, to } = useMemo(() => monthBounds(ym), [ym]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setErr('');
      try {
        const q = new URLSearchParams({ from, to });
        if (
          (role === 'DIRECTOR' || role === 'MASTER') &&
          filterUserId.trim()
        ) {
          q.set('userId', filterUserId);
        }
        const data = await api<DayEntry[]>(
          `/companies/${companyId}/day-entries?${q.toString()}`,
        );
        setEntries(data);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [companyId, from, to, filterUserId, role]);

  return (
    <div className="page">
      <div className="nav">
        <Link to="/">← Компании</Link>
        {role === 'DIRECTOR' || role === 'MASTER' ? (
          <Link to={`/c/${companyId}/members`}>Сотрудники</Link>
        ) : null}
      </div>
      <h1>Календарь занятости</h1>
      {err ? <p style={{ color: 'crimson' }}>{err}</p> : null}
      <div className="card row">
        <label>
          Месяц
          <input type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
        </label>
        {role === 'DIRECTOR' || role === 'MASTER' ? (
          <label>
            Сотрудник (пусто = вся команда)
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
            >
              <option value="">Вся команда</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="entry-grid">
        {entries.map((e) => (
          <div key={e.id} className="entry">
            <h3>
              {e.date} · v{e.version}
              <span style={{ color: '#666', fontWeight: 400 }}>
                {' '}
                ·{' '}
                {e.authorName ??
                  members.find((x) => x.userId === e.userId)?.name ??
                  e.userId.slice(0, 8)}
              </span>
            </h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{e.notes || '—'}</p>
            {e.lat != null && e.lng != null ? <EntryMap lat={e.lat} lng={e.lng} /> : null}
            <div className="thumbs">
              {e.photos.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt="" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      {entries.length === 0 ? <p>Нет записей за период.</p> : null}
    </div>
  );
}
