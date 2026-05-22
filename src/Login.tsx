import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import logo from './assets/logo.png';
import munImg from './assets/mun.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); }
    else navigate('/');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: "'Manrope', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .login-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 60px;
          background: #FAFAF9;
          border-right: 1px solid rgba(0,0,0,0.07);
          box-sizing: border-box;
        }

        .login-right {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: #1A1008;
        }

        .login-box { width: 100%; max-width: 380px; }

        .login-logo { height: 52px; margin-bottom: 40px; }

        .login-eyebrow {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2.5px;
          color: #F07C00;
          margin-bottom: 10px;
        }

        .login-title {
          font-size: 30px;
          font-weight: 800;
          color: #18181B;
          margin: 0 0 8px 0;
          letter-spacing: -1px;
        }

        .login-subtitle {
          color: #71717A;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 36px;
          line-height: 1.5;
        }

        .login-input {
          width: 100%;
          min-height: 48px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.12);
          color: #18181B;
          padding: 0 16px;
          border-radius: 12px;
          font-family: 'Manrope', sans-serif;
          font-size: 14px;
          font-weight: 500;
          outline: none;
          transition: all 0.15s;
          box-sizing: border-box;
          display: block;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        .login-input:focus {
          border-color: #F07C00;
          box-shadow: 0 0 0 3px rgba(240,124,0,0.12), 0 1px 3px rgba(0,0,0,0.04);
        }

        .login-input::placeholder { color: #A1A1AA; }

        .login-btn {
          width: 100%;
          min-height: 48px;
          background: #F07C00;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 14px rgba(240,124,0,0.30);
          margin-top: 6px;
        }

        .login-btn:hover:not(:disabled) {
          background: #D46E00;
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(240,124,0,0.35);
        }

        .login-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .login-error {
          color: #DC2626;
          background: rgba(220,38,38,0.07);
          border: 1px solid rgba(220,38,38,0.18);
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-weight: 600;
          font-size: 13px;
        }

        .login-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.85;
          filter: brightness(0.9) contrast(1.05) saturate(0.9);
        }

        .login-image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(240,124,0,0.12) 0%,
            rgba(10,6,2,0.65) 100%
          );
        }

        .login-image-tag {
          position: absolute;
          bottom: 40px;
          left: 40px;
          color: rgba(255,255,255,0.55);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .login-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(0,0,0,0.08);
        }

        .login-divider-text {
          font-size: 11px;
          color: #A1A1AA;
          font-weight: 600;
          white-space: nowrap;
        }
      `}</style>

      {/* Left — Form */}
      <div className="login-left">
        <div className="login-box">
          <img src={logo} alt="SODMUN" className="login-logo" />
          <p className="login-eyebrow">SODMUN Intelligence Platform</p>
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to access the live conference platform.</p>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Delegation email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="login-input"
              required
            />
            <input
              type="password"
              placeholder="Passcode"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="login-input"
              required
            />
            <button type="submit" disabled={loading} className="login-btn">
              {loading ? 'Authenticating…' : 'Enter Platform'}
            </button>
          </form>
        </div>
      </div>

      {/* Right — Image */}
      <div className="login-right">
        <img src={munImg} alt="Model UN" className="login-image" />
        <div className="login-image-overlay" />
        <div className="login-image-tag">SODMUN · Dubai, UAE · June 2025</div>
      </div>
    </div>
  );
}