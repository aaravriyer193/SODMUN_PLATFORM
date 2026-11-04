// Login.tsx — replaces existing Login.tsx
// Handles ?welcome=true banner and first-login redirect to /welcome

import React, { useState, useEffect } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import AuthLayout from './auth-pages/AuthLayout';

export default function Login() {
  const { user } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const params  = new URLSearchParams(window.location.search);
  const welcome = params.get('welcome') === 'true';
  const expired = params.get('error')   === 'expired';

  // If already logged in, redirect away
  useEffect(() => {
    if (user) window.location.href = '/';
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    });

    if (signInError || !data.user) {
      setError('Incorrect email or password. Try again or use "Forgot password?"');
      setLoading(false);
      return;
    }

    // Check if delegate needs onboarding
    const { data: profile } = await supabase
      .from('users')
      .select('onboarded, role')
      .eq('id', data.user.id)
      .single();

    if (profile?.role === 'Delegate' && !profile?.onboarded) {
      window.location.href = '/welcome';
    } else {
      window.location.href = '/';
    }
  };

  return (
    <AuthLayout>

        {/* Welcome banner — shown after setting password from invite */}
        {welcome && (
          <div style={styles.banner}>
            Password set — welcome to SODMUN. Log in below.
          </div>
        )}

        {/* Expired banner */}
        {expired && (
          <div style={{ ...styles.banner, background:'rgba(220,38,38,0.07)', borderColor:'rgba(220,38,38,0.20)', color:'#DC2626' }}>
            Your invite link expired. Request a new one below.
          </div>
        )}

        <h1 style={styles.title}>Sign in</h1>
        <p style={styles.sub}>Use the email your committee invited. Delegates and chairs sign in here.</p>

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
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Password</span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <a href="/forgot" style={styles.forgot}>
          Forgot password?
        </a>
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
    fontSize: 13, color: 'var(--text-muted)',
    fontWeight: 500, textDecoration: 'none',
    marginTop: 20, transition: 'color 0.15s',
  },
};