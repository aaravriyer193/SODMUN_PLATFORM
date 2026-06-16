import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Delegate {
  id: string;
  name: string;
  spoken: boolean;
  speaking: boolean;
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const IconPlay    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>;
const IconPause   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/></svg>;
const IconReset   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.08"/></svg>;
const IconNext    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/><line x1="20" y1="6" x2="20" y2="18"/></svg>;
const IconPlus    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconTrash   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
const IconCheck   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconGrip    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="18" r="1" fill="currentColor"/><circle cx="15" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/></svg>;
const IconClearAll = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>;
const IconShuffle = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const formatTime = (seconds: number) => {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  const prefix = seconds < 0 ? '-' : '';
  return `${prefix}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// SVG circle arc for countdown ring
const RADIUS = 112;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CircleProgress = ({ ratio, overtime }: { ratio: number; overtime: boolean }) => {
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, ratio)));
  return (
    <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
      {/* Track */}
      <circle cx="140" cy="140" r={RADIUS} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="8" />
      {/* Progress */}
      <circle
        cx="140" cy="140" r={RADIUS}
        fill="none"
        stroke={overtime ? '#DC2626' : '#F07C00'}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s' }}
      />
    </svg>
  );
};

// ─── PRESET TIMES ─────────────────────────────────────────────────────────────
const PRESETS = [
  { label: '30s', value: 30 },
  { label: '1m',  value: 60 },
  { label: '90s', value: 90 },
  { label: '2m',  value: 120 },
  { label: '3m',  value: 180 },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SpeakersTimer() {
  const [delegates, setDelegates]   = useState<Delegate[]>(() => {
    try { return JSON.parse(localStorage.getItem('gsl_delegates') || '[]'); } catch { return []; }
  });
  const [newName, setNewName]       = useState('');
  const [duration, setDuration]     = useState<number>(() => {
    const v = parseInt(localStorage.getItem('gsl_duration') || '90', 10);
    return isNaN(v) ? 90 : v;
  });
  const [customInput, setCustomInput] = useState('');
  const [timeLeft, setTimeLeft]     = useState<number>(() => {
    const v = parseInt(localStorage.getItem('gsl_duration') || '90', 10);
    return isNaN(v) ? 90 : v;
  });
  const [running, setRunning]       = useState(false);
  const [activeId, setActiveId]     = useState<string | null>(() =>
    localStorage.getItem('gsl_activeId') ?? null
  );
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editVal, setEditVal]       = useState('');
  const [pulse, setPulse]           = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const editRef     = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Current active delegate
  const active = delegates.find(d => d.id === activeId) ?? null;
  const overtime = timeLeft < 0;
  const ratio = duration > 0 ? timeLeft / duration : 0;
  const spokeCount = delegates.filter(d => d.spoken).length;
  const remainingCount = delegates.filter(d => !d.spoken).length;

  // ── Timer tick ──
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t === 0) setPulse(true);
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  useEffect(() => {
    if (pulse) {
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [pulse]);

  // ── Persist to localStorage ──
  useEffect(() => {
    localStorage.setItem('gsl_delegates', JSON.stringify(delegates));
  }, [delegates]);
  useEffect(() => {
    localStorage.setItem('gsl_duration', String(duration));
  }, [duration]);
  useEffect(() => {
    if (activeId) localStorage.setItem('gsl_activeId', activeId);
    else localStorage.removeItem('gsl_activeId');
  }, [activeId]);

  // ── Set active speaker ──
  const setActiveSpeaker = (id: string) => {
    setRunning(false);
    setTimeLeft(duration);
    setActiveId(id);
    setDelegates(prev => prev.map(d => ({ ...d, speaking: d.id === id })));
  };

  // ── Mark spoke & move to next ──
  const markSpokenAndNext = useCallback(() => {
    if (!activeId) return;
    setRunning(false);

    setDelegates(prev => {
      const updated = prev.map(d =>
        d.id === activeId ? { ...d, spoken: true, speaking: false } : d
      );
      // Find next unspoken
      const currentIdx = updated.findIndex(d => d.id === activeId);
      const next = updated.slice(currentIdx + 1).find(d => !d.spoken)
        ?? updated.slice(0, currentIdx).find(d => !d.spoken);

      if (next) {
        setActiveId(next.id);
        setTimeLeft(duration);
        return updated.map(d => ({ ...d, speaking: d.id === next.id }));
      } else {
        setActiveId(null);
        setTimeLeft(duration);
        return updated.map(d => ({ ...d, speaking: false }));
      }
    });
  }, [activeId, duration]);

  // ── Add delegate ──
  const addDelegate = () => {
    const name = newName.trim();
    if (!name) return;
    setDelegates(prev => [...prev, { id: uid(), name, spoken: false, speaking: false }]);
    setNewName('');
    inputRef.current?.focus();
  };

  // ── Remove delegate ──
  const removeDelegate = (id: string) => {
    if (activeId === id) {
      setActiveId(null);
      setRunning(false);
      setTimeLeft(duration);
    }
    setDelegates(prev => prev.filter(d => d.id !== id));
  };

  // ── Toggle spoken ──
  const toggleSpoken = (id: string) => {
    setDelegates(prev => prev.map(d => d.id === id ? { ...d, spoken: !d.spoken } : d));
  };

  // ── Set duration ──
  const applyDuration = (val: number) => {
    setDuration(val);
    setTimeLeft(val);
    setRunning(false);
  };

  // ── Reset timer ──
  const resetTimer = () => {
    setRunning(false);
    setTimeLeft(duration);
  };

  // ── Clear all spoken ──
  const resetSpoken = () => {
    setDelegates(prev => prev.map(d => ({ ...d, spoken: false, speaking: false })));
    setActiveId(null);
    setRunning(false);
    setTimeLeft(duration);
  };

  // ── Shuffle delegates ──
  const shuffle = () => {
    setDelegates(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  };

  // ── Inline edit ──
  const startEdit = (d: Delegate) => {
    setEditingId(d.id);
    setEditVal(d.name);
    setTimeout(() => editRef.current?.select(), 30);
  };
  const commitEdit = () => {
    if (!editingId) return;
    setDelegates(prev => prev.map(d => d.id === editingId ? { ...d, name: editVal.trim() || d.name } : d));
    setEditingId(null);
  };

  // ── Custom time input ──
  const applyCustom = () => {
    const parts = customInput.trim().split(':');
    let secs = 0;
    if (parts.length === 2) {
      secs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
      secs = parseInt(parts[0]);
    }
    if (!isNaN(secs) && secs > 0) {
      applyDuration(secs);
      setCustomInput('');
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--bg-base)', fontFamily: "'Manrope', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .timer-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          border: none; cursor: pointer; font-family: 'Manrope', sans-serif;
          font-weight: 700; transition: all 0.15s ease; border-radius: 12px;
        }
        .timer-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .preset-chip {
          padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 700;
          border: 1.5px solid rgba(0,0,0,0.10); background: var(--bg-surface);
          color: #52525B; cursor: pointer; transition: all 0.12s; font-family: 'Manrope', sans-serif;
        }
        .preset-chip:hover { border-color: rgba(240,124,0,0.4); color: #E07000; background: rgba(240,124,0,0.06); }
        .preset-chip.active { background: #F07C00; color: #fff; border-color: #F07C00; box-shadow: 0 3px 10px rgba(240,124,0,0.30); }

        .delegate-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 11px;
          border: 1px solid transparent;
          cursor: pointer; transition: all 0.12s;
          position: relative;
        }
        .delegate-row:hover { background: var(--bg-elevated); border-color: rgba(0,0,0,0.07); }
        .delegate-row.is-active { background: rgba(240,124,0,0.08); border-color: rgba(240,124,0,0.25); }
        .delegate-row.is-spoken { opacity: 0.55; }
        .delegate-row.is-spoken:hover { opacity: 0.75; }

        .check-box {
          width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
          border: 2px solid rgba(0,0,0,0.15); background: transparent;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; cursor: pointer;
        }
        .check-box.checked { background: #22C55E; border-color: #22C55E; }

        .add-input {
          flex: 1; border: 1.5px solid rgba(0,0,0,0.10); border-radius: 10px;
          padding: 10px 12px; font-size: 13px; font-weight: 600;
          font-family: 'Manrope', sans-serif; background: var(--bg-elevated);
          color: #18181B; outline: none; transition: all 0.15s;
        }
        .add-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(240,124,0,0.10); background: var(--bg-elevated); }
        .add-input::placeholder { color: #A1A1AA; font-weight: 500; }

        .custom-time-input {
          width: 80px; border: 1.5px solid rgba(0,0,0,0.10); border-radius: 8px;
          padding: 6px 10px; font-size: 12px; font-weight: 700;
          font-family: 'JetBrains Mono', monospace; background: var(--bg-elevated);
          color: #18181B; outline: none; text-align: center; transition: all 0.15s;
        }
        .custom-time-input:focus { border-color: #F07C00; box-shadow: 0 0 0 2px rgba(240,124,0,0.12); }
        .custom-time-input::placeholder { color: #C4C4C4; }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.35); }
          70% { box-shadow: 0 0 0 18px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
        .overtime-pulse { animation: pulse-ring 0.6s ease-out; }

        @keyframes fade-in { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: none; } }
        .delegate-row { animation: fade-in 0.18s ease; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 99px; }
      `}</style>

      {/* ═══ LEFT PANEL — Delegate List ══════════════════════════════════════ */}
      <aside style={{
        width: 300, flexShrink: 0,
        background: 'var(--bg-sidebar)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 16px 20px',
        boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
        overflowY: 'hidden',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.2px', color: '#F07C00', marginBottom: 4 }}>
            Speakers List
          </p>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
            Delegates
          </h2>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.10)', borderRadius: 99, padding: '3px 10px' }}>
              {spokeCount} spoke
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#F07C00', background: 'rgba(240,124,0,0.10)', borderRadius: 99, padding: '3px 10px' }}>
              {remainingCount} remaining
            </span>
          </div>
        </div>

        {/* Add delegate */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            ref={inputRef}
            className="add-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDelegate()}
            placeholder="Add delegate…"
          />
          <button
            className="timer-btn"
            onClick={addDelegate}
            disabled={!newName.trim()}
            style={{
              width: 38, height: 38, flexShrink: 0,
              background: newName.trim() ? '#F07C00' : 'rgba(0,0,0,0.06)',
              color: newName.trim() ? '#fff' : '#A1A1AA',
              boxShadow: newName.trim() ? '0 3px 10px rgba(240,124,0,0.28)' : 'none',
            }}
          ><IconPlus /></button>
        </div>

        {/* Delegate list */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {delegates.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>🎤</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>No delegates yet</p>
              <p style={{ fontSize: 11, color: '#C4C4C4', fontWeight: 500, textAlign: 'center', marginTop: 4 }}>Add delegation names above</p>
            </div>
          )}
          {delegates.map((d, i) => (
            <div
              key={d.id}
              className={`delegate-row ${d.id === activeId ? 'is-active' : ''} ${d.spoken ? 'is-spoken' : ''}`}
              onClick={() => !d.spoken && setActiveSpeaker(d.id)}
            >
              {/* Grip */}
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, cursor: 'grab' }}><IconGrip /></span>

              {/* Order number */}
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>

              {/* Checkmark */}
              <div
                className={`check-box ${d.spoken ? 'checked' : ''}`}
                onClick={e => { e.stopPropagation(); toggleSpoken(d.id); }}
              >
                {d.spoken && <IconCheck />}
              </div>

              {/* Name — double-click to edit */}
              {editingId === d.id ? (
                <input
                  ref={editRef}
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, border: '1.5px solid #F07C00', borderRadius: 6, padding: '3px 7px', fontSize: 13, fontWeight: 600, fontFamily: 'Manrope, sans-serif', outline: 'none', background: '#fff', color: 'var(--text-primary)' }}
                />
              ) : (
                <span
                  onDoubleClick={e => { e.stopPropagation(); startEdit(d); }}
                  style={{
                    flex: 1, fontSize: 13, fontWeight: d.id === activeId ? 700 : 600,
                    color: d.spoken ? '#A1A1AA' : d.id === activeId ? '#E07000' : '#27272A',
                    textDecoration: d.spoken ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: d.spoken ? 'default' : 'pointer',
                  }}
                  title="Double-click to rename"
                >
                  {d.name}
                </span>
              )}

              {/* Speaking indicator */}
              {d.id === activeId && !d.spoken && (
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: '#F07C00', background: 'rgba(240,124,0,0.12)', borderRadius: 99, padding: '2px 7px', flexShrink: 0 }}>Now</span>
              )}

              {/* Remove btn */}
              <button
                onClick={e => { e.stopPropagation(); removeDelegate(d.id); }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 3, borderRadius: 5, transition: 'all 0.1s', flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#DC2626'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#D4D4D8'}
                title="Remove"
              ><IconTrash /></button>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        {delegates.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: 12, marginTop: 10, display: 'flex', gap: 6 }}>
            <button
              className="timer-btn"
              onClick={shuffle}
              style={{ flex: 1, padding: '9px 0', fontSize: 11, background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.08)' }}
            >
              <IconShuffle /> Shuffle
            </button>
            <button
              className="timer-btn"
              onClick={resetSpoken}
              style={{ flex: 1, padding: '9px 0', fontSize: 11, background: 'rgba(0,0,0,0.04)', color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.08)' }}
            >
              <IconClearAll /> Reset All
            </button>
          </div>
        )}
      </aside>

      {/* ═══ MAIN — Timer ════════════════════════════════════════════════════ */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 32, position: 'relative', overflow: 'hidden' }}>

        {/* Background ambient glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: overtime
            ? 'radial-gradient(ellipse at 50% 40%, rgba(220,38,38,0.07) 0%, transparent 65%)'
            : running
              ? 'radial-gradient(ellipse at 50% 40%, rgba(240,124,0,0.08) 0%, transparent 65%)'
              : 'radial-gradient(ellipse at 50% 40%, rgba(240,124,0,0.04) 0%, transparent 65%)',
          transition: 'background 0.6s ease',
        }} />

        {/* Current speaker badge */}
        <div style={{ zIndex: 1, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {active ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(240,124,0,0.22)', borderRadius: 99,
              padding: '8px 20px',
              boxShadow: '0 4px 16px rgba(240,124,0,0.12)',
            }}>
              {/* Pulsing dot */}
              {running && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: overtime ? '#DC2626' : '#F07C00', display: 'block', flexShrink: 0, animation: 'liveDot 1.2s ease infinite' }} />
              )}
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                {active.name}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>speaking</span>
            </div>
          ) : (
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
              {delegates.length === 0 ? 'Add delegates to get started' : 'Select a delegate to begin'}
            </p>
          )}
        </div>

        {/* ── Timer circle ── */}
        <div
          className={pulse ? 'overtime-pulse' : ''}
          style={{
            position: 'relative', width: 280, height: 280,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
            borderRadius: '50%',
            background: 'var(--bg-surface)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <CircleProgress ratio={ratio} overtime={overtime} />

          {/* Time display */}
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 54, fontWeight: 700,
              color: overtime ? '#DC2626' : '#18181B',
              letterSpacing: '-2px', lineHeight: 1,
              transition: 'color 0.3s',
            }}>
              {formatTime(timeLeft)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: overtime ? '#DC2626' : '#A1A1AA', marginTop: 6, transition: 'color 0.3s' }}>
              {overtime ? 'Overtime' : running ? 'Speaking' : 'Ready'}
            </div>
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
          {/* Reset */}
          <button
            className="timer-btn"
            onClick={resetTimer}
            style={{ width: 44, height: 44, background: 'var(--bg-elevated)', border: '1px solid rgba(0,0,0,0.10)', color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            title="Reset timer"
          ><IconReset /></button>

          {/* Play / Pause */}
          <button
            className="timer-btn"
            onClick={() => setRunning(r => !r)}
            disabled={!activeId}
            style={{
              width: 68, height: 68,
              background: activeId ? '#F07C00' : 'rgba(0,0,0,0.07)',
              color: activeId ? '#fff' : '#A1A1AA',
              fontSize: 14,
              boxShadow: activeId ? '0 6px 20px rgba(240,124,0,0.35)' : 'none',
              borderRadius: 20,
            }}
          >
            {running ? <IconPause /> : <IconPlay />}
          </button>

          {/* Next */}
          <button
            className="timer-btn"
            onClick={markSpokenAndNext}
            disabled={!activeId}
            style={{ width: 44, height: 44, background: 'var(--bg-elevated)', border: '1px solid rgba(0,0,0,0.10)', color: 'var(--text-secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            title="Mark spoken & next"
          ><IconNext /></button>
        </div>

        {/* ── Duration presets ── */}
        <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <p style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#BABABA' }}>Speech Duration</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {PRESETS.map(p => (
              <button
                key={p.value}
                className={`preset-chip ${duration === p.value ? 'active' : ''}`}
                onClick={() => applyDuration(p.value)}
              >
                {p.label}
              </button>
            ))}
            {/* Custom */}
            <div style={{ display: 'flex', gap: 5 }}>
              <input
                className="custom-time-input"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyCustom()}
                placeholder="mm:ss"
              />
              <button
                className="preset-chip"
                onClick={applyCustom}
                style={{ padding: '6px 12px' }}
              >Set</button>
            </div>
          </div>
        </div>

        {/* ── Progress bar for list ── */}
        {delegates.length > 0 && (
          <div style={{ zIndex: 1, width: '100%', maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)' }}>List Progress</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{spokeCount} / {delegates.length}</span>
            </div>
            <div style={{ height: 5, background: 'rgba(0,0,0,0.07)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: delegates.length > 0 && spokeCount === delegates.length ? '#22C55E' : '#F07C00',
                width: `${delegates.length > 0 ? (spokeCount / delegates.length) * 100 : 0}%`,
                transition: 'width 0.4s ease, background 0.3s',
              }} />
            </div>
          </div>
        )}

        <style>{`
          @media (max-width:768px) {
            .timer-btn { border-radius:10px; }
            .preset-chip { padding:5px 10px; font-size:11px; }
          }
          @keyframes liveDot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(0.7); }
          }
        `}</style>
      </main>
    </div>
  );
}