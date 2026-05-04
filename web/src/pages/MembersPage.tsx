import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Brigade, type CompanyRow, type Member } from '../api';

export function MembersPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [rows, setRows] = useState<Member[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [brigades, setBrigades] = useState<Brigade[]>([]);

  async function load() {
    if (!companyId) return;
    setErr('');
    try {
      const list = await api<CompanyRow[]>('/companies/me');
      const row = list.find((c) => c.companyId === companyId);
      const role = row?.role ?? null;
      setMyRole(role);
      setRows(await api<Member[]>(`/companies/${companyId}/members`));
      if (role === 'DIRECTOR' || role === 'MASTER') {
        setBrigades(await api<Brigade[]>(`/companies/${companyId}/brigades`));
      } else {
        setBrigades([]);
      }
    } catch (e) {
      setErr(String(e));
    }
  }

  useEffect(() => {
    void load();
  }, [companyId]);

  async function patch(userId: string, body: object) {
    setErr('');
    try {
      await api(`/companies/${companyId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await load();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function regen(e: FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setErr('');
    try {
      const r = await api<{ inviteCode: string }>(
        `/companies/${companyId}/invite/regenerate`,
        { method: 'POST' },
      );
      setInvite(r.inviteCode);
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="page">
      <div className="nav">
        <Link to="/">← Компании</Link>
        <Link to={`/c/${companyId}/calendar`}>Календарь</Link>
      </div>
      <h1>Сотрудники</h1>
      {err ? <p style={{ color: 'crimson' }}>{err}</p> : null}
      {myRole === 'DIRECTOR' ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Новый код приглашения</h2>
          <form onSubmit={regen} className="row">
            <button type="submit">Сгенерировать</button>
          </form>
          {invite ? (
            <p>
              Новый код: <code>{invite}</code>
            </p>
          ) : null}
        </div>
      ) : null}
      {myRole === 'DIRECTOR' || myRole === 'MASTER' ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Бригады</h2>
          {brigades.length === 0 ? (
            <p className="muted">
              {myRole === 'DIRECTOR'
                ? 'Пока нет ни одной бригады. Создайте состав в мобильном приложении: экран «Права доступа».'
                : 'Директор ещё не создал для вас бригаду.'}
            </p>
          ) : (
            <ul>
              {brigades.map((b) => (
                <li key={b.id}>
                  <strong>{b.masterName}</strong> — {b.members.length}{' '}
                  {b.members.length === 1 ? 'сотрудник' : 'сотрудников'}
                  {b.name ? ` («${b.name}»)` : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.userId}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>{m.role}</td>
                <td>
                  {myRole === 'MASTER' &&
                  m.role !== 'EMPLOYEE' ? (
                    m.status
                  ) : (
                    <select
                      value={m.status}
                      onChange={(e) =>
                        void patch(m.userId, { status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PENDING">PENDING</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  )}
                </td>
                <td>
                  {myRole === 'MASTER' ? (
                    m.role
                  ) : (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        void patch(m.userId, { role: e.target.value })
                      }
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="MASTER">MASTER</option>
                      <option value="DIRECTOR">DIRECTOR</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
