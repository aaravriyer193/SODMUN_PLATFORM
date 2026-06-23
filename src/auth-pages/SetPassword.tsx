// SetPassword.tsx — /set-password?token=...
// Completely isolated — no app shell, no nav links.
// Delegate lands here from their Loops invite email.

import React, { useState, useEffect } from 'react';
import { supabase } from '../api';

export default function SetPassword() {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [status, setStatus]       = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [tokenValid, setTokenValid] = useState<boolean|null>(null);

  // On mount: try to establish a session from the URL token/hash,
  // then check last_sign_in_at — if null the user has never logged in
  // (i.e. never set a password), so we allow them to proceed regardless
  // of whether the invite token itself was already consumed by a bot/preview.
  useEffect(() => {
    const trySession = async () => {
      const hash   = window.location.hash;
      const search = window.location.search;

      const params       = new URLSearchParams(hash.replace('#', '?'));
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type         = params.get('type');

      // Attempt 1: hash-based session (standard Supabase invite redirect)
      if (accessToken && refreshToken && type === 'invite') {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error) {
          await checkLastSignIn();
          return;
        }
      }

      // Attempt 2: token_hash in query string (some email clients)
      const sp    = new URLSearchParams(search);
      const token = sp.get('token');
      if (token) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'invite' });
        if (!error) {
          await checkLastSignIn();
          return;
        }
      }

      // Attempt 3: maybe there's already an active session in this browser
      // (e.g. user clicked the link again after a bot consumed it first)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await checkLastSignIn();
        return;
      }

      // Nothing worked — truly expired or invalid
      setTokenValid(false);
      setErrorMsg('This invite link has expired or is invalid. Request a new one below.');
    };

    trySession();
  }, []);

  // Core check: user is allowed to set their password as long as they have
  // never successfully signed in before (last_sign_in_at is null in auth.users).
  // This means bots/previews consuming the one-time token don't lock out the
  // real user — they just need any valid session (from any attempt above).
  const checkLastSignIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setTokenValid(false);
      setErrorMsg('Could not retrieve your account. Try clicking the link again.');
      return;
    }

    if (user.last_sign_in_at == null) {
      // Never signed in — password has never been set, allow it
      setTokenValid(true);
    } else {
      // Already signed in before = password already set
      setTokenValid(false);
      setErrorMsg('Your password has already been set. Log in normally, or reset your password if you\'ve forgotten it.');
    }
  };

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

    // Sign out so they log in fresh — cleaner than auto-login from invite token
    await supabase.auth.signOut();
    setStatus('done');

    setTimeout(() => {
      window.location.href = 'https://app.sodmun.com/login?welcome=true';
    }, 2000);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>SODMUN</div>
        <div style={styles.bar} />

        {tokenValid === null && (
          <p style={styles.sub}>Verifying your link…</p>
        )}

        {tokenValid === false && (
          <>
            <h1 style={styles.title}>Link expired</h1>
            <p style={styles.sub}>{errorMsg}</p>
            <a href="https://app.sodmun.com/forgot" style={styles.link}>
              Request a new link →
            </a>
          </>
        )}

        {tokenValid === true && status !== 'done' && (
          <>
            <h1 style={styles.title}>Set your password</h1>
            <p style={styles.sub}>Choose a password you'll remember. You'll use this every time you log in.</p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.input}
                autoComplete="new-password"
                required
              />
              <input
                type="password"
                placeholder="Confirm password"
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
                {status === 'loading' ? 'Setting password…' : 'Set password & continue'}
              </button>
            </form>
          </>
        )}

        {status === 'done' && (
          <>
            <div style={styles.successIcon}>✓</div>
            <h1 style={styles.title}>Password set</h1>
            <p style={styles.sub}>Taking you to the platform…</p>
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
    padding: '48px 44px', width: '100%', maxWidth: 420,
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
    width: '100%', display: 'flex',
    flexDirection: 'column', gap: 12,
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
    fontWeight: 600, margin: '4px 0',
  },
  link: {
    fontSize: 13, color: '#F07C00',
    fontWeight: 700, textDecoration: 'none',
    marginTop: 8,
  },
  successIcon: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'rgba(34,197,94,0.10)',
    border: '2px solid rgba(34,197,94,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, marginBottom: 16,
  },
};