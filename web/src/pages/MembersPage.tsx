import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Member } from '../api';

export function MembersPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [rows, setRows] = useState<Member[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function load() {
    if (!companyId) return;
    setRows(await api<Member[]>(`/companies/${companyId}/members`));
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
                </td>
                <td>
                  <select
                    value={m.role}
                    onChange={(e) =>
                      void patch(m.userId, { role: e.target.value })
                    }
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="DIRECTOR">DIRECTOR</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
