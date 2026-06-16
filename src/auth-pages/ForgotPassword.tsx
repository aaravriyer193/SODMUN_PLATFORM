// ForgotPassword.tsx — /forgot
// Completely isolated — no app shell, no nav.
// Calls the forgot-password Edge Function which
// generates a token and sends via Loops.

import React, { useState } from 'react';

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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>SODMUN</div>
        <div style={styles.bar} />

        {status !== 'sent' ? (
          <>
            <h1 style={styles.title}>Forgot password?</h1>
            <p style={styles.sub}>
              {expired
                ? 'Your reset link has expired. Enter your email and we\'ll send a new one.'
                : 'Enter your email address and we\'ll send you a reset link.'}
            </p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
                autoComplete="email"
                required
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{ ...styles.btn, opacity: status === 'loading' ? 0.6 : 1 }}
              >
                {status === 'loading' ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <a href="https://app.sodmun.com/login" style={styles.back}>
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
  back: {
    fontSize: 13, color: '#A1A1AA',
    fontWeight: 600, textDecoration: 'none', marginTop: 20,
  },
  sentIcon: {
    fontSize: 32, marginBottom: 16, color: '#F07C00',
  },
};