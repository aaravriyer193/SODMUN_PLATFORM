// DelegateAccess.tsx — chair card: give a delegate a new access code.
// Shown on the chair dashboard. The code is displayed once; it isn't stored anywhere readable.

import { useEffect, useState } from 'react';
import { supabase } from './api';
import { resetAccessCode } from './committeeApi';

export default function DelegateAccess({ committee }: { committee: string }) {
  const [people, setPeople] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ name: string; email: string; code: string } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.from('users').select('id, email, delegation, role')
      .eq('committee', committee).eq('role', 'Delegate').order('delegation', { ascending: true })
      .then(({ data }) => setPeople(data || []));
  }, [committee]);

  const shown = people.filter(p => !q.trim() || `${p.delegation} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()));

  const reset = async (p: any) => {
    const name = p.delegation || p.email;
    if (!window.confirm(`Give ${name} a new access code? Their current code will stop working.`)) return;
    setBusyId(p.id); setError('');
    try {
      const r = await resetAccessCode(p.id);
      setIssued({ name, email: r.email, code: r.code });
      setCopied(false);
    } catch (e: any) {
      setError(e.message || 'Could not reset the code.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="db-card da">
      <style>{CSS}</style>
      <div className="db-card__head">
        <h2>Delegate access</h2>
        <span className="da-count">{people.length}</span>
      </div>
      <div className="da-search">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a delegation" aria-label="Find a delegation" />
      </div>
      {error && <p className="da-error" role="alert">{error}</p>}
      <ul className="da-list">
        {shown.map(p => (
          <li key={p.id}>
            <span className="da-who"><strong>{p.delegation || 'Delegate'}</strong><small>{p.email}</small></span>
            <button className="da-btn" onClick={() => reset(p)} disabled={busyId === p.id}>{busyId === p.id ? 'Working…' : 'New code'}</button>
          </li>
        ))}
        {shown.length === 0 && <li className="da-none">{people.length ? 'No match.' : 'No delegates in this committee yet.'}</li>}
      </ul>

      {issued && (
        <div className="overlay" onClick={() => setIssued(null)}>
          <div className="modal da-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={`New access code for ${issued.name}`}>
            <h2>New code for {issued.name}</h2>
            <p className="da-modal__sub">Give this to the delegate. They sign in with <strong>{issued.email}</strong> and this code. It’s only shown now.</p>
            <div className="da-code">{issued.code}</div>
            <div className="da-modal__actions">
              <button className="primary-btn" onClick={async () => { try { await navigator.clipboard.writeText(issued.code); setCopied(true); } catch {} }}>
                {copied ? 'Copied' : 'Copy code'}
              </button>
              <button className="logout-btn" style={{ marginTop: 0, height: 44 }} onClick={() => setIssued(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
  .da-count { font-family:var(--mono); font-size:11px; color:var(--text-muted); padding:2px 8px; border-radius:99px; background:rgba(var(--tint),0.05); }
  .da-search { padding:12px 16px 4px; }
  .da-search input { margin:0; height:40px; padding:0 14px; border-radius:99px !important; font-size:14px; }
  .da-error { margin:8px 16px 0; font-size:13px; color:#EF4444; }
  .da-list { list-style:none; margin:0; padding:6px 0 8px; max-height:340px; overflow-y:auto; }
  .da-list li { display:flex; align-items:center; gap:12px; padding:9px 16px; }
  .da-list li + li { border-top:1px solid var(--border); }
  .da-who { flex:1; min-width:0; display:flex; flex-direction:column; }
  .da-who strong { font-size:14px; font-weight:500; color:var(--text-primary); }
  .da-who small { font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .da-btn { flex-shrink:0; height:32px; padding:0 14px; border-radius:99px; border:0; box-shadow:inset 0 0 0 1px var(--border-strong); background:transparent; color:var(--text-primary); font-size:12.5px; cursor:pointer; }
  .da-btn:hover:not(:disabled) { background:var(--ink); color:var(--bg); box-shadow:none; }
  .da-btn:disabled { opacity:.5; cursor:default; }
  .da-none { color:var(--text-muted); font-size:13px; }
  .da-modal { max-width:440px; display:flex; flex-direction:column; gap:14px; }
  .da-modal h2 { margin:0; }
  .da-modal__sub { font-size:14px; color:var(--text-muted); line-height:1.5; }
  .da-code { font-family:var(--mono); font-size:30px; letter-spacing:.14em; text-align:center; padding:18px 12px; border-radius:14px; background:rgba(var(--tint),0.06); color:var(--text-primary); user-select:all; }
  .da-modal__actions { display:flex; gap:10px; }
  .da-modal__actions > button { flex:1; justify-content:center; }
`;
