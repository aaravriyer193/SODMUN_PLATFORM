// ResetPassword.tsx — /reset
// Completely isolated — no app shell, no nav.
// Supabase puts the recovery token in the URL hash.

import React, { useState, useEffect } from 'react';
import { supabase } from '../api';

export default function ResetPassword() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [status, setStatus]       = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [tokenValid, setTokenValid] = useState<boolean|null>(null);

  useEffect(() => {
    // Supabase sends recovery tokens in the URL hash
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const accessToken  = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type         = params.get('type');

    if (accessToken && refreshToken && type === 'recovery') {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setTokenValid(false);
          } else {
            setTokenValid(true);
          }
        });
    } else {
      setTokenValid(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setStatus('loading');

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }

    // Clear last_reset_at now that reset is complete
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ last_reset_at: null }).eq('id', user.id);
    }

    await supabase.auth.signOut();
    setStatus('done');

    setTimeout(() => {
      window.location.href = 'https://app.sodmun.com/login';
    }, 2000);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>SODMUN</div>
        <div style={styles.bar} />

        {tokenValid === null && (
          <p style={styles.sub}>Verifying your reset link…</p>
        )}

        {tokenValid === false && (
          <>
            <h1 style={styles.title}>Link expired</h1>
            <p style={styles.sub}>This reset link has expired or already been used.</p>
            <a href="https://app.sodmun.com/forgot?error=expired" style={styles.link}>
              Request a new link →
            </a>
          </>
        )}

        {tokenValid === true && status !== 'done' && (
          <>
            <h1 style={styles.title}>Reset your password</h1>
            <p style={styles.sub}>Choose a new password for your account.</p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="password"
                placeholder="New password (min 8 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.input}
                autoComplete="new-password"
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                style={styles.input}
                autoComplete="new-password"
                required
              />
              {errorMsg && <p style={styles.error}>{errorMsg}</p>}
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ ...styles.btn, opacity: status === 'loading' ? 0.6 : 1 }}
              >
                {status === 'loading' ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={styles.successIcon}>✓</div>
            <h1 style={styles.title}>Password updated</h1>
            <p style={styles.sub}>Taking you back to login…</p>
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', width: '100vw',
    background: 'linear-gradient(135deg, #F5F3EF 0%, #FEF3E6 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Manrope', sans-serif", padding: 20,
  },
  card: {
    background: '#fff', borderRadius: 20,
    padding: '48px 44px', width: '100%', maxWidth: 400,
    boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center',
  },
  logo: {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13, fontWeight: 700, letterSpacing: 5,
    color: '#F07C00', marginBottom: 20, textTransform: 'uppercase',
  },
  bar: {
    width: 36, height: 3, background: '#F07C00',
    borderRadius: 99, marginBottom: 28,
  },
  title: {
    fontSize: 24, fontWeight: 800, color: '#18181B',
    letterSpacing: '-0.5px', marginBottom: 10,
  },
  sub: {
    fontSize: 14, color: '#71717A', fontWeight: 400,
    lineHeight: 1.6, marginBottom: 28,
  },
  form: {
    width: '100%', display: 'flex', flexDirection: 'column', gap: 12,
  },
  input: {
    width: '100%', padding: '13px 16px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 12, fontSize: 14, fontWeight: 500,
    fontFamily: "'Manrope', sans-serif",
    outline: 'none', color: '#18181B', background: '#FAFAF8',
  },
  btn: {
    width: '100%', height: 48,
    background: '#F07C00', color: '#fff',
    border: 'none', borderRadius: 12,
    fontSize: 14, fontWeight: 700,
    fontFamily: "'Manrope', sans-serif",
    cursor: 'pointer', marginTop: 4,
    boxShadow: '0 4px 14px rgba(240,124,0,0.28)',
  },
  error: {
    fontSize: 13, color: '#DC2626', fontWeight: 600, margin: '4px 0',
  },
  link: {
    fontSize: 13, color: '#F07C00',
    fontWeight: 700, textDecoration: 'none', marginTop: 8,
  },
  successIcon: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'rgba(34,197,94,0.10)',
    border: '2px solid rgba(34,197,94,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, marginBottom: 16,
  },
};