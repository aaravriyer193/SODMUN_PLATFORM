// ForgotPassword.tsx — /forgot
// Completely isolated — no app shell, no nav.
// Calls the forgot-password Edge Function which
// generates a token and sends via Loops.

import React, { useState } from 'react';
import AuthLayout from './AuthLayout';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forgot-password`;

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [status, setStatus] = useState<'idle'|'loading'|'sent'>('idle');

  // Check for ?error=expired in URL
  const expired = new URLSearchParams(window.location.search).get('error') === 'expired';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');

    // Always show "sent" after a moment regardless of outcome
    // — never reveal whether the email exists
    await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }).catch(() => {});

    setStatus('sent');
  };

  return (
    <AuthLayout>

        {status !== 'sent' ? (
          <>
            <h1 style={styles.title}>Forgot password?</h1>
            <p style={styles.sub}>
              {expired
                ? 'Your reset link has expired. Enter your email and we\'ll send a new one.'
                : 'Enter your email address and we\'ll send you a reset link.'}
            </p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Email</span>
                <input
                  type="email"
                  placeholder="you@school.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={styles.input}
                  autoComplete="email"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ ...styles.btn, opacity: status === 'loading' ? 0.6 : 1 }}
              >
                {status === 'loading' ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <a href="/login" style={styles.back}>
              Back to login
            </a>
          </>
        ) : (
          <>
            <div style={styles.sentIcon}>✉</div>
            <h1 style={styles.title}>Check your inbox</h1>
            <p style={styles.sub}>
              If that email address is registered, you'll receive a reset link shortly. Check your spam folder if it doesn't arrive within a few minutes.
            </p>
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
  back: {
    fontSize: 13, color: 'var(--text-muted)',
    fontWeight: 500, textDecoration: 'none', marginTop: 20,
  },
  sentIcon: {
    fontSize: 32, marginBottom: 16, color: 'var(--accent)',
  },
};