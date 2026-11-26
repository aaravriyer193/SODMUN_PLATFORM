// Login.tsx — sign in with email + access code.
// Codes are forgiving (any case, with or without the dash). A one-tap link from
// the invite email (/login#email=…&code=…) fills both fields and signs in.
// Accounts that still use a regular password can type it in the same field.

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import AuthLayout from './auth-pages/AuthLayout';
import { formatCode, normalizeCode } from './accessCode';

export default function Login() {
  const { user } = useAuth();
  const [email, setEmail]     = useState('');
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const autoTried = useRef(false);

  const params  = new URLSearchParams(window.location.search);
  const welcome = params.get('welcome') === 'true';

  // If already logged in, redirect away
  useEffect(() => {
    if (user) window.location.href = '/';
  }, [user]);

  const signIn = async (rawEmail: string, rawCode: string) => {
    setError('');
    setLoading(true);
    const cleanEmail = rawEmail.trim().toLowerCase();
    const typed = rawCode.trim();

    // Access code first; fall back to the text exactly as typed (regular passwords).
    let result = await supabase.auth.signInWithPassword({ email: cleanEmail, password: normalizeCode(typed) });
    if ((result.error || !result.data.user) && typed && typed !== normalizeCode(typed)) {
      result = await supabase.auth.signInWithPassword({ email: cleanEmail, password: typed });
    }
    if (result.error || !result.data.user) {
      setError('That email and access code don’t match. Check the code in your invite email, or ask your chair for a new one.');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase.from('users').select('onboarded, role').eq('id', result.data.user.id).single();
    window.location.href = profile?.role === 'Delegate' && !profile?.onboarded ? '/welcome' : '/';
  };

  // One-tap link: read the fragment, clear it from the address bar, sign in.
  useEffect(() => {
    if (autoTried.current || !window.location.hash.includes('code=')) return;
    autoTried.current = true;
    const h = new URLSearchParams(window.location.hash.slice(1));
    const e = h.get('email') || '';
    const c = h.get('code') || '';
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (e) setEmail(e);
    if (c) setCode(formatCode(c));
    if (e && c) signIn(e, c);
  }, []);

  const handleSubmit = (ev: React.FormEvent) => { ev.preventDefault(); signIn(email, code); };

  return (
    <AuthLayout>

        {welcome && (
          <div style={styles.banner}>
            You’re all set — welcome to SODMUN. Sign in below.
          </div>
        )}

        <h1 style={styles.title}>Sign in</h1>
        <p style={styles.sub}>Use your email and the access code from your SODMUN invite.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Email</span>
            <input
              type="email"
              placeholder="you@school.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              autoComplete="username"
              required
            />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Access code</span>
            <input
              type="text"
              placeholder="XXXXX-XXXXX"
              value={code}
              onChange={e => {
                const v = e.target.value;
                // Format codes as they're typed; leave anything code-unlike (a password) alone
                setCode(/^[0-9A-Za-z\s-]*$/.test(v) && normalizeCode(v).length <= 10 ? formatCode(v) : v);
              }}
              style={{ ...styles.input, ...styles.codeInput }}
              autoComplete="current-password"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>

          {error && <p style={styles.error} role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={styles.forgot}>
          Lost your code? Ask your chair for a new one, or email <a href="mailto:sg.sodmun@gmail.com" style={styles.link}>sg.sodmun@gmail.com</a>.
        </p>
    </AuthLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  field: { display:'flex', flexDirection:'column', gap:8, width:'100%' },
  fieldLabel: { fontSize:12, fontWeight:500, color:'var(--text-secondary)', letterSpacing:'0.01em' },
  page: {
    minHeight: '100vh', width: '100vw',
    background: 'var(--bg-base)',
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
    fontSize: 28, marginBottom: 32,
  },
  bar: {
    width: 36, height: 3, background: 'var(--accent)',
    borderRadius: 99, marginBottom: 28,
  },
  banner: {
    width: '100%', padding: '12px 16px',
    background: 'rgba(34,197,94,0.07)',
    border: '1px solid rgba(34,197,94,0.22)',
    borderRadius: 10, marginBottom: 20,
    fontSize: 13, fontWeight: 500,
    color: '#16A34A', lineHeight: 1.5,
  },
  title: {
    fontSize: 48, fontWeight: 400, color: 'var(--text-primary)',
    letterSpacing: '-0.5px', marginBottom: 4,
  },
  sub: {
    fontSize: 15, color: 'var(--text-muted)', fontWeight: 400,
    lineHeight: 1.5, marginBottom: 32, maxWidth: '36ch',
  },
  form: {
    width: '100%', display: 'flex', flexDirection: 'column' as const, gap: 12,
  },
  input: {
    width: '100%', padding: '13px 16px',
    border: '1px solid var(--border-strong)',
    borderRadius: 12, fontSize: 14, fontWeight: 500,
    fontFamily:'var(--sans)',
    outline: 'none', color: 'var(--text-primary)', background: 'var(--bg-input)',
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
    fontSize: 13, color: '#DC2626',
    fontWeight: 500, margin: '4px 0', textAlign: 'left' as const,
  },
  forgot: {
    fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
    fontWeight: 400, marginTop: 20,
  },
  link: { color: 'var(--text-secondary)', textDecoration: 'underline' },
  codeInput: { fontFamily: 'var(--mono)', fontSize: 16, letterSpacing: '0.12em' },
};