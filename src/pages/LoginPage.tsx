import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { messageFromUnknownError } from '../api/errors';
import { useSession } from '../auth/session-context';
import { ThemeToggle } from '../theme/ThemeToggle';
import { RapidexLogo } from '../ui/RapidexLogo';
import './LoginPage.css';

export function LoginPage() {
  const { user, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quem já está logado não vê a tela de login.
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/pedidos'} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/pedidos', { replace: true });
    } catch (error) {
      setErrorMessage(messageFromUnknownError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login__theme">
        <ThemeToggle />
      </div>

      <form className="login__box" onSubmit={handleSubmit}>
        <div className="login__brand">
          <RapidexLogo size={32} />
        </div>
        <p className="login__subtitle">Painel do lojista</p>

        {errorMessage ? (
          <p className="alert alert--error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <label className="field">
          <span className="field__label">E-mail</span>
          <input
            className="input"
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Senha</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button
          type="submit"
          className="btn btn--primary btn--block login__submit"
          disabled={submitting}
        >
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
