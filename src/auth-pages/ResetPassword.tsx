// ResetPassword.tsx — /reset
// Completely isolated — no app shell, no nav.
// Supabase puts the recovery token in the URL hash.

import React, { useState, useEffect } from 'react';
import { supabase } from '../api';
import AuthLayout from './AuthLayout';

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
      window.location.href = '/login';
    }, 2000);
  };

  return (
    <AuthLayout>

        {tokenValid === null && (
          <p style={styles.sub}>Verifying your reset link…</p>
        )}

        {tokenValid === false && (
          <>
            <h1 style={styles.title}>Link expired</h1>
            <p style={styles.sub}>This reset link has expired or already been used.</p>
            <a href="/forgot?error=expired" style={styles.link}>
              Request a new link →
            </a>
          </>
        )}

        {tokenValid === true && status !== 'done' && (
          <>
            <h1 style={styles.title}>Reset your password</h1>
            <p style={styles.sub}>Choose a new password for your account.</p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>New password</span>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={styles.input}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Confirm new password</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={styles.input}
                  autoComplete="new-password"
                  required
                />
              </label>
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
    </AuthLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  field: { display:'flex', flexDirection:'column', gap:8, width:'100%' },
  fieldLabel: { fontSize:12, fontWeight:500, color:'var(--text-secondary)', letterSpacing:'0.01em' },
  page: {
    minHeight: '100vh', width: '100vw',
    background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily:'var(--sans)', padding: 20,
  },
  card: {
    background: 'var(--bg-2)', border:'1px solid var(--border)', borderRadius: 20,
    padding: '48px 44px', width: '100%', maxWidth: 400,
    boxShadow: 'var(--shadow-lg)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center',
  },
  logo: {
    fontFamily:'var(--mono)',
    fontSize: 13, fontWeight: 500, letterSpacing: 5,
    color: 'var(--accent)', marginBottom: 20, textTransform: 'uppercase',
  },
  bar: {
    width: 36, height: 3, background: 'var(--accent)',
    borderRadius: 99, marginBottom: 28,
  },
  title: {
    fontSize: 48, fontWeight: 400, color: 'var(--text-primary)',
    letterSpacing: '-0.5px', marginBottom: 10,
  },
  sub: {
    fontSize: 14, color: 'var(--text-muted)', fontWeight: 400,
    lineHeight: 1.6, marginBottom: 28,
  },
  form: {
    width: '100%', display: 'flex', flexDirection: 'column', gap: 12,
  },
  input: {
    width: '100%', padding: '13px 16px',
    border: '1px solid rgba(var(--tint),0.12)',
    borderRadius: 12, fontSize: 14, fontWeight: 500,
    fontFamily:'var(--sans)',
    outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-2)',
  },
  btn: {
    width: '100%', height: 48,
    background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 99,
    fontSize: 14, fontWeight: 500,
    fontFamily:'var(--sans)',
    cursor: 'pointer', marginTop: 4,
  },
  error: {
    fontSize: 13, color: '#DC2626', fontWeight: 500, margin: '4px 0',
  },
  link: {
    fontSize: 13, color: 'var(--accent)',
    fontWeight: 500, textDecoration: 'none', marginTop: 8,
  },
  successIcon: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'rgba(34,197,94,0.10)',
    border: '2px solid rgba(34,197,94,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, marginBottom: 16,
  },
};