import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { chairGetSidebar, chairGetRoomMessages, bustSidebarCache, appendToRoomCache, checkNewMessages } from './committeeApi';

const IconGlobe   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconLock    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconSend    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconPlus    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconEye     = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconBell    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IconBellOff = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

// ── Notification sound ─────────────────────────────────────────────────────
let audioCtxRef: AudioContext | null = null;
let userInteracted = false;
document.addEventListener('click', () => { userInteracted = true; }, { once: true });
document.addEventListener('keydown', () => { userInteracted = true; }, { once: true });

function playNotifSound(isDM: boolean) {
  if (!userInteracted) return;
  try {
    if (!audioCtxRef) audioCtxRef = new AudioContext();
    const ctx = audioCtxRef;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDM ? 880 : 660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isDM ? 1100 : 800, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

// ── Time formatting ────────────────────────────────────────────────────────
function formatTime(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(ts: string | Date) {
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

function isSameDay(a: string | Date, b: string | Date) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export default function Chat() {
  const { user: authUser } = useAuth();
  const [profile, setProfile]             = useState<any>(null);
  const [isChair, setIsChair]             = useState(false);
  const [channels, setChannels]           = useState<{ blocs: any[]; dms: any[] }>({ blocs: [], dms: [] });
  const [committeeUsers, setCommitteeUsers] = useState<any[]>([]);
  const [messages, setMessages]           = useState<any[]>([]);
  const [input, setInput]                 = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [activeRoom, setActiveRoom]       = useState<string>('');
  const [activeRoomName, setActiveRoomName] = useState<string>('Global Committee');
  const [isDMModal, setIsDMModal]         = useState(false);
  const [isBlocModal, setIsBlocModal]     = useState(false);
  const [newBlocName, setNewBlocName]     = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [lockedRooms, setLockedRooms]     = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts]   = useState<Map<string, number>>(new Map());
  const [soundEnabled, setSoundEnabled]   = useState(() =>
    localStorage.getItem('sodmun_notif_sound') !== 'false'
  );

  const scrollRef     = useRef<HTMLDivElement>(null);
  const activeRoomRef = useRef(activeRoom);
  const knownDMRooms  = useRef<Set<string>>(new Set());
  const profileRef    = useRef<any>(null);
  const committeeRef   = useRef<string>('');
  const isChairRef     = useRef(false);
  const soundEnabledRef = useRef(true);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { profileRef.current = profile; if (profile?.committee) committeeRef.current = profile.committee; }, [profile]);
  useEffect(() => { isChairRef.current = isChair; }, [isChair]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { if (authUser) initializeChat(); }, [authUser]);

  // ── Toggle sound ──────────────────────────────────────────────────────────
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('sodmun_notif_sound', String(next));
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  const initializeChat = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;
    setProfile(userData);
    profileRef.current = userData;
    const chair = userData.role !== 'Delegate';
    setIsChair(chair);
    setActiveRoom(userData.committee);
    setActiveRoomName('Global Committee');
    await Promise.all([refreshSidebar(userData, chair), subscribeToLocks(userData.committee)]);
  };

  // ── Room locks: initial load only — realtime merged into main channel ────────
  const subscribeToLocks = async (committee: string) => {
    const { data: locks } = await supabase.from('room_locks').select('recipient_group').eq('committee', committee);
    if (locks) setLockedRooms(new Set(locks.map((l: any) => l.recipient_group)));
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const refreshSidebar = async (userData: any = profile, chair: boolean = isChair) => {
    if (!userData) return;
    if (chair) {
      try {
        const result = await chairGetSidebar();
        setCommitteeUsers(result.committeeUsers || []);
        setChannels({ blocs: result.blocs || [], dms: result.dms || [] });
        (result.dms || []).forEach((dm: any) => knownDMRooms.current.add(dm.roomId));
      } catch (e) { console.error(e); }
    } else {
      const { data: peers } = await supabase.from('users').select('*').eq('committee', userData.committee);
      if (peers) setCommitteeUsers(peers);
      const { data: memberOf } = await supabase.from('bloc_members').select('blocs(*)').eq('user_id', authUser?.id);
      const myBlocs = (memberOf?.map((b: any) => b.blocs) ?? []).filter((b: any) => b && b.committee === userData.committee);
      const { data: myDMs } = await supabase.from('messages').select('recipient_group')
        .ilike('recipient_group', `%${authUser?.id}%`).filter('recipient_group', 'ilike', 'dm_%');
      const uniqueDMs = Array.from(new Set((myDMs || []).map((m: any) => m.recipient_group)));
      const mappedDMs = uniqueDMs.map(roomId => {
        const otherId = (roomId as string).replace('dm_', '').split('_').find(id => id !== authUser?.id);
        const peer = (peers || []).find((p: any) => p.id === otherId);
        return { roomId, name: peer ? (peer.delegation || peer.role) : 'Direct Signal' };
      });
      setChannels({ blocs: myBlocs, dms: mappedDMs });
    }
  };

  // ── Fetch messages ────────────────────────────────────────────────────────
  useEffect(() => { if (activeRoom) fetchMessages(activeRoom); }, [activeRoom]);

  const fetchMessages = async (roomId: string) => {
    try {
      if (isChair) {
        const result = await chairGetRoomMessages(roomId);
        setMessages(result.messages || []);
      } else {
        const { data } = await supabase.from('messages').select('*, users(*)')
          .eq('recipient_group', roomId).order('timestamp', { ascending: true });
        if (data) setMessages(data);
      }
      // Clear unread for this room
      setUnreadCounts(prev => { const m = new Map(prev); m.delete(roomId); return m; });
      scrollToBottom();
    } catch (e) { console.error(e); }
  };

  // ── Pure polling — no WebSocket for Chat ──────────────────────────────────────
  // Realtime WebSockets were removed entirely from Chat. With Supabase
  // realtime already running at ~1s latency from this region, and a 700+
  // concurrent-user ceiling of 500 connections to manage, polling every
  // 3 seconds gives a barely-noticeable UX difference while completely
  // eliminating Chat's WebSocket connection cost. Resolutions keeps its
  // WebSocket + poll hybrid since concurrent block-level editing benefits
  // more from instant push than chat does.
  const lastSeenTsRef = useRef<string>(new Date().toISOString());
  const pollRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollForMessages = useCallback(async () => {
    try {
      const result = await checkNewMessages(lastSeenTsRef.current);
      const incoming = result.messages || [];
      if (incoming.length === 0) return;

      lastSeenTsRef.current = incoming[0].timestamp;

      // Anything in the currently open room: refetch that room fully so
      // ordering/dedup is handled server-side rather than stitched client-side
      const relevantToActiveRoom = incoming.some((m: any) => m.recipient_group === activeRoomRef.current);
      if (relevantToActiveRoom && activeRoomRef.current) {
        await fetchMessages(activeRoomRef.current);
      }

      // Anything NOT in the active room: bump unread + play sound
      incoming.forEach((m: any) => {
        const rg = m.recipient_group;
        const own = m.sender_id === authUser?.id;
        if (rg !== activeRoomRef.current && !own) {
          setUnreadCounts(prev => { const map = new Map(prev); map.set(rg, (map.get(rg) || 0) + 1); return map; });
          if (soundEnabledRef.current) playNotifSound(rg?.startsWith('dm_'));
        }
        // New DM room discovered — refresh sidebar so it appears
        if (rg?.startsWith('dm_') && !knownDMRooms.current.has(rg)) {
          knownDMRooms.current.add(rg);
          if (isChairRef.current) bustSidebarCache();
          refreshSidebar();
        }
      });
    } catch (e) {
      console.error('Chat poll failed:', e);
    }
  }, [authUser?.id]);

  // ── Poll loop — 3s interval, self-rescheduling ─────────────────────────────
  useEffect(() => {
    if (!authUser?.id) return;
    let cancelled = false;

    const loop = async () => {
      if (cancelled) return;
      await pollForMessages();
      if (!cancelled) pollRef.current = setTimeout(loop, 3000);
    };
    pollRef.current = setTimeout(loop, 3000);

    return () => { cancelled = true; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [authUser?.id, pollForMessages]);

  // ── Room locks: poll alongside messages, much less frequent (locks rarely change) ──
  useEffect(() => {
    if (!authUser?.id || !committeeRef.current) return;
    let cancelled = false;

    const loop = async () => {
      if (cancelled) return;
      if (committeeRef.current) await subscribeToLocks(committeeRef.current);
      if (!cancelled) setTimeout(loop, 10000);
    };
    const t = setTimeout(loop, 10000);

    return () => { cancelled = true; clearTimeout(t); };
  }, [authUser?.id, profile?.committee]);

  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom || isObserving || isRoomLocked) return;
    const content = input;
    setInput('');
    setIsSending(true);

    // Optimistic local bubble — shows immediately with a sending pulse so
    // the message never feels "lost" during the gap before the next poll
    // confirms it actually landed in the DB
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      sender_id: authUser?.id,
      content,
      recipient_group: activeRoom,
      timestamp: new Date().toISOString(),
      users: profile,
      _sending: true,
    }]);
    scrollToBottom();

    try {
      await supabase.from('messages').insert([{ sender_id: authUser?.id, content, recipient_group: activeRoom }]);
      // Optimistically poll right away instead of waiting up to 3s — covers
      // the case where the sender is in a different room than what they just
      // posted to (e.g. just created a bloc and sent the first message).
      // The poll's fetchMessages() will replace this temp bubble with the
      // real row once it lands.
      await pollForMessages();
    } finally {
      setIsSending(false);
      // Safety net: if the poll somehow didn't replace it (e.g. user
      // switched rooms mid-send), clear the sending flag after a beat
      // so it doesn't pulse forever
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _sending: false } : m));
      }, 4000);
    }
  };

  const startDM = (peer: any) => {
    const roomId = `dm_${[authUser?.id, peer.id].sort().join('_')}`;
    switchRoom(roomId, peer.delegation || peer.role);
    setIsDMModal(false);
  };

  const handleCreateBloc = async () => {
    if (!newBlocName.trim() || selectedUsers.length === 0) return;
    const { data: bloc } = await supabase.from('blocs').insert([{ name: newBlocName, committee: profile?.committee }]).select().single();
    if (bloc) {
      await supabase.from('bloc_members').insert([authUser?.id, ...selectedUsers].map(uid => ({ user_id: uid, bloc_id: bloc.id })));
      bustSidebarCache();
      await refreshSidebar();
      setIsBlocModal(false); setNewBlocName(''); setSelectedUsers([]);
      switchRoom(`bloc_${bloc.id}`, bloc.name);
    }
  };

  const switchRoom = (id: string, name: string) => {
    setActiveRoom(id); setActiveRoomName(name); setMessages([]);
    setUnreadCounts(prev => { const m = new Map(prev); m.delete(id); return m; });
  };

  const isObserving  = isChair && activeRoom.startsWith('dm_') && !activeRoom.includes(authUser?.id ?? '');
  const isRoomLocked = lockedRooms.has(activeRoom) && !isChair;

  // ── Render messages with date separators ──────────────────────────────────
  const renderMessages = () => {
    const items: React.ReactNode[] = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      if (!prev || !isSameDay(prev.timestamp || prev.created_at, m.timestamp || m.created_at)) {
        items.push(
          <div key={`sep-${i}`} style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0', flexShrink:0 }}>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'1px', whiteSpace:'nowrap' }}>
              {formatDateSeparator(m.timestamp || m.created_at)}
            </span>
            <div style={{ flex:1, height:1, background:'var(--border)' }} />
          </div>
        );
      }
      const isMe = m.sender_id === authUser?.id;
      items.push(
        <div key={m.id ?? i} className={`msg-wrap ${isMe ? 'me' : 'them'}`}>
          <span className="msg-sender">{m.users?.role} · {m.users?.delegation || m.users?.committee}</span>
          <div className={`msg-bubble ${m._sending ? 'msg-sending' : ''}`}>
            {m.content}
          </div>
          <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500, marginTop:3, alignSelf: isMe ? 'flex-end' : 'flex-start', display:'flex', alignItems:'center', gap:4 }}>
            {m._sending ? (
              <span className="sending-dots"><span/><span/><span/></span>
            ) : (
              formatTime(m.timestamp || m.created_at)
            )}
          </span>
        </div>
      );
    });
    return items;
  };

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', padding:'32px 32px 24px', gap:'20px', boxSizing:'border-box' }} className="chat-page-wrap">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .chat-shell { flex:1; display:flex; border-radius:20px; overflow:hidden; border:1px solid var(--border); box-shadow:var(--shadow-md); background:var(--bg-surface); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); min-height:0; }
        .chat-sidebar-inner { width:260px; flex-shrink:0; background:var(--bg-sidebar); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:24px 16px; overflow-y:auto; }
        .chat-main-inner { flex:1; display:flex; flex-direction:column; background:var(--bg-base); min-width:0; }
        .ch-btn { display:flex; align-items:center; gap:9px; padding:9px 12px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:600; transition:all 0.12s; margin-bottom:2px; border:1px solid transparent; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; position:relative; }
        .ch-btn.active { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-mid); }
        .ch-btn.inactive { color:var(--text-secondary); background:transparent; }
        .ch-btn.inactive:hover { background:var(--bg-surface); color:var(--text-primary); }
        .ch-btn .unread-dot { position:absolute; right:10px; top:50%; transform:translateY(-50%); min-width:18px; height:18px; border-radius:99px; background:var(--accent); color:#fff; font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; padding:0 4px; }
        .msg-wrap { display:flex; flex-direction:column; margin-bottom:16px; max-width:72%; }
        .msg-wrap.me { align-self:flex-end; align-items:flex-end; }
        .msg-wrap.them { align-self:flex-start; align-items:flex-start; }
        .msg-sender { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; color:var(--text-muted); }
        .msg-bubble { padding:10px 16px; border-radius:14px; font-size:14px; line-height:1.5; font-family:'Manrope',sans-serif; word-break:break-word; overflow-wrap:break-word; }
        .me .msg-bubble { background:var(--accent); color:#fff; border-bottom-right-radius:4px; box-shadow:0 2px 8px rgba(240,124,0,0.20); }
        .them .msg-bubble { background:var(--bg-elevated); color:var(--text-primary); border-bottom-left-radius:4px; border:1px solid var(--border); box-shadow:var(--shadow-sm); }
        .msg-sending { opacity:0.6; animation:msgSendPulse 1.1s ease-in-out infinite; }
        @keyframes msgSendPulse { 0%,100% { opacity:0.6; } 50% { opacity:0.95; } }
        .sending-dots { display:inline-flex; gap:3px; align-items:center; }
        .sending-dots span { width:3px; height:3px; border-radius:50%; background:var(--text-muted); animation:sendDotBounce 1.1s ease-in-out infinite; }
        .sending-dots span:nth-child(2) { animation-delay:0.15s; }
        .sending-dots span:nth-child(3) { animation-delay:0.3s; }
        @keyframes sendDotBounce { 0%,80%,100% { opacity:0.3; transform:translateY(0); } 40% { opacity:1; transform:translateY(-2px); } }
        .plus-btn-sm { width:24px; height:24px; background:var(--accent-soft); border:1px solid var(--accent-mid); color:var(--accent); border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.12s; }
        .plus-btn-sm:hover { background:var(--accent); color:#fff; }
        .sec-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:0 2px; }
        .sec-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:var(--text-muted); }
        .observe-banner { display:flex; align-items:center; gap:7px; background:var(--accent-soft); border-bottom:1px solid var(--accent-mid); padding:8px 20px; font-size:11px; font-weight:700; color:var(--accent); letter-spacing:0.3px; flex-shrink:0; }
        .lock-banner { display:flex; align-items:center; gap:8px; background:rgba(220,38,38,0.07); border-bottom:1px solid rgba(220,38,38,0.18); padding:10px 20px; font-size:12px; font-weight:700; color:#DC2626; flex-shrink:0; }
        .obs-chip { font-size:9px; font-weight:700; background:rgba(113,113,122,0.10); color:var(--text-muted); padding:1px 6px; border-radius:99px; flex-shrink:0; display:flex; align-items:center; gap:3px; }
        .lock-chip { font-size:9px; font-weight:700; background:rgba(220,38,38,0.10); color:#DC2626; padding:1px 6px; border-radius:99px; flex-shrink:0; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(128,128,128,0.25); border-radius:99px; }
        @media (max-width:768px) {
          .chat-sidebar-inner { display:none; }
          .chat-shell { border-radius:14px; }
          .chat-page-wrap { padding: 16px 12px 0 !important; }
          .chat-page-wrap .chat-shell { border-radius:12px; }
          /* Input bar needs extra bottom padding for tab bar */
          .chat-main-inner form { padding-bottom: calc(env(safe-area-inset-bottom) + 70px) !important; }
        }
      `}</style>

      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <h1 className="delegation-brand">Communications</h1>
          <p style={{ color:'var(--accent)', fontWeight:600, fontSize:'12px', marginTop:'4px' }}>{profile?.committee} Network</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* Sync indicator — Chat runs on pure polling, no WebSocket */}
          <div
            title="Updates sync every 3 seconds"
            style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:99, padding:'5px 11px' }}
          >
            <div style={{
              width:7, height:7, borderRadius:'50%',
              background: '#22C55E',
              boxShadow: '0 0 0 3px rgba(34,197,94,0.15)',
            }} />
            <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)' }}>
              Synced
            </span>
          </div>
          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute notifications' : 'Enable notification sounds'}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:9, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color: soundEnabled ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {soundEnabled ? <IconBell /> : <IconBellOff />}
          </button>
          {isChair && (
            <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', background:'var(--accent-soft)', border:'1px solid var(--accent-mid)', borderRadius:99, padding:'5px 14px', letterSpacing:'0.5px', textTransform:'uppercase' }}>
              Chair View — Full Access
            </div>
          )}
        </div>
      </div>

      <div className="chat-shell">
        {/* ── Sidebar ── */}
        <div className="chat-sidebar-inner">
          <div className="sec-label" style={{ marginBottom:'8px' }}>Public</div>
          <div className={`ch-btn ${activeRoom === profile?.committee ? 'active' : 'inactive'}`} onClick={() => switchRoom(profile?.committee, 'Global Committee')}>
            <span style={{ opacity:0.7 }}><IconGlobe /></span>
            <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>Global Committee</span>
            {lockedRooms.has(profile?.committee) && <span className="lock-chip">Paused</span>}
            {(unreadCounts.get(profile?.committee) ?? 0) > 0 && activeRoom !== profile?.committee && (
              <span className="unread-dot">{unreadCounts.get(profile?.committee)}</span>
            )}
          </div>

          <div className="sec-header" style={{ marginTop:'20px' }}>
            <span className="sec-label">Bloc Group Chats</span>
            {!isChair && <button className="plus-btn-sm" onClick={() => setIsBlocModal(true)}><IconPlus /></button>}
          </div>
          <div style={{ maxHeight:'180px', overflowY:'auto' }}>
            {channels.blocs.length === 0 && <p style={{ fontSize:12, color:'var(--text-muted)', padding:'4px 4px 8px', fontWeight:500 }}>No blocs yet</p>}
            {channels.blocs.map((b: any) => (
              <div key={b.id} className={`ch-btn ${activeRoom === `bloc_${b.id}` ? 'active' : 'inactive'}`} onClick={() => switchRoom(`bloc_${b.id}`, b.name)}>
                <span style={{ opacity:0.7 }}><IconLock /></span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>{b.name}</span>
                {lockedRooms.has(`bloc_${b.id}`) && <span className="lock-chip">Paused</span>}
                {(unreadCounts.get(`bloc_${b.id}`) ?? 0) > 0 && activeRoom !== `bloc_${b.id}` && (
                  <span className="unread-dot">{unreadCounts.get(`bloc_${b.id}`)}</span>
                )}
              </div>
            ))}
          </div>

          <div className="sec-header" style={{ marginTop:'20px' }}>
            <span className="sec-label">{isChair ? 'All DMs' : 'Direct Messages'}</span>
            <button className="plus-btn-sm" onClick={() => setIsDMModal(true)}><IconPlus /></button>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {channels.dms.length === 0 && <p style={{ fontSize:12, color:'var(--text-muted)', padding:'4px 4px 8px', fontWeight:500 }}>No messages yet</p>}
            {channels.dms.map((dm: any) => (
              <div key={dm.roomId} title={dm.name} className={`ch-btn ${activeRoom === dm.roomId ? 'active' : 'inactive'}`} onClick={() => switchRoom(dm.roomId, dm.name)}>
                <span style={{ opacity:0.7 }}><IconMessage /></span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{dm.name}</span>
                {isChair && !dm.roomId.includes(authUser?.id ?? '') && <span className="obs-chip"><IconEye />obs</span>}
                {(unreadCounts.get(dm.roomId) ?? 0) > 0 && activeRoom !== dm.roomId && (
                  <span className="unread-dot">{unreadCounts.get(dm.roomId)}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main ── */}
        <div className="chat-main-inner">
          {/* Header */}
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', backdropFilter:'blur(8px)', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
            <h2 style={{ fontSize:'15px', fontWeight:700, color:'var(--text-primary)', margin:0, flex:1 }}>{activeRoomName}</h2>
            {lockedRooms.has(activeRoom) && (
              <span style={{ fontSize:10, fontWeight:800, color:'#DC2626', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.20)', borderRadius:99, padding:'3px 10px', letterSpacing:'1px', textTransform:'uppercase' }}>Paused</span>
            )}
          </div>

          {/* Banners */}
          {isObserving && <div className="observe-banner"><IconEye /> Chair observation mode — read-only</div>}
          {isRoomLocked && <div className="lock-banner"><IconLock /> This channel has been paused by the Chair</div>}

          {/* Messages */}
          <div style={{ flex:1, padding:'20px 24px', overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {messages.length === 0 && (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <p style={{ fontSize:13, color:'var(--text-muted)', fontWeight:500 }}>No messages in this channel yet</p>
              </div>
            )}
            {renderMessages()}
            <div ref={scrollRef} />
          </div>

          {/* Input */}
          {!isObserving && (
            <form onSubmit={sendMessage} style={{ padding:'14px 18px', borderTop:'1px solid var(--border)', background:'var(--bg-elevated)', display:'flex', gap:'10px', alignItems:'center', flexShrink:0 }}>
              <input
                style={{ flex:1, background:'var(--bg-input)', border:'1px solid var(--border-strong)', color:'var(--text-primary)', padding:'12px 16px', borderRadius:'12px', fontSize:'14px', fontFamily:'Manrope,sans-serif', outline:'none', transition:'border-color 0.15s', marginBottom:0, opacity: isRoomLocked ? 0.5 : 1 }}
                value={input} onChange={e => setInput(e.target.value)}
                placeholder={isRoomLocked ? 'Chat paused by Chair…' : `Message ${activeRoomName}…`}
                disabled={isRoomLocked}
                onFocus={e => e.currentTarget.style.borderColor='var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor='var(--border-strong)'}
              />
              <button type="submit" disabled={isRoomLocked} style={{ background:'var(--accent)', border:'none', color:'#fff', width:'44px', height:'44px', borderRadius:'12px', cursor: isRoomLocked ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(240,124,0,0.25)', opacity: isRoomLocked ? 0.4 : 1 }}>
                <IconSend />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── DM Modal ── */}
      {isDMModal && (
        <div className="overlay">
          <div className="modal">
            <h2>Start a Direct Message</h2>
            <div style={{ maxHeight:'280px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'12px', overflow:'hidden' }}>
              {committeeUsers.filter((u: any) => u.id !== authUser?.id).map((u: any) => (
                <div key={u.id} onClick={() => startDM(u)}
                  style={{ padding:'13px 16px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:'13px', fontWeight:600, display:'flex', alignItems:'center', gap:'10px', color:'var(--text-primary)', transition:'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--accent-soft)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
                >
                  <span style={{ fontSize:'10px', fontWeight:700, background: u.role !== 'Delegate' ? 'var(--accent-soft)' : 'var(--bg-surface)', color: u.role !== 'Delegate' ? 'var(--accent)' : 'var(--text-muted)', padding:'2px 8px', borderRadius:'99px', textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>{u.role}</span>
                  {u.delegation || u.committee}
                </div>
              ))}
            </div>
            <button className="logout-btn" style={{ width:'100%', marginTop:'12px', textAlign:'center' }} onClick={() => setIsDMModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Bloc Modal ── */}
      {isBlocModal && (
        <div className="overlay">
          <div className="modal">
            <h2>New Bloc Group Chat</h2>
            <input className="dark-input" value={newBlocName} onChange={e => setNewBlocName(e.target.value)} placeholder="Bloc name…" />
            <div style={{ maxHeight:'160px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'12px', overflow:'hidden', marginBottom:'14px' }}>
              {committeeUsers.filter((u: any) => u.role === 'Delegate' && u.id !== authUser?.id).map((u: any) => (
                <div key={u.id}
                  onClick={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])}
                  style={{ padding:'11px 16px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:'13px', fontWeight:600, background: selectedUsers.includes(u.id) ? 'var(--accent-soft)' : 'transparent', color: selectedUsers.includes(u.id) ? 'var(--accent)' : 'var(--text-primary)', display:'flex', alignItems:'center', gap:'10px', transition:'all 0.1s' }}
                >
                  <div style={{ width:'16px', height:'16px', borderRadius:'4px', border:`2px solid ${selectedUsers.includes(u.id)?'var(--accent)':'var(--border-strong)'}`, background: selectedUsers.includes(u.id)?'var(--accent)':'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {selectedUsers.includes(u.id) && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {u.delegation}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button className="primary-btn" style={{ flex:1, height:'44px' }} onClick={handleCreateBloc}>Create</button>
              <button className="logout-btn" style={{ flex:1, height:'44px', marginTop:0 }} onClick={() => { setIsBlocModal(false); setNewBlocName(''); setSelectedUsers([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}