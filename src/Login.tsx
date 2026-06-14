// Login.tsx — replaces existing Login.tsx
// Handles ?welcome=true banner and first-login redirect to /welcome

import React, { useState, useEffect } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

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
    <div style={styles.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=JetBrains+Mono:wght@700&display=swap');`}</style>

      <div style={styles.card}>
        <div style={styles.logo}>SODMUN</div>
        <div style={styles.bar} />

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
        <p style={styles.sub}>app.sodmun.com</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={styles.input}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
            autoComplete="current-password"
            required
          />

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
    color: '#F07C00', marginBottom: 20, textTransform: 'uppercase' as const,
  },
  bar: {
    width: 36, height: 3, background: '#F07C00',
    borderRadius: 99, marginBottom: 28,
  },
  banner: {
    width: '100%', padding: '12px 16px',
    background: 'rgba(34,197,94,0.07)',
    border: '1px solid rgba(34,197,94,0.22)',
    borderRadius: 10, marginBottom: 20,
    fontSize: 13, fontWeight: 600,
    color: '#16A34A', lineHeight: 1.5,
  },
  title: {
    fontSize: 24, fontWeight: 800, color: '#18181B',
    letterSpacing: '-0.5px', marginBottom: 4,
  },
  sub: {
    fontSize: 12, color: '#A1A1AA', fontWeight: 600,
    letterSpacing: '0.5px', marginBottom: 28,
  },
  form: {
    width: '100%', display: 'flex', flexDirection: 'column' as const, gap: 12,
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
    fontSize: 13, color: '#DC2626',
    fontWeight: 600, margin: '4px 0', textAlign: 'left' as const,
  },
  forgot: {
    fontSize: 13, color: '#A1A1AA',
    fontWeight: 600, textDecoration: 'none',
    marginTop: 20, transition: 'color 0.15s',
  },
};