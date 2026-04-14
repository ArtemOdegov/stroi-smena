import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export function LoginPage() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const t = await api<{ accessToken: string; refreshToken: string }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );
      setSession(t.accessToken, t.refreshToken);
      nav('/');
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="page">
      <h1>Вход (веб-кабинет)</h1>
      <form className="card" onSubmit={onSubmit}>
        {err ? <p style={{ color: 'crimson' }}>{err}</p> : null}
        <div className="row">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <div className="row">
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </div>
        <button type="submit">Войти</button>
        <p>
          <Link to="/register">Регистрация</Link>
        </p>
      </form>
    </div>
  );
}
