import { useState } from 'react';
import { Role } from '../../types';

interface Props {
  onLogin: (role: Role) => void;
}

const ADMIN_PASS = import.meta.env.VITE_ADMIN_PASS || 'admin2026';
const SUPERVISOR_PASS = import.meta.env.VITE_SUPERVISOR_PASS || 'super2026';

export default function LoginPage({ onLogin }: Props) {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'supervisor'>('supervisor');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedRole === 'admin' && password === ADMIN_PASS) {
      onLogin(Role.ADMIN);
    } else if (selectedRole === 'supervisor' && password === SUPERVISOR_PASS) {
      onLogin(Role.SUPERVISOR);
    } else {
      setError('Incorrect password. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #111b33 50%, #0d1526 100%)',
      fontFamily: 'var(--font, Inter, system-ui, sans-serif)',
    }}>
      <div style={{
        width: 380,
        background: 'rgba(17, 25, 50, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(100, 120, 180, 0.15)',
        borderRadius: 16,
        padding: '40px 32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(59, 130, 246, 0.05)',
        animation: shake ? 'shake 0.5s ease-in-out' : 'fadeIn 0.6s ease-out',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontSize: '2rem',
            marginBottom: 8,
          }}>🎓</div>
          <h1 style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: '#e2e8f0',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Training<span style={{ color: '#3b82f6' }}> Compliance</span>
          </h1>
          <p style={{
            fontSize: '0.78rem',
            color: '#64748b',
            margin: '6px 0 0',
          }}>Ramko Injection — Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Role selector */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>
              Role
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedRole('supervisor')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: selectedRole === 'supervisor' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${selectedRole === 'supervisor' ? '#3b82f6' : 'rgba(100,120,180,0.15)'}`,
                  borderRadius: 8,
                  color: selectedRole === 'supervisor' ? '#60a5fa' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                👔 Supervisor
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('admin')}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: selectedRole === 'admin' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${selectedRole === 'admin' ? '#a855f7' : 'rgba(100,120,180,0.15)'}`,
                  borderRadius: 8,
                  color: selectedRole === 'admin' ? '#c084fc' : '#64748b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                }}
              >
                🛡️ Admin
              </button>
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter your password"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${error ? '#ef4444' : 'rgba(100,120,180,0.2)'}`,
                borderRadius: 8,
                color: '#e2e8f0',
                fontSize: '0.88rem',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = '#3b82f6'; }}
              onBlur={e => { if (!error) e.target.style.borderColor = 'rgba(100,120,180,0.2)'; }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              fontSize: '0.78rem',
              color: '#ef4444',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '11px 0',
              background: selectedRole === 'admin'
                ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                : 'linear-gradient(135deg, #2563eb, #3b82f6)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: '0 4px 15px rgba(59,130,246,0.25)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Sign In
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: '0.72rem',
          color: '#475569',
        }}>
          v1.0.0 — Ramko Training System
        </div>
      </div>

      {/* Keyframe animations */}
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
