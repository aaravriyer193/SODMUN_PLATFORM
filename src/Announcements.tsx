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
const IconTrash      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

export default function Announcements() {
  const { user: authUser } = useAuth();
  const [profile, setProfile]           = useState<any>(null);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [draft, setDraft]               = useState('');
  const [sending, setSending]           = useState(false);
  const [deletingId, setDeletingId]     = useState<string | null>(null);

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
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert([{
        sender_id: authUser?.id,
        content: draft.trim(),
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
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handlePost(); } }}
            placeholder="Write an announcement for everyone… (⌘/Ctrl + Enter to post)"
            rows={3}
            style={{
              width:'100%', resize:'vertical', minHeight:64, padding:'10px 12px',
              borderRadius:10, border:'1px solid var(--border)', background:'var(--bg-input)',
              color:'var(--text-primary)', fontSize:14, fontFamily:'Manrope,sans-serif',
              outline:'none', boxSizing:'border-box', lineHeight:1.5,
            }}
          />
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
            <button
              onClick={handlePost}
              disabled={!draft.trim() || sending}
              style={{
                display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:700,
                padding:'9px 18px', borderRadius:10, border:'none', cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
                background:'var(--accent)', color:'#fff', opacity: draft.trim() && !sending ? 1 : 0.5,
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
            <p style={{ fontSize:14, color:'var(--text-secondary)', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>
              {a.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}