// ThemeSwitch.tsx — System / Light / Dark. System is the default; an explicit
// choice is stored and applied as html[data-theme], which index.css keys off.

import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'sodmun_theme';

export function getTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {}
  return 'system';
}

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
}

const IconSystem = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IconSun    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
const IconMoon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;

const OPTIONS: { value: ThemeChoice; label: string; icon: JSX.Element }[] = [
  { value: 'system', label: 'System', icon: <IconSystem /> },
  { value: 'light',  label: 'Light',  icon: <IconSun /> },
  { value: 'dark',   label: 'Dark',   icon: <IconMoon /> },
];

/** Segmented control; `compact` renders one button that cycles (collapsed sidebar). */
export default function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>(getTheme);
  useEffect(() => { applyTheme(choice); }, [choice]);

  const css = `
    .theme-seg { display:flex; gap:2px; padding:3px; border-radius:99px; box-shadow:inset 0 0 0 1px var(--border); }
    .theme-seg button { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; height:28px; padding:0 6px; border:0; border-radius:99px; background:transparent; color:var(--text-muted); font-size:11.5px; min-width:0; white-space:nowrap; cursor:pointer; transition:background .3s var(--ease), color .3s var(--ease); }
    .theme-seg button:hover { color:var(--text-primary); }
    .theme-seg button[aria-pressed="true"] { background:var(--bg-3); color:var(--text-primary); box-shadow:var(--shadow-sm); }
  `;

  if (compact) {
    const i = OPTIONS.findIndex(o => o.value === choice);
    const cur = OPTIONS[i];
    const next = OPTIONS[(i + 1) % OPTIONS.length];
    return (
      <button className="bell-btn" onClick={() => setChoice(next.value)} title={`Theme: ${cur.label} (switch to ${next.label})`} aria-label={`Theme: ${cur.label}`}>
        {cur.icon}
      </button>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="theme-seg" role="group" aria-label="Theme">
        {OPTIONS.map(o => (
          <button key={o.value} type="button" aria-pressed={choice === o.value} onClick={() => setChoice(o.value)} title={o.label}>
            {o.icon}<span>{o.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
