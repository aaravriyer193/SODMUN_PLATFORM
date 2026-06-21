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
import { subscribeToMessagePoll, triggerImmediatePoll } from './committeeApi';

const ANNOUNCEMENTS_ROOM = '__announcements__';

const IconMegaphone = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>;
const IconSend      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconTrash     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;

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

function RichComposer({ value, onChange, onSubmit, placeholder }: {
  value: string;
  onChange: (html: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
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
}

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
const ALLOWED_TAGS = new Set(['B','STRONG','I','EM','U','S','STRIKE','UL','OL','LI','BLOCKQUOTE','A','BR','DIV','SPAN','P']);
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
        // Strip all attributes except href on <a>, and only allow http(s)/mailto
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          if (el.tagName === 'A' && attr.name === 'href') {
            const val = attr.value.trim();
            if (!/^(https?:|mailto:)/i.test(val)) el.removeAttribute('href');
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
  const [loading, setLoading]             = useState(true);
  const [draft, setDraft]                 = useState('');
  const [sending, setSending]             = useState(false);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  const lastSeenTsRef = useRef<string>(new Date(0).toISOString());

  // ── Bootstrap: load profile, determine admin status, load existing announcements ──
  useEffect(() => {
    if (!authUser?.id) return;
    (async () => {
      const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      if (userData) {
        setProfile(userData);
        setIsAdmin(userData.role === 'Admin');
      }
      await loadAnnouncements();
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

  if (loading) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <p style={{ color:'var(--text-muted)', fontSize:13, fontWeight:600 }}>Loading announcements…</p>
      </div>
    );
  }

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', padding:'32px 32px 24px', gap:'20px', boxSizing:'border-box', maxWidth:780, margin:'0 auto', width:'100%' }}>
      <div>
        <h1 className="delegation-brand" style={{ display:'flex', alignItems:'center', gap:10 }}>
          <IconMegaphone /> Announcements
        </h1>
        <p style={{ color:'var(--accent)', fontWeight:600, fontSize:'12px', marginTop:'4px' }}>
          Platform-wide · visible to every committee
        </p>
      </div>

      {/* ── Admin composer — only rendered for role === 'Admin' ── */}
      {isAdmin && (
        <div style={{ background:'var(--bg-surface)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', border:'var(--glass-border)', borderRadius:16, padding:16, boxShadow:'var(--shadow-sm)', flexShrink:0 }}>
          <RichComposer
            value={draft}
            onChange={setDraft}
            onSubmit={handlePost}
            placeholder="Write an announcement for everyone…"
          />
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>⌘/Ctrl + Enter to post</span>
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

      {/* ── Feed ── */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, paddingRight:4 }}>
        {announcements.length === 0 && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'var(--text-muted)' }}>
            <IconMegaphone />
            <p style={{ fontSize:13, fontWeight:600 }}>No announcements yet</p>
          </div>
        )}
        {announcements.map(a => (
          <div key={a.id} style={{
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
        ))}
      </div>

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
      `}</style>
    </div>
  );
}