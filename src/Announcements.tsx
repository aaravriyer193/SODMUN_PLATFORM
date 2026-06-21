// Announcements.tsx — platform-wide announcements
//
// Stored in the existing `messages` table with a special
// recipient_group = '__announcements__'. This deliberately reuses
// all the polling/RLS/backoff infrastructure already built for chat —
// no new tables, no new poll loop, no new Edge Function action.
//
// Read: any authenticated user, any committee (see RLS policy
// "Everyone can read announcements").
// Write: only users with role = 'Admin' (see RLS policy
// "Only admins can post announcements"). This is a NEW role value,
// additive only — it does NOT affect the existing isChair binary
// (role !== 'Delegate') used everywhere else in the app. An Admin
// is not automatically a chair anywhere.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import {
  subscribeToMessagePoll, triggerImmediatePoll,
  createPoll, closePoll, deletePoll, getPolls, getPollVotes, castVote, removeVote, type PollOption,
  uploadAnnouncementPhoto,
} from './committeeApi';

const ANNOUNCEMENTS_ROOM = '__announcements__';

const IconMegaphone = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>;
const IconSend      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconTrash     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const IconImage     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconPoll      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="14"/></svg>;
const IconPlus      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconX         = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCheck     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconLock2     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;

// ── Rich text composer ─────────────────────────────────────────────────────────
// contentEditable + document.execCommand — same lightweight approach used by
// the resolution editor (EditableBlock in Resolutions.tsx), kept consistent
// rather than pulling in a heavy rich-text dependency. Stores HTML in
// `content` (rendered with dangerouslySetInnerHTML on read), same column,
// same table — no schema change needed.

const IconBold       = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></svg>;
const IconItalic     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>;
const IconUnderline  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>;
const IconStrike     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><path d="M16 6.5a4 4 0 0 0-3.5-2c-2.5 0-4 1.3-4 3 0 1.5 1 2.3 2.5 2.7M8 17.5a4 4 0 0 0 3.5 2c2.5 0 4-1.3 4-3 0-1-.5-1.8-1.5-2.3"/></svg>;
const IconBulletList = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/></svg>;
const IconNumList    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M4 14a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1c0 .5-.3.8-.6 1.1L4 18h3"/></svg>;
const IconLink       = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/></svg>;
const IconQuote      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1.5 7-7V8H4v6h3c0 4-3 5-4 5z"/><path d="M14 21c3 0 7-1.5 7-7V8h-6v6h3c0 4-3 5-4 5z"/></svg>;
const IconClear      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/><line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5"/></svg>;

const FORMAT_BUTTONS = [
  { cmd: 'bold',          icon: IconBold,      title: 'Bold (⌘B)' },
  { cmd: 'italic',        icon: IconItalic,    title: 'Italic (⌘I)' },
  { cmd: 'underline',     icon: IconUnderline, title: 'Underline (⌘U)' },
  { cmd: 'strikeThrough', icon: IconStrike,    title: 'Strikethrough' },
] as const;

// ── Poll creation modal ──────────────────────────────────────────────────────
function PollModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions]   = useState(['', '']);
  const [multiSelect, setMultiSelect] = useState(false);
  const [creating, setCreating] = useState(false);

  const updateOption = (i: number, val: string) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o));
  };
  const addOption = () => { if (options.length < 8) setOptions(prev => [...prev, '']); };
  const removeOption = (i: number) => { if (options.length > 2) setOptions(prev => prev.filter((_, idx) => idx !== i)); };

  const canCreate = question.trim().length > 0 && options.filter(o => o.trim()).length >= 2;

  const handleCreate = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const cleanOptions: PollOption[] = options
        .map((label, i) => ({ id: String.fromCharCode(97 + i), label: label.trim() }))
        .filter(o => o.label.length > 0);
      await createPoll(question.trim(), cleanOptions, multiSelect);
      onCreated();
      onClose();
    } catch (e) {
      console.error('Failed to create poll:', e);
    }
    setCreating(false);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:18, padding:24, width:'100%', maxWidth:480, boxShadow:'var(--shadow-xl)', maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <h3 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8, margin:0 }}>
            <IconPoll /> New Poll
          </h3>
          <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><IconX /></button>
        </div>

        <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)', display:'block', marginBottom:6 }}>Question</label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="e.g. Should we extend lunch by 15 minutes?"
          style={{ width:'100%', padding:'10px 12px', borderRadius:9, border:'1px solid var(--border)', background:'var(--bg-input)', color:'var(--text-primary)', fontSize:14, fontFamily:'Manrope,sans-serif', outline:'none', boxSizing:'border-box', marginBottom:16 }}
        />

        <label style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text-muted)', display:'block', marginBottom:6 }}>Options</label>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                value={opt}
                onChange={e => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                style={{ flex:1, padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-input)', color:'var(--text-primary)', fontSize:13, fontFamily:'Manrope,sans-serif', outline:'none' }}
              />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, flexShrink:0 }}><IconX /></button>
              )}
            </div>
          ))}
        </div>
        {options.length < 8 && (
          <button onClick={addOption} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'var(--accent)', background:'transparent', border:'none', cursor:'pointer', padding:'4px 0', marginBottom:16 }}>
            <IconPlus /> Add option
          </button>
        )}

        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'var(--text-secondary)', fontWeight:600, marginBottom:20, cursor:'pointer' }}>
          <input type="checkbox" checked={multiSelect} onChange={e => setMultiSelect(e.target.checked)} style={{ width:16, height:16, accentColor:'var(--accent)' }} />
          Allow selecting multiple options
        </label>

        <button
          onClick={handleCreate}
          disabled={!canCreate || creating}
          style={{
            width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontSize:13, fontWeight:700, padding:'11px', borderRadius:10, border:'none',
            cursor: canCreate && !creating ? 'pointer' : 'not-allowed',
            background:'var(--accent)', color:'#fff', opacity: canCreate && !creating ? 1 : 0.5,
            fontFamily:'Manrope,sans-serif', boxShadow:'0 2px 8px rgba(240,124,0,0.25)',
          }}
        >
          <IconPoll /> {creating ? 'Creating…' : 'Create Poll'}
        </button>
      </div>
    </div>
  );
}

// ── Poll display card — live results, voting ─────────────────────────────────
function PollCard({ poll, authUserId, isAdmin, onChanged }: { poll: any; authUserId: string | undefined; isAdmin: boolean; onChanged: () => void }) {
  const [votes, setVotes] = useState<any[]>([]);
  const [voting, setVoting] = useState(false);

  const loadVotes = useCallback(async () => {
    try { setVotes(await getPollVotes(poll.id)); } catch (e) { console.error(e); }
  }, [poll.id]);

  useEffect(() => { loadVotes(); }, [loadVotes]);

  // Live updates via realtime — polls benefit from instant feedback since
  // results changing live is the whole point of watching a poll
  useEffect(() => {
    const channel = supabase.channel(`poll_${poll.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${poll.id}` }, () => {
        loadVotes();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [poll.id, loadVotes]);

  const myVotes = votes.filter(v => v.user_id === authUserId).map(v => v.option_id);
  const totalVoters = new Set(votes.map(v => v.user_id)).size;

  const handleVote = async (optionId: string) => {
    if (!authUserId || poll.closed || voting) return;
    setVoting(true);
    try {
      if (myVotes.includes(optionId)) {
        await removeVote(poll.id, authUserId, optionId);
      } else {
        await castVote(poll.id, authUserId, optionId, poll.multi_select);
      }
      await loadVotes();
    } catch (e) { console.error('Vote failed:', e); }
    setVoting(false);
  };

  const handleClose = async () => { await closePoll(poll.id); onChanged(); };
  const handleDelete = async () => { await deletePoll(poll.id); onChanged(); };

  const counts: Record<string, number> = {};
  poll.options.forEach((o: PollOption) => { counts[o.id] = votes.filter(v => v.option_id === o.id).length; });
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:14, padding:'18px 20px', boxShadow:'var(--shadow-sm)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14, gap:10 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, flex:1, minWidth:0 }}>
          <div style={{ width:26, height:26, borderRadius:8, background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', flexShrink:0, marginTop:1 }}>
            <IconPoll />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0, lineHeight:1.4 }}>{poll.question}</p>
            <p style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500, marginTop:4 }}>
              {totalVoters} {totalVoters === 1 ? 'vote' : 'votes'} · {poll.closed ? 'Closed' : (poll.multi_select ? 'Choose any' : 'Choose one')}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            {!poll.closed && (
              <button onClick={handleClose} title="Close poll" style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:5, borderRadius:6 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}>
                <IconLock2 />
              </button>
            )}
            <button onClick={handleDelete} title="Delete poll" style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:5, borderRadius:6 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#DC2626'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}>
              <IconTrash />
            </button>
          </div>
        )}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {poll.options.map((opt: PollOption) => {
          const count = counts[opt.id] || 0;
          const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
          const selected = myVotes.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.id)}
              disabled={poll.closed || voting}
              style={{
                position:'relative', textAlign:'left', padding:'10px 14px', borderRadius:10,
                border: selected ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background:'var(--bg-surface)', cursor: poll.closed ? 'default' : 'pointer',
                overflow:'hidden', fontFamily:'Manrope,sans-serif',
              }}
            >
              {/* Fill bar */}
              <div style={{
                position:'absolute', inset:0, width:`${pct}%`,
                background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                transition:'width 0.3s ease', zIndex:0,
              }} />
              <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                <span style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color: selected ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {selected && <IconCheck />} {opt.label}
                </span>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>{pct}% · {count}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const RichComposer = React.forwardRef<{ insertImage: (url: string) => void }, {
  value: string;
  onChange: (html: string) => void;
  onSubmit: () => void;
  placeholder: string;
  onInsertImage?: () => void;
  uploadingImage?: boolean;
}>(function RichComposer({ value, onChange, onSubmit, placeholder, onInsertImage, uploadingImage }, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [isEmpty, setIsEmpty] = useState(true);

  // Sync external resets (e.g. after posting) without fighting the user's cursor
  useEffect(() => {
    if (editorRef.current && value === '' && editorRef.current.innerHTML !== '') {
      editorRef.current.innerHTML = '';
      setIsEmpty(true);
    }
  }, [value]);

  const refreshActiveFormats = useCallback(() => {
    const next = new Set<string>();
    ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'].forEach(cmd => {
      try { if (document.queryCommandState(cmd)) next.add(cmd); } catch {}
    });
    setActiveFormats(next);
  }, []);

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    onChange(html);
    setIsEmpty(editorRef.current.textContent?.trim().length === 0);
    refreshActiveFormats();
  };

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  React.useImperativeHandle(ref, () => ({
    insertImage: (url: string) => {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${url}" style="max-width:100%;border-radius:10px;margin:6px 0;display:block;" alt="attachment" />`);
      handleInput();
    },
  }));

  const handleLink = () => {
    const url = window.prompt('Link URL:', 'https://');
    if (url) exec('createLink', url);
  };

  const handleQuote = () => {
    editorRef.current?.focus();
    document.execCommand('formatBlock', false, 'blockquote');
    handleInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSubmit(); return; }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === 'b') { e.preventDefault(); exec('bold'); }
      else if (k === 'i') { e.preventDefault(); exec('italic'); }
      else if (k === 'u') { e.preventDefault(); exec('underline'); }
    }
  };

  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:12, background:'var(--bg-input)', overflow:'hidden' }}>
      {/* ── Persistent formatting toolbar — always visible, Slack/Teams style ── */}
      <div style={{ display:'flex', alignItems:'center', gap:2, padding:'6px 8px', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)', flexWrap:'wrap' }}>
        {FORMAT_BUTTONS.map(({ cmd, icon: Icon, title }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={e => e.preventDefault()} // keep editor focus/selection intact
            onClick={() => exec(cmd)}
            style={{
              width:30, height:30, borderRadius:7, border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              background: activeFormats.has(cmd) ? 'var(--accent-soft)' : 'transparent',
              color: activeFormats.has(cmd) ? 'var(--accent)' : 'var(--text-secondary)',
              transition:'all 0.12s',
            }}
            onMouseEnter={e => { if (!activeFormats.has(cmd)) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
            onMouseLeave={e => { if (!activeFormats.has(cmd)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          ><Icon /></button>
        ))}
        <div style={{ width:1, height:18, background:'var(--border)', margin:'0 4px' }} />
        <button type="button" title="Bullet list" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')}
          style={{ width:30, height:30, borderRadius:7, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: activeFormats.has('insertUnorderedList') ? 'var(--accent-soft)' : 'transparent', color: activeFormats.has('insertUnorderedList') ? 'var(--accent)' : 'var(--text-secondary)' }}
          onMouseEnter={e => { if (!activeFormats.has('insertUnorderedList')) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
          onMouseLeave={e => { if (!activeFormats.has('insertUnorderedList')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        ><IconBulletList /></button>
        <button type="button" title="Numbered list" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')}
          style={{ width:30, height:30, borderRadius:7, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background: activeFormats.has('insertOrderedList') ? 'var(--accent-soft)' : 'transparent', color: activeFormats.has('insertOrderedList') ? 'var(--accent)' : 'var(--text-secondary)' }}
          onMouseEnter={e => { if (!activeFormats.has('insertOrderedList')) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
          onMouseLeave={e => { if (!activeFormats.has('insertOrderedList')) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        ><IconNumList /></button>
        <div style={{ width:1, height:18, background:'var(--border)', margin:'0 4px' }} />
        <button type="button" title="Quote" onMouseDown={e => e.preventDefault()} onClick={handleQuote}
          style={{ width:30, height:30, borderRadius:7, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', color:'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        ><IconQuote /></button>
        <button type="button" title="Insert link" onMouseDown={e => e.preventDefault()} onClick={handleLink}
          style={{ width:30, height:30, borderRadius:7, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', color:'var(--text-secondary)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        ><IconLink /></button>
        {onInsertImage && (
          <button type="button" title="Attach photo" onMouseDown={e => e.preventDefault()} onClick={onInsertImage} disabled={uploadingImage}
            style={{ width:30, height:30, borderRadius:7, border:'none', cursor: uploadingImage ? 'wait' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', color:'var(--text-secondary)', opacity: uploadingImage ? 0.5 : 1 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          ><IconImage /></button>
        )}
        <div style={{ flex:1 }} />
        <button type="button" title="Clear formatting" onMouseDown={e => e.preventDefault()} onClick={() => exec('removeFormat')}
          style={{ width:30, height:30, borderRadius:7, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', color:'var(--text-muted)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        ><IconClear /></button>
      </div>

      {/* ── Editable surface ── */}
      <div style={{ position:'relative' }}>
        {isEmpty && (
          <span style={{ position:'absolute', top:12, left:14, fontSize:14, color:'var(--text-muted)', pointerEvents:'none', fontFamily:'Manrope,sans-serif' }}>
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={refreshActiveFormats}
          onKeyUp={refreshActiveFormats}
          className="announcement-editor"
          style={{
            minHeight:96, maxHeight:320, overflowY:'auto', padding:'12px 14px',
            fontSize:14, lineHeight:1.6, color:'var(--text-primary)', fontFamily:'Manrope,sans-serif',
            outline:'none', wordBreak:'break-word',
          }}
        />
      </div>
    </div>
  );
});

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

function hasContent(html: string) {
  // Strip tags to check if there's actually text/content, not just empty <div><br></div>
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length > 0;
}

// ── Sanitize before storing ──────────────────────────────────────────────────
// dangerouslySetInnerHTML renders this for EVERY reader on the platform, so
// even though only admins can post (RLS-enforced), it's worth stripping
// anything that could execute — script tags, inline event handlers, etc. —
// rather than trusting contentEditable output blindly. Allowlist-based: only
// keep tags/attributes the composer actually produces.
const ALLOWED_TAGS = new Set(['B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','A','BR','DIV','SPAN','P','IMG']);
function sanitizeHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          // Unwrap disallowed tags — keep their text/children, drop the tag itself
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
          }
          continue;
        }
        // Strip all attributes except href on <a> and src on <img>
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          if (el.tagName === 'A' && attr.name === 'href') {
            const val = attr.value.trim();
            if (!/^(https?:|mailto:)/i.test(val)) el.removeAttribute('href');
          } else if (el.tagName === 'IMG' && attr.name === 'src') {
            const val = attr.value.trim();
            // Only allow images from our own storage bucket — blocks any
            // injected external/data: URLs from being embedded
            if (!val.includes('/storage/v1/object/public/announcement-photos/')) el.removeAttribute('src');
          } else if (el.tagName === 'IMG' && (attr.name === 'alt' || attr.name === 'style')) {
            // keep — harmless, used for sizing/captioning
          } else {
            el.removeAttribute(attr.name);
          }
        }
        if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
        walk(el);
      }
    }
  };
  walk(template.content);
  return template.innerHTML;
}

export default function Announcements() {
  const { user: authUser } = useAuth();
  const [profile, setProfile]             = useState<any>(null);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [polls, setPolls]                 = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [draft, setDraft]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [showPollModal, setShowPollModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const lastSeenTsRef = useRef<string>(new Date(0).toISOString());
  const composerRef = useRef<{ insertImage: (url: string) => void }>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Bootstrap: load profile, determine admin status, load existing announcements + polls ──
  useEffect(() => {
    if (!authUser?.id) return;
    (async () => {
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (userData) {
        setProfile(userData);
        setIsAdmin(userData.role === 'Admin');
      }
      await Promise.all([loadAnnouncements(), loadPolls()]);
      setLoading(false);
    })();
  }, [authUser?.id]);

  const loadAnnouncements = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, users(delegation, role, committee)')
      .eq('recipient_group', ANNOUNCEMENTS_ROOM)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (!error && data) {
      setAnnouncements(data);
      if (data.length > 0) lastSeenTsRef.current = data[0].timestamp;
    }
  };

  const loadPolls = async () => {
    try { setPolls(await getPolls()); } catch (e) { console.error('Failed to load polls:', e); }
  };

  // ── Ride the shared poller — same one Chat.tsx and App.tsx already use ──────────
  // No new poll loop. This just listens for new messages and checks if any of
  // them landed in the announcements room; if so, refetches the list.
  useEffect(() => {
    if (!authUser?.id) return;
    const unsubscribe = subscribeToMessagePoll((incoming: any[]) => {
      const hasAnnouncement = incoming.some(m => m.recipient_group === ANNOUNCEMENTS_ROOM);
      if (hasAnnouncement) loadAnnouncements();
    });
    return unsubscribe;
  }, [authUser?.id]);

  // ── Realtime for new/closed polls — separate from the vote-level realtime
  // inside PollCard, this just catches polls being created/closed/deleted
  // so the list itself stays current ──────────────────────────────────────
  useEffect(() => {
    if (!authUser?.id) return;
    const channel = supabase.channel('polls_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => loadPolls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser?.id]);

  const handlePost = async () => {
    if (!hasContent(draft) || sending) return;
    setSending(true);
    try {
      const cleanHtml = sanitizeHtml(draft);
      const { error } = await supabase.from('messages').insert([{
        sender_id: authUser?.id,
        content: cleanHtml,
        recipient_group: ANNOUNCEMENTS_ROOM,
      }]);
      if (error) throw error;
      setDraft('');
      await loadAnnouncements();
      triggerImmediatePoll(); // nudge other users' polls to catch this faster
    } catch (e) {
      console.error('Failed to post announcement:', e);
    }
    setSending(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await supabase.from('messages').delete().eq('id', id);
      await loadAnnouncements();
    } catch (e) {
      console.error('Failed to delete announcement:', e);
    }
    setDeletingId(null);
  };

  const handlePhotoSelect = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be under 5MB.');
      e.target.value = '';
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await uploadAnnouncementPhoto(file);
      composerRef.current?.insertImage(url);
    } catch (err) {
      console.error('Photo upload failed:', err);
      alert('Photo upload failed. Please try again.');
    }
    setUploadingPhoto(false);
    e.target.value = '';
  };

  // ── Merge announcements + polls into one chronological feed ────────────────
  const feedItems = [
    ...announcements.map(a => ({ type: 'announcement' as const, ts: a.timestamp, data: a })),
    ...polls.map(p => ({ type: 'poll' as const, ts: p.created_at, data: p })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (loading) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <p style={{ color:'var(--text-muted)', fontSize:13, fontWeight:600 }}>Loading announcements…</p>
      </div>
    );
  }

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', padding:'32px 40px 24px', gap:'20px', boxSizing:'border-box', maxWidth:1080, margin:'0 auto', width:'100%' }}>
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
        <div>
          <h1 className="delegation-brand" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <IconMegaphone /> Announcements
          </h1>
          <p style={{ color:'var(--accent)', fontWeight:600, fontSize:'12px', marginTop:'4px' }}>
            Platform-wide · visible to every committee
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowPollModal(true)}
            style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:700, padding:'9px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', cursor:'pointer', fontFamily:'Manrope,sans-serif' }}
          >
            <IconPoll /> New Poll
          </button>
        )}
      </div>

      {/* ── Admin composer — only rendered for role === 'Admin' ── */}
      {isAdmin && (
        <div style={{ background:'var(--bg-surface)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'var(--glass-border)', borderRadius:16, padding:16, boxShadow:'var(--shadow-sm)', flexShrink:0 }}>
          <RichComposer
            ref={composerRef}
            value={draft}
            onChange={setDraft}
            onSubmit={handlePost}
            placeholder="Write an announcement for everyone…"
            onInsertImage={handlePhotoSelect}
            uploadingImage={uploadingPhoto}
          />
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handlePhotoChange} style={{ display:'none' }} />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>
              {uploadingPhoto ? 'Uploading photo…' : '⌘/Ctrl + Enter to post'}
            </span>
            <button
              onClick={handlePost}
              disabled={!hasContent(draft) || sending}
              style={{
                display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:700,
                padding:'9px 18px', borderRadius:10, border:'none', cursor: hasContent(draft) && !sending ? 'pointer' : 'not-allowed',
                background:'var(--accent)', color:'#fff', opacity: hasContent(draft) && !sending ? 1 : 0.5,
                fontFamily:'Manrope,sans-serif', boxShadow:'0 2px 8px rgba(240,124,0,0.25)',
              }}
            >
              <IconSend /> {sending ? 'Posting…' : 'Post Announcement'}
            </button>
          </div>
        </div>
      )}

      {/* ── Feed — announcements and polls merged chronologically ── */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, paddingRight:4 }}>
        {feedItems.length === 0 && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--text-muted)' }}>
            <IconMegaphone />
            <p style={{ fontSize:13, fontWeight:600 }}>No announcements yet</p>
          </div>
        )}
        {feedItems.map(item => {
          if (item.type === 'poll') {
            return <PollCard key={`poll-${item.data.id}`} poll={item.data} authUserId={authUser?.id} isAdmin={isAdmin} onChanged={loadPolls} />;
          }
          const a = item.data;
          return (
            <div key={`ann-${a.id}`} style={{
              background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:14,
              padding:'16px 18px', boxShadow:'var(--shadow-sm)', position:'relative',
            }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:26, height:26, borderRadius:8, background:'var(--accent-soft)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', flexShrink:0 }}>
                    <IconMegaphone />
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>
                    {a.users?.role === 'Admin' ? 'Admin' : (a.users?.delegation || a.users?.role || 'Organizer')}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>{formatTime(a.timestamp)}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      title="Delete announcement"
                      style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, borderRadius:6, display:'flex' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#DC2626'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              </div>
              <div
                className="announcement-content"
                dangerouslySetInnerHTML={{ __html: a.content }}
                style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, wordBreak:'break-word' }}
              />
            </div>
          );
        })}
      </div>

      {showPollModal && <PollModal onClose={() => setShowPollModal(false)} onCreated={loadPolls} />}

      <style>{`
        .announcement-editor ul, .announcement-content ul { margin: 6px 0; padding-left: 22px; list-style: disc; }
        .announcement-editor ol, .announcement-content ol { margin: 6px 0; padding-left: 22px; list-style: decimal; }
        .announcement-editor li, .announcement-content li { margin: 3px 0; }
        .announcement-editor blockquote, .announcement-content blockquote {
          margin: 8px 0; padding: 4px 12px; border-left: 3px solid var(--accent);
          color: var(--text-muted); font-style: italic;
        }
        .announcement-editor a, .announcement-content a { color: var(--accent); text-decoration: underline; }
        .announcement-editor strong, .announcement-content strong { font-weight: 800; }
        .announcement-content img { max-width: 100%; border-radius: 10px; display: block; margin: 8px 0; }
      `}</style>
    </div>
  );
}