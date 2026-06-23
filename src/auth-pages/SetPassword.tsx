// SetPassword.tsx — /set-password?token=...
// Completely isolated — no app shell, no nav links.
// Delegate lands here from their Loops invite email.
//
// Token strategy: extract token from URL and persist to localStorage.
// Do NOT consume (call setSession) until submit.
// If URL contains #error=..., Supabase rejected the token server-side —
// only allow through if we have a previously saved valid token in localStorage
// (same link clicked again on same device). Otherwise show expired screen.

import React, { useState, useEffect } from 'react';
import { supabase } from '../api';

const STORAGE_KEY = 'sodmun_invite_tokens';

function saveTokens(data: object) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() })); } catch {}
}

function loadSaved(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > 11 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function clearTokens() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export default function SetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [status, setStatus]     = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [ready, setReady]       = useState<boolean|null>(null);

  useEffect(() => {
    const hash   = window.location.hash;
    const search = window.location.search;
    const hashParams = new URLSearchParams(hash.replace('#', '?'));

    // ── Case 0: Supabase returned an error in the hash ───────────────────
    // e.g. #error=access_denied&error_code=otp_expired
    // The one-time token was already consumed (by a bot/preview) before the
    // user clicked. Only rescue this if we have a previously saved token
    // in localStorage from a prior visit on this device.
    if (hashParams.get('error')) {
      window.history.replaceState(null, '', window.location.pathname);
      const saved = loadSaved();
      if (saved) {
        // Same device, same link — saved token still valid, let them through
        setReady(true);
      } else {
        setReady(false);
        setErrorMsg('This invite link has already been used or has expired. Request a new one below.');
      }
      return;
    }

    // ── Case 1: fresh URL with hash tokens ───────────────────────────────
    const accessToken  = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type         = hashParams.get('type');

    if (accessToken && refreshToken && type === 'invite') {
      saveTokens({ access: accessToken, refresh: refreshToken });
      window.history.replaceState(null, '', window.location.pathname);
      setReady(true);
      return;
    }

    // ── Case 2: fresh URL with token_hash query param ────────────────────
    const sp        = new URLSearchParams(search);
    const tokenHash = sp.get('token');

    if (tokenHash) {
      saveTokens({ tokenHash });
      window.history.replaceState(null, '', window.location.pathname);
      setReady(true);
      return;
    }

    // ── Case 3: no token in URL — check localStorage ─────────────────────
    // Only passes if they previously visited this page with a real token
    const saved = loadSaved();
    if (saved) {
      setReady(true);
      return;
    }

    // Nothing at all
    setReady(false);
    setErrorMsg('No invite token found. Please click the link from your email.');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return; }

    setStatus('loading');

    let sessionOk = false;

    const saved = loadSaved();
    if (saved?.access && saved?.refresh) {
      const { error } = await supabase.auth.setSession({ access_token: saved.access, refresh_token: saved.refresh });
      if (!error) sessionOk = true;
    } else if (saved?.tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: saved.tokenHash, type: 'invite' });
      if (!error) sessionOk = true;
    }

    // Fallback: active session already exists
    if (!sessionOk) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) sessionOk = true;
    }

    if (!sessionOk) {
      setStatus('error');
      setErrorMsg('Your invite link has expired. Please request a new one below.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }

    clearTokens();
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

        {ready === null && (
          <p style={styles.sub}>Verifying your link…</p>
        )}

        {ready === false && (
          <>
            <h1 style={styles.title}>Link expired</h1>
            <p style={styles.sub}>{errorMsg}</p>
            <a href="https://app.sodmun.com/forgot" style={styles.link}>
              Request a new link →
            </a>
          </>
        )}

        {ready === true && status !== 'done' && (
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