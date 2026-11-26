// SoddyBot.tsx — chat with Soddy AI (the "soddy" edge function, backed by Claude).

import React, { Fragment, useEffect, useRef, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { callSoddy } from './committeeApi';

type Msg = { role: 'user' | 'assistant'; content: string; error?: boolean };

const SUGGESTIONS = [
  'When is a motion to suspend debate in order?',
  'How do I write a strong operative clause?',
  'What would my delegation likely argue on this topic?',
  'How do I respond to a hostile point of information?',
];

const IconSpark = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/></svg>;
const IconSend  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;

/** Light formatting for replies: paragraphs, "-"/"1." lists and **bold**. Text stays text (no HTML). */
function Formatted({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every(l => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map(l => l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
          return ordered
            ? <ol key={i}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>
            : <ul key={i}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l.replace(/^#+\s*/, ''))}</Fragment>)}</p>;
      })}
    </>
  );
}

export default function SoddyBot() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [uses, setUses] = useState<number | null>(null);
  const [limit, setLimit] = useState<number | null>(50);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isChair = !!profile && profile.role !== 'Delegate';
  const left = isChair || limit === null ? null : Math.max(0, limit - (uses ?? 0));
  const limitReached = left === 0;

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('role, delegation, committee, soddy_uses').eq('id', user.id).single()
      .then(({ data }) => { if (data) { setProfile(data); setUses(data.soddy_uses ?? 0); if (data.role !== 'Delegate') setLimit(null); } });
  }, [user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy || limitReached) return;
    const history: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(history);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = '';
    setBusy(true);
    try {
      const res = await callSoddy(history.filter(m => !m.error).map(({ role, content }) => ({ role, content })));
      setMessages([...history, { role: 'assistant', content: res.reply }]);
      if (res.uses !== null && res.uses !== undefined) setUses(res.uses);
      if (res.limit !== undefined) setLimit(res.limit);
    } catch (e: any) {
      const msg = e?.status === 429
        ? `You've used all ${limit ?? 50} of your Soddy questions. Ask your chair if you need more.`
        : e?.data?.error || 'Soddy couldn’t answer just now. Try again.';
      if (e?.status === 429) setUses(limit ?? 50);
      setMessages([...history, { role: 'assistant', content: msg, error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="sb">
      <style>{CSS}</style>
      <header className="sb-head">
        <span className="sb-avatar"><IconSpark /></span>
        <span className="sb-who">
          <strong>Soddy AI</strong>
          <span>{busy ? 'typing…' : 'Procedure, research and drafting help'}</span>
        </span>
        {left !== null && <span className={`sb-left${limitReached ? ' is-out' : ''}`}>{limitReached ? 'No questions left' : `${left} question${left === 1 ? '' : 's'} left`}</span>}
      </header>

      <div className="sb-wall">
        {messages.length === 0 && (
          <div className="sb-intro">
            <span className="sb-avatar sb-avatar--big"><IconSpark /></span>
            <h1>Ask Soddy</h1>
            <p>Your MUN assistant for rules of procedure, research{profile?.delegation ? ` for ${profile.delegation}` : ''}, and drafting clauses and speeches.</p>
            <div className="sb-chips">
              {SUGGESTIONS.map(s => <button key={s} className="sb-chip" onClick={() => ask(s)} disabled={limitReached}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`sb-row ${m.role === 'user' ? 'me' : 'them'}`}>
            <div className={`sb-bubble${m.error ? ' is-error' : ''}`}>
              {m.role === 'assistant' ? <Formatted text={m.content} /> : m.content}
            </div>
          </div>
        ))}
        {busy && <div className="sb-row them"><div className="sb-bubble sb-typing" aria-label="Soddy is typing"><i /><i /><i /></div></div>}
        <div ref={endRef} />
      </div>

      <form className="sb-composer" onSubmit={e => { e.preventDefault(); ask(input); }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          disabled={limitReached}
          placeholder={limitReached ? 'Question limit reached' : 'Ask Soddy anything about MUN'}
          aria-label="Message Soddy"
          onChange={e => { setInput(e.target.value); e.currentTarget.style.height = ''; e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 140) + 'px'; }}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(input); } }}
        />
        <button type="submit" className="sb-send" disabled={!input.trim() || busy || limitReached} aria-label="Send"><IconSend /></button>
      </form>
    </div>
  );
}

const CSS = `
  .sb { display:flex; flex-direction:column; height:100vh; min-height:0; background:var(--bg); }
  .sb-head { display:flex; align-items:center; gap:12px; padding:10px 18px; min-height:62px; border-bottom:1px solid var(--border); background:var(--bg-2); }
  .sb-avatar { width:38px; height:38px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:rgba(var(--tint),0.08); color:var(--green-2); flex-shrink:0; }
  .sb-avatar--big { width:64px; height:64px; }
  .sb-avatar--big svg { width:28px; height:28px; }
  .sb-who { flex:1; min-width:0; display:flex; flex-direction:column; }
  .sb-who strong { font-size:15.5px; font-weight:500; color:var(--text-primary); }
  .sb-who span { font-size:12.5px; color:var(--text-muted); }
  .sb-left { font-size:12px; padding:4px 10px; border-radius:99px; background:rgba(var(--tint),0.06); color:var(--text-secondary); white-space:nowrap; }
  .sb-left.is-out { background:rgba(239,68,68,0.12); color:#EF4444; }

  .sb-wall { flex:1; overflow-y:auto; display:flex; flex-direction:column; padding:18px clamp(12px, 5vw, 72px); background-image:radial-gradient(rgba(var(--tint),0.05) 1px, transparent 1px); background-size:18px 18px; }
  .sb-intro { margin:auto; max-width:560px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; padding:20px 0; }
  .sb-intro h1 { font-size:44px; color:var(--text-primary); margin-top:6px; }
  .sb-intro p { font-size:15px; color:var(--text-muted); line-height:1.5; }
  .sb-chips { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px; margin-top:14px; width:100%; }
  .sb-chip { text-align:left; padding:12px 14px; border-radius:14px; border:1px solid var(--border); background:var(--bg-2); color:var(--text-primary); font-size:13.5px; line-height:1.4; cursor:pointer; transition:border-color .2s, background .2s; }
  .sb-chip:hover:not(:disabled) { border-color:var(--accent-border); background:var(--bg-3); }

  .sb-row { display:flex; margin-top:10px; max-width:min(80%, 680px); }
  .sb-row.me { align-self:flex-end; }
  .sb-row.them { align-self:flex-start; }
  .sb-bubble { padding:9px 12px; border-radius:12px; font-size:14.5px; line-height:1.5; color:var(--text-primary); box-shadow:0 1px 0.5px rgba(0,0,0,0.13); word-break:break-word; white-space:pre-wrap; }
  .them .sb-bubble { background:var(--bg-2); border-top-left-radius:3px; white-space:normal; }
  .me .sb-bubble { background:color-mix(in srgb, var(--green) 30%, var(--bg-2)); border-top-right-radius:3px; }
  .sb-bubble.is-error { background:rgba(239,68,68,0.10); color:#EF4444; }
  .sb-bubble p + p, .sb-bubble p + ul, .sb-bubble p + ol, .sb-bubble ul + p, .sb-bubble ol + p { margin-top:8px; }
  .sb-bubble ul, .sb-bubble ol { margin:6px 0 0; padding-left:20px; }
  .sb-bubble ul { list-style:disc; }
  .sb-bubble ol { list-style:decimal; }
  .sb-bubble li + li { margin-top:3px; }
  .sb-typing { display:inline-flex; gap:4px; padding:12px 14px; }
  .sb-typing i { width:6px; height:6px; border-radius:50%; background:var(--text-muted); animation:sb-dot 1.2s infinite ease-in-out; }
  .sb-typing i:nth-child(2) { animation-delay:.15s; }
  .sb-typing i:nth-child(3) { animation-delay:.3s; }
  @keyframes sb-dot { 0%, 80%, 100% { opacity:.3; transform:none; } 40% { opacity:1; transform:translateY(-3px); } }

  .sb-composer { display:flex; align-items:flex-end; gap:8px; padding:8px 12px 10px; background:var(--bg-2); border-top:1px solid var(--border); }
  .sb-composer textarea { flex:1; margin:0; min-height:44px; max-height:140px; padding:11px 16px; border-radius:22px !important; border:0 !important; background:var(--bg) !important; resize:none; font-size:15px; line-height:1.4; box-shadow:none !important; }
  .sb-composer textarea:focus-visible { outline:none; }
  .sb-send { width:44px; height:44px; border-radius:50%; border:0; background:var(--green); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; }
  .sb-send:disabled { opacity:.4; cursor:default; }

  @media (max-width: 768px) {
    .sb { height:calc(100dvh - 60px - env(safe-area-inset-bottom)); }
    .sb-chips { grid-template-columns:1fr; }
    .sb-row { max-width:88%; }
  }
`;
