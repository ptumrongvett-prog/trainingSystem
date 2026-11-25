import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
  error: string | null;
  busy: boolean;
  notice?: string | null;
}

const shell: CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  flex: '1 1 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #0a0f1e 0%, #111b33 50%, #0d1526 100%)',
  fontFamily: 'var(--font, Inter, system-ui, sans-serif)',
  padding: 24,
};

const card: CSSProperties = {
  width: 400,
  maxWidth: '100%',
  background: 'rgba(17, 25, 50, 0.85)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(100, 120, 180, 0.15)',
  borderRadius: 16,
  padding: '40px 32px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(59, 130, 246, 0.05)',
};

export function AuthChecking({ label }: { label: string }) {
  return (
    <div style={shell}>
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎓</div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          Training<span style={{ color: '#3b82f6' }}> Compliance</span>
        </h1>
        <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '18px 0 0' }}>{label}</p>
      </div>
    </div>
  );
}

export default function LoginPage({ onSignIn, error, busy, notice }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!error || !card) return;
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = 'shake 0.5s ease-in-out';
  }, [error]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    void onSignIn(email, password);
  };

  return (
    <div style={shell}>
      <div ref={cardRef} style={{ ...card, animation: 'fadeIn 0.6s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎓</div>
          <h1 style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: '#e2e8f0',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Training<span style={{ color: '#3b82f6' }}> Compliance</span>
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '6px 0 0' }}>
            Ramko Injection — Supervisor and admin sign-in
          </p>
        </div>

        {notice && (
          <div style={{
            fontSize: '0.75rem',
            color: '#93c5fd',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 16,
          }}>
            {notice}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label htmlFor="dashboard-email" style={labelStyle}>Email</label>
            <input
              id="dashboard-email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@ramko-inj.com"
              autoFocus
              disabled={busy}
              style={inputStyle(Boolean(error))}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="dashboard-password" style={labelStyle}>Password</label>
            <input
              id="dashboard-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Enter your password"
              disabled={busy}
              style={inputStyle(Boolean(error))}
            />
          </div>

          {error && (
            <div role="alert" style={{
              fontSize: '0.78rem',
              color: '#fca5a5',
              marginBottom: 14,
              lineHeight: 1.45,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%',
              padding: '11px 0',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: busy ? 0.7 : 1,
              boxShadow: '0 4px 15px rgba(59,130,246,0.25)',
            }}
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          margin: '18px 0 0',
          fontSize: '0.72rem',
          color: '#64748b',
          lineHeight: 1.45,
        }}>
          Your menu follows the role an administrator assigned to this account.
          Plant employees using the FN-135 form do not sign in here.
        </p>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.72rem', color: '#475569' }}>
          v1.0.0 — Ramko Training System
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  color: '#94a3b8',
  marginBottom: 6,
  fontWeight: 500,
};

function inputStyle(hasError: boolean): CSSProperties {
  return {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: `1.5px solid ${hasError ? '#ef4444' : 'rgba(100,120,180,0.2)'}`,
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: '0.88rem',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
}
