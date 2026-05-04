import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type CompanyRow } from '../api';
import { useAuth } from '../auth';

export function DashboardPage() {
  const { logout } = useAuth();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    setRows(await api<CompanyRow[]>('/companies/me'));
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCompany(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/companies', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setName('');
      await load();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api('/companies/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setCode('');
      await load();
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="page">
      <h1>Компании</h1>
      <div className="nav">
        <button type="button" className="secondary" onClick={() => logout()}>
          Выйти
        </button>
      </div>
      {err ? <p style={{ color: 'crimson' }}>{err}</p> : null}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Создать компанию</h2>
        <form onSubmit={createCompany} className="row">
          <label>
            Название
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="submit">Создать</button>
        </form>
        <h2>Присоединиться по коду</h2>
        <form onSubmit={join} className="row">
          <label>
            Код
            <input value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button type="submit" className="secondary">
            Вступить
          </button>
        </form>
      </div>
      {rows.map((c) => (
        <div key={c.companyId} className="card">
          <strong>{c.companyName}</strong> —{' '}
          {c.role === 'DIRECTOR'
            ? 'директор'
            : c.role === 'MASTER'
              ? 'мастер'
              : 'сотрудник'}
          {c.inviteCode ? (
            <p>
              Код приглашения: <code>{c.inviteCode}</code>
            </p>
          ) : null}
          <div className="nav">
            {c.role === 'DIRECTOR' || c.role === 'MASTER' ? (
              <>
                <Link to={`/c/${c.companyId}/members`}>Сотрудники</Link>
                <Link to={`/c/${c.companyId}/calendar`}>Календарь команды</Link>
              </>
            ) : (
              <Link to={`/c/${c.companyId}/calendar`}>Мой календарь</Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
