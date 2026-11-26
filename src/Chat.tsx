import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { subscribeToMessagePoll, triggerImmediatePoll } from './committeeApi';

const IconGlobe   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconLock    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconSend    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconPlus    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconBell    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IconBellOff = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IconReply   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>;
const IconBack    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const IconSearch  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconDown    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const IconCheck   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconClock   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
const IconGroupAdd = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 21v-1.5A3.5 3.5 0 0 0 11.5 16h-5A3.5 3.5 0 0 0 3 19.5V21"/><circle cx="9" cy="8.5" r="3.5"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>;
const IconClose   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

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
function toUTC(ts: string | Date): Date {
  if (ts instanceof Date) return ts;
  const hasTz = /Z$|[+-]\d{2}:\d{2}$/.test(ts);
  return new Date(hasTz ? ts : ts + 'Z');
}

function formatTime(ts: string | Date) {
  const d = toUTC(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
}

function formatDateSeparator(ts: string | Date) {
  const d = toUTC(ts);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Dubai' });
}

function isSameDay(a: string | Date, b: string | Date) {
  const da = toUTC(a), db = toUTC(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// ── Avatars & list times ───────────────────────────────────────────────────
const AVATAR_COLORS = ['#22a457', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#6366f1'];
function colorFor(key: string) {
  let h = 0; for (const c of key || '?') h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return (name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function listTime(ts?: string) {
  if (!ts) return '';
  const d = toUTC(ts);
  if (isSameDay(d, new Date())) return formatTime(d);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Dubai' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });
}
const senderName = (u: any) => u?.role === 'Delegate' ? (u?.delegation || 'Delegate') : (u ? `${u.role}${u.delegation ? ' · ' + u.delegation : ''}` : 'Unknown');
const GROUP_GAP_MS = 5 * 60 * 1000;

export default function Chat() {
  const { user: authUser } = useAuth();
  const [profile, setProfile]               = useState<any>(null);
  const [isChair, setIsChair]               = useState(false);
  const [channels, setChannels]             = useState<{ blocs: any[]; dms: any[] }>({ blocs: [], dms: [] });
  const [committeeUsers, setCommitteeUsers] = useState<any[]>([]);
  const [messages, setMessages]             = useState<any[]>([]);
  const [input, setInput]                   = useState('');
  const [isSending, setIsSending]           = useState(false);
  const [activeRoom, setActiveRoom]         = useState<string>('');
  const [activeRoomName, setActiveRoomName] = useState<string>('Global Committee');
  const [isDMModal, setIsDMModal]           = useState(false);
  const [isBlocModal, setIsBlocModal]       = useState(false);
  const [newBlocName, setNewBlocName]       = useState('');
  const [selectedUsers, setSelectedUsers]   = useState<string[]>([]);
  const [lockedRooms, setLockedRooms]       = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts]     = useState<Map<string, number>>(new Map());
  const [soundEnabled, setSoundEnabled]     = useState(() =>
    localStorage.getItem('sodmun_notif_sound') !== 'false'
  );
  const [mobileOpen, setMobileOpen]         = useState(false); // phone: conversation vs list
  const [search, setSearch]                 = useState('');
  const [lastByRoom, setLastByRoom]         = useState<Map<string, any>>(new Map());
  const [showJump, setShowJump]             = useState(false);
  const [newBelow, setNewBelow]             = useState(0);
  const [replyingTo, setReplyingTo]         = useState<any | null>(null);

  const scrollRef       = useRef<HTMLDivElement>(null);
  const listRef         = useRef<HTMLDivElement>(null);
  const nearBottomRef   = useRef(true);
  const usersRef        = useRef<any[]>([]);
  const activeRoomRef   = useRef(activeRoom);
  const knownDMRooms    = useRef<Set<string>>(new Set());
  const profileRef      = useRef<any>(null);
  const committeeRef    = useRef<string>('');
  const soundEnabledRef = useRef(true);
  const inputRef        = useRef<HTMLTextAreaElement>(null);

  const hasInitializedRef = useRef(false);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { profileRef.current = profile; if (profile?.committee) committeeRef.current = profile.committee; }, [profile]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { if (authUser?.id) initializeChat(); }, [authUser?.id]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('sodmun_notif_sound', String(next));
  };

  const initializeChat = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;
    setProfile(userData);
    profileRef.current = userData;
    const chair = userData.role !== 'Delegate';
    setIsChair(chair);

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setActiveRoom(userData.committee);
      setActiveRoomName('Global Committee');
    }

    await refreshSidebar(userData);
  };

  const refreshSidebar = async (userData: any = profile) => {
    if (!userData) return;
    const { data: peers } = await supabase.from('users').select('*').eq('committee', userData.committee);
    if (peers) { setCommitteeUsers(peers); usersRef.current = peers; }
    let myBlocs: any[] = [];
    if (userData.role !== 'Delegate') {
      const { data: allBlocs } = await supabase.from('blocs').select('*').eq('committee', userData.committee);
      myBlocs = allBlocs || [];
    } else {
      const { data: memberOf } = await supabase.from('bloc_members').select('blocs(*)').eq('user_id', authUser?.id);
      myBlocs = (memberOf?.map((b: any) => b.blocs) ?? []).filter((b: any) => b && b.committee === userData.committee);
    }
    const { data: myDMs } = await supabase.from('messages').select('recipient_group')
      .ilike('recipient_group', `%${authUser?.id}%`).filter('recipient_group', 'ilike', 'dm_%');
    const uniqueDMs = Array.from(new Set((myDMs || []).map((m: any) => m.recipient_group)));
    const mappedDMs = uniqueDMs.map(roomId => {
      const otherId = (roomId as string).replace('dm_', '').split('_').find(id => id !== authUser?.id);
      const peer = (peers || []).find((p: any) => p.id === otherId);
      return { roomId, name: peer ? (peer.delegation || peer.role) : 'Direct Signal' };
    });
    setChannels({ blocs: myBlocs, dms: mappedDMs });

    // Latest message per conversation, for the chat list previews
    const ids = [userData.committee, ...myBlocs.map((b: any) => `bloc_${b.id}`), ...mappedDMs.map(d => d.roomId as string)];
    const { data: recent } = await supabase.from('messages')
      .select('recipient_group, content, timestamp, sender_id, users(role, delegation)')
      .in('recipient_group', ids).order('timestamp', { ascending: false }).limit(400);
    setLastByRoom(prev => {
      const m = new Map(prev);
      (recent || []).forEach((r: any) => { if (!m.has(r.recipient_group)) m.set(r.recipient_group, r); });
      return m;
    });
  };

  useEffect(() => { if (activeRoom) fetchMessages(activeRoom); }, [activeRoom]);

  const fetchMessages = async (roomId: string) => {
    try {
      const { data } = await supabase.from('messages').select('*, users(*), reply_to_message:reply_to(id, content, users(role, delegation, committee))')
        .eq('recipient_group', roomId).order('timestamp', { ascending: true });
      if (data) {
        setMessages(data);
        const last = data[data.length - 1];
        if (last) setLastByRoom(prev => new Map(prev).set(roomId, last));
      }
      setUnreadCounts(prev => { const m = new Map(prev); m.delete(roomId); return m; });
      if (nearBottomRef.current) scrollToBottom(); else setNewBelow(n => n + 1);
    } catch (e) { console.error(e); }
  };

  const handlePollResults = useCallback((incoming: any[], lockedRoomsList: string[] | null) => {
    if (lockedRoomsList !== null) {
      setLockedRooms(new Set(lockedRoomsList));
    }

    if (incoming.length === 0) return;

    const relevantToActiveRoom = incoming.some((m: any) => m.recipient_group === activeRoomRef.current);
    if (relevantToActiveRoom && activeRoomRef.current) {
      fetchMessages(activeRoomRef.current);
    }

    incoming.forEach((m: any) => {
      const rg = m.recipient_group;
      setLastByRoom(prev => {
        const cur = prev.get(rg);
        if (cur && cur.timestamp >= m.timestamp) return prev;
        return new Map(prev).set(rg, { ...m, users: m.users || usersRef.current.find((u: any) => u.id === m.sender_id) });
      });
      const own = m.sender_id === authUser?.id;
      if (rg !== activeRoomRef.current && !own) {
        setUnreadCounts(prev => { const map = new Map(prev); map.set(rg, (map.get(rg) || 0) + 1); return map; });
        if (soundEnabledRef.current) playNotifSound(rg?.startsWith('dm_'));
      }
      if (rg?.startsWith('dm_') && !knownDMRooms.current.has(rg)) {
        knownDMRooms.current.add(rg);
        refreshSidebar();
      }
    });
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;
    const unsubscribe = subscribeToMessagePoll(handlePollResults);
    return unsubscribe;
  }, [authUser?.id, handlePollResults]);

  const pollForMessages = useCallback(() => { triggerImmediatePoll(); }, []);

  const scrollToBottom = (smooth = true) => setTimeout(() => {
    scrollRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setNewBelow(0);
  }, 60);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !activeRoom || isRoomLocked) return;
    const content = input;
    const replyToId = replyingTo?.id ?? null;
    setInput('');
    setReplyingTo(null);
    setIsSending(true);
    if (inputRef.current) inputRef.current.style.height = '';
    setLastByRoom(prev => new Map(prev).set(activeRoom, { content, timestamp: new Date().toISOString(), sender_id: authUser?.id, users: profile }));

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      sender_id: authUser?.id,
      content,
      recipient_group: activeRoom,
      timestamp: new Date().toISOString(),
      users: profile,
      reply_to: replyToId ? replyingTo : null,
      reply_to_message: replyingTo ? { id: replyingTo.id, content: replyingTo.content, users: replyingTo.users } : null,
      _sending: true,
    }]);
    nearBottomRef.current = true;
    scrollToBottom();

    try {
      await supabase.from('messages').insert([{ sender_id: authUser?.id, content, recipient_group: activeRoom, reply_to: replyToId }]);
      await pollForMessages();
    } finally {
      setIsSending(false);
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
      await refreshSidebar();
      setIsBlocModal(false); setNewBlocName(''); setSelectedUsers([]);
      switchRoom(`bloc_${bloc.id}`, bloc.name);
    }
  };

  const switchRoom = (id: string, name: string) => {
    if (id === activeRoom) { setMobileOpen(true); scrollToBottom(false); return; } // already loaded
    setActiveRoom(id); setActiveRoomName(name); setMessages([]);
    nearBottomRef.current = true; setShowJump(false); setNewBelow(0); setMobileOpen(true);
    setUnreadCounts(prev => { const m = new Map(prev); m.delete(id); return m; });
    setReplyingTo(null);
  };

  const handleReply = (msg: any) => {
    setReplyingTo(msg);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const isRoomLocked = lockedRooms.has(activeRoom) && !isChair;

  // ── Conversation list: committee pinned, then most recent first ──────────
  const rooms = [
    { id: profile?.committee, name: 'Global Committee', kind: 'global' as const },
    ...channels.blocs.map((b: any) => ({ id: `bloc_${b.id}`, name: b.name, kind: 'bloc' as const })),
    ...channels.dms.map((d: any) => ({ id: d.roomId as string, name: d.name as string, kind: 'dm' as const })),
  ].filter(r => r.id);
  const q = search.trim().toLowerCase();
  const shownRooms = rooms
    .filter(r => !q || r.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.kind === 'global') return -1;
      if (b.kind === 'global') return 1;
      return (lastByRoom.get(b.id)?.timestamp || '').localeCompare(lastByRoom.get(a.id)?.timestamp || '');
    });
  const activeKind = activeRoom === profile?.committee ? 'global' : activeRoom.startsWith('bloc_') ? 'bloc' : 'dm';
  const totalUnread = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    nearBottomRef.current = near;
    setShowJump(!near);
    if (near) setNewBelow(0);
  };

  // Opening a chat lands at the newest message without a long smooth scroll
  useEffect(() => { if (messages.length) scrollToBottom(false); }, [activeRoom, messages.length > 0]);

  const Avatar = ({ kind, name, size = 44 }: { kind: string; name: string; size?: number }) => (
    <span className="wa-avatar" style={{ width: size, height: size }}>
      {kind === 'global' ? <IconGlobe /> : kind === 'bloc' ? <IconLock /> : initials(name)}
    </span>
  );

  const preview = (roomId: string) => {
    const m = lastByRoom.get(roomId);
    if (!m) return roomId === profile?.committee ? 'Everyone in your committee' : 'No messages yet';
    const who = m.sender_id === authUser?.id ? 'You' : (m.users?.delegation || m.users?.role || '');
    return `${who ? who + ': ' : ''}${m.content}`;
  };

  const renderMessages = () => {
    const items: React.ReactNode[] = [];
    const group = activeKind !== 'dm';
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const ts = m.timestamp || m.created_at;
      const newDay = !prev || !isSameDay(prev.timestamp || prev.created_at, ts);
      if (newDay) items.push(<div key={`sep-${i}`} className="wa-day"><span>{formatDateSeparator(ts)}</span></div>);
      const isMe = m.sender_id === authUser?.id;
      const continued = !newDay && prev && prev.sender_id === m.sender_id
        && toUTC(ts).getTime() - toUTC(prev.timestamp || prev.created_at).getTime() < GROUP_GAP_MS;
      const replied = m.reply_to_message;
      const name = senderName(m.users);
      items.push(
        <div key={m.id ?? i} className={`wa-row ${isMe ? 'me' : 'them'}${continued ? ' cont' : ''}`} onDoubleClick={() => !m._sending && handleReply(m)}>
          <div className={`wa-bubble${m._sending ? ' sending' : ''}`}>
            {group && !isMe && !continued && <span className="wa-name" style={{ color: colorFor(name) }}>{name}</span>}
            {replied && (
              <div className="wa-quote">
                <span style={{ color: colorFor(senderName(replied.users)) }}>{senderName(replied.users)}</span>
                <p>{replied.content}</p>
              </div>
            )}
            <span className="wa-text">{m.content}</span>
            <span className="wa-meta">
              {formatTime(ts)}
              {isMe && (m._sending ? <IconClock /> : <IconCheck />)}
            </span>
          </div>
          {!m._sending && (
            <button className="wa-reply" onClick={() => handleReply(m)} aria-label="Reply" title="Reply"><IconReply /></button>
          )}
        </div>
      );
    });
    return items;
  };

  return (
    <div className={`wa${mobileOpen ? ' is-open' : ''}`}>
      <style>{CSS}</style>

      {/* ── Chat list ── */}
      <aside className="wa-list">
        <div className="wa-list__head">
          <h1 className="wa-list__title">Chats</h1>
          <div className="wa-list__tools">
            <button className="wa-icon" onClick={toggleSound} title={soundEnabled ? 'Mute notification sounds' : 'Turn on notification sounds'}>
              {soundEnabled ? <IconBell /> : <IconBellOff />}
            </button>
            {!isChair && (
              <button className="wa-newgroup" onClick={() => setIsBlocModal(true)} title="Create a bloc group chat"><IconGroupAdd /><span>New group</span></button>
            )}
            <button className="wa-icon wa-icon--green" onClick={() => setIsDMModal(true)} title="New message"><IconPlus /></button>
          </div>
        </div>
        <label className="wa-search">
          <IconSearch />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats" aria-label="Search chats" />
        </label>
        <div className="wa-rooms">
          {shownRooms.map(r => {
            const unread = r.id === activeRoom ? 0 : (unreadCounts.get(r.id) ?? 0);
            return (
              <button key={r.id} className={`wa-room${r.id === activeRoom ? ' is-active' : ''}${unread ? ' has-unread' : ''}`} onClick={() => switchRoom(r.id, r.name)}>
                <Avatar kind={r.kind} name={r.name} />
                <span className="wa-room__body">
                  <span className="wa-room__top">
                    <strong>{r.name}</strong>
                    <span className="wa-room__time">{listTime(lastByRoom.get(r.id)?.timestamp)}</span>
                  </span>
                  <span className="wa-room__bottom">
                    <span className="wa-room__preview">{lockedRooms.has(r.id) ? 'Paused by the chair' : preview(r.id)}</span>
                    {unread > 0 && <span className="wa-unread">{unread}</span>}
                  </span>
                </span>
              </button>
            );
          })}
          {shownRooms.length === 0 && <p className="wa-none">No chats match “{search}”.</p>}
        </div>
      </aside>

      {/* ── Conversation ── */}
      <section className="wa-chat" aria-label={activeRoomName}>
        <header className="wa-chat__head">
          <button className="wa-icon wa-back" onClick={() => setMobileOpen(false)} aria-label="Back to chats">
            <IconBack />
            {totalUnread > 0 && <span className="wa-unread">{totalUnread}</span>}
          </button>
          <Avatar kind={activeKind} name={activeRoomName} size={38} />
          <span className="wa-chat__who">
            <strong>{activeRoomName}</strong>
            <span>
              {activeKind === 'global' ? `${committeeUsers.length} members · ${profile?.committee || ''}`
                : activeKind === 'bloc' ? 'Bloc group' : 'Direct message'}
            </span>
          </span>
          {lockedRooms.has(activeRoom) && <span className="wa-paused">Paused</span>}
        </header>

        <div className="wa-wall" ref={listRef} onScroll={onScroll}>
          {messages.length === 0 && (
            <div className="wa-empty"><span>No messages yet. Say hello.</span></div>
          )}
          {renderMessages()}
          <div ref={scrollRef} />
        </div>

        {showJump && (
          <button className="wa-jump" onClick={() => scrollToBottom()} aria-label="Jump to latest">
            {newBelow > 0 && <span className="wa-unread">{newBelow}</span>}
            <IconDown />
          </button>
        )}

        {isRoomLocked ? (
          <div className="wa-locked"><IconLock /> Only the chair can send messages here right now.</div>
        ) : (
          <form className="wa-composer" onSubmit={sendMessage}>
            {replyingTo && (
              <div className="wa-replying">
                <div className="wa-quote">
                  <span style={{ color: colorFor(senderName(replyingTo.users)) }}>Replying to {senderName(replyingTo.users)}</span>
                  <p>{replyingTo.content}</p>
                </div>
                <button type="button" className="wa-icon" onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><IconClose /></button>
              </div>
            )}
            <div className="wa-composer__row">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                placeholder="Message"
                aria-label={`Message ${activeRoomName}`}
                onChange={e => {
                  setInput(e.target.value);
                  e.currentTarget.style.height = '';
                  e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 140) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); sendMessage(); }
                  if (e.key === 'Escape' && replyingTo) setReplyingTo(null);
                }}
              />
              <button type="submit" className="wa-send" disabled={!input.trim()} aria-label="Send"><IconSend /></button>
            </div>
          </form>
        )}
      </section>

      {/* ── New message ── */}
      {isDMModal && (
        <div className="overlay" onClick={() => setIsDMModal(false)}>
          <div className="modal wa-modal" onClick={e => e.stopPropagation()}>
            <h2>New message</h2>
            <div className="wa-pick">
              {committeeUsers.filter((u: any) => u.id !== authUser?.id).map((u: any) => (
                <button key={u.id} className="wa-pick__row" onClick={() => startDM(u)}>
                  <Avatar kind="dm" name={u.delegation || u.role} size={36} />
                  <span><strong>{u.delegation || u.role}</strong><small>{u.role}</small></span>
                </button>
              ))}
            </div>
            <button className="logout-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setIsDMModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── New bloc ── */}
      {isBlocModal && (
        <div className="overlay" onClick={() => setIsBlocModal(false)}>
          <div className="modal wa-modal" onClick={e => e.stopPropagation()}>
            <h2>New bloc group</h2>
            <input className="dark-input" value={newBlocName} onChange={e => setNewBlocName(e.target.value)} placeholder="Bloc name" />
            <div className="wa-pick">
              {committeeUsers.filter((u: any) => u.role === 'Delegate' && u.id !== authUser?.id).map((u: any) => {
                const on = selectedUsers.includes(u.id);
                return (
                  <button key={u.id} className={`wa-pick__row${on ? ' is-on' : ''}`} onClick={() => setSelectedUsers(prev => on ? prev.filter(i => i !== u.id) : [...prev, u.id])}>
                    <Avatar kind="dm" name={u.delegation} size={36} />
                    <span><strong>{u.delegation}</strong></span>
                    <span className="wa-tick">{on && <IconCheck />}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="primary-btn" style={{ flex: 1, justifyContent: 'center' }} disabled={!newBlocName.trim() || selectedUsers.length === 0} onClick={handleCreateBloc}>
                Create{selectedUsers.length ? ` with ${selectedUsers.length}` : ''}
              </button>
              <button className="logout-btn" style={{ flex: 1, marginTop: 0, height: 44, justifyContent: 'center' }} onClick={() => { setIsBlocModal(false); setNewBlocName(''); setSelectedUsers([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
  .wa { display:grid; grid-template-columns:minmax(300px, 380px) minmax(0, 1fr); height:100vh; min-height:0; background:var(--bg); }

  /* list */
  .wa-list { display:flex; flex-direction:column; min-height:0; min-width:0; border-right:1px solid var(--border); background:var(--bg-2); }
  .wa-list__head { display:flex; align-items:center; justify-content:space-between; padding:20px 16px 12px 20px; }
  .wa-list__title { font-size:34px; color:var(--text-primary); }
  .wa-list__tools { display:flex; gap:6px; }
  .wa-icon { position:relative; width:38px; height:38px; border-radius:50%; border:0; background:transparent; color:var(--text-muted); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:background .2s, color .2s; }
  .wa-icon:hover { background:rgba(var(--tint),0.07); color:var(--text-primary); }
  .wa-newgroup { display:inline-flex; align-items:center; gap:6px; height:38px; padding:0 14px 0 11px; border-radius:99px; border:0; background:rgba(var(--tint),0.07); color:var(--text-primary); font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap; transition:background .2s; }
  .wa-newgroup:hover { background:rgba(var(--tint),0.12); }
  .wa-newgroup svg { color:var(--green-2); }
  .wa-list__tools { align-items:center; }
  .wa-icon--green { background:var(--green); color:#fff; }
  .wa-icon--green:hover { background:var(--green-2); color:#fff; }
  .wa-search { display:flex; align-items:center; gap:10px; margin:0 14px 10px; padding:0 14px; height:40px; border-radius:99px; background:rgba(var(--tint),0.06); color:var(--text-muted); }
  .wa-search input { border:0 !important; background:transparent; padding:0; margin:0; height:100%; font-size:14px; box-shadow:none !important; }
  .wa-rooms { flex:1; overflow-y:auto; padding:2px 8px 12px; }
  .wa-room { display:flex; align-items:center; gap:12px; width:100%; padding:10px 12px; border:0; background:transparent; border-radius:12px; cursor:pointer; text-align:left; color:var(--text-primary); }
  .wa-room:hover { background:rgba(var(--tint),0.04); }
  .wa-room.is-active { background:rgba(var(--tint),0.08); }
  .wa-room__body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
  .wa-room__top, .wa-room__bottom { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .wa-room__top strong { font-size:15px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wa-room__time { font-size:11.5px; color:var(--text-muted); flex-shrink:0; }
  .wa-room.has-unread .wa-room__time { color:var(--green-2); }
  .wa-room__preview { font-size:13.5px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wa-room.has-unread .wa-room__preview { color:var(--text-secondary); }
  .wa-unread { min-width:20px; height:20px; padding:0 6px; border-radius:99px; background:var(--green); color:#fff; font-size:11px; font-weight:600; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
  .wa-none { padding:24px; text-align:center; font-size:13px; color:var(--text-muted); }
  .wa-avatar { flex-shrink:0; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:rgba(var(--tint),0.08); color:var(--text-secondary); font-size:14px; font-weight:600; letter-spacing:.02em; }
  .wa-avatar svg { width:45%; height:45%; }

  /* conversation */
  .wa-chat { position:relative; display:flex; flex-direction:column; min-width:0; min-height:0; }
  .wa-chat__head { display:flex; align-items:center; gap:12px; padding:10px 16px; min-height:62px; border-bottom:1px solid var(--border); background:var(--bg-2); }
  .wa-back { display:none; }
  .wa-chat__who { flex:1; min-width:0; display:flex; flex-direction:column; }
  .wa-chat__who strong { font-size:15.5px; font-weight:500; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wa-chat__who span { font-size:12.5px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wa-paused { font-size:11px; font-weight:500; padding:3px 10px; border-radius:99px; background:rgba(239,68,68,0.12); color:#EF4444; }

  .wa-wall { flex:1; overflow-y:auto; padding:14px clamp(12px, 4vw, 56px) 10px; display:flex; flex-direction:column;
    background-color:var(--bg);
    background-image:radial-gradient(rgba(var(--tint),0.05) 1px, transparent 1px);
    background-size:18px 18px; }
  .wa-empty { margin:auto; }
  .wa-empty span, .wa-day span { display:inline-block; padding:6px 12px; border-radius:8px; background:var(--bg-2); color:var(--text-muted); font-size:12px; box-shadow:var(--shadow-sm); }
  .wa-day { text-align:center; margin:12px 0 8px; position:sticky; top:4px; z-index:2; }

  .wa-row { display:flex; align-items:center; gap:6px; margin-top:8px; max-width:min(78%, 640px); }
  .wa-row.cont { margin-top:2px; }
  .wa-row.me { align-self:flex-end; flex-direction:row-reverse; }
  .wa-row.them { align-self:flex-start; }
  .wa-bubble { position:relative; padding:6px 9px 7px 10px; border-radius:10px; font-size:14.5px; line-height:1.4; color:var(--text-primary); box-shadow:0 1px 0.5px rgba(0,0,0,0.13); min-width:72px; word-break:break-word; overflow-wrap:anywhere; }
  .them .wa-bubble { background:var(--bg-2); border-top-left-radius:3px; }
  .me .wa-bubble { background:color-mix(in srgb, var(--green) 30%, var(--bg-2)); border-top-right-radius:3px; }
  .cont .wa-bubble { border-radius:10px; }
  .wa-row:not(.cont).them .wa-bubble::before, .wa-row:not(.cont).me .wa-bubble::before { content:''; position:absolute; top:0; width:8px; height:13px; }
  .wa-row:not(.cont).them .wa-bubble::before { left:-7px; background:var(--bg-2); clip-path:polygon(100% 0, 0 0, 100% 100%); }
  .wa-row:not(.cont).me .wa-bubble::before { right:-7px; background:color-mix(in srgb, var(--green) 30%, var(--bg-2)); clip-path:polygon(0 0, 100% 0, 0 100%); }
  .wa-bubble.sending { opacity:.75; }
  .wa-name { display:block; font-size:12.5px; font-weight:600; margin-bottom:2px; }
  .wa-text { white-space:pre-wrap; }
  .wa-meta { float:right; display:inline-flex; align-items:center; gap:3px; margin:6px 0 -4px 10px; font-size:11px; color:var(--text-muted); white-space:nowrap; }
  .me .wa-meta svg { color:var(--green-2); }
  .wa-quote { margin:2px 0 6px; padding:6px 9px; border-radius:7px; border-left:3px solid currentColor; background:rgba(var(--tint),0.06); color:var(--green-2); }
  .wa-quote span { display:block; font-size:12px; font-weight:600; }
  .wa-quote p { font-size:13px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .wa-reply { width:30px; height:30px; border-radius:50%; border:0; background:var(--bg-2); color:var(--text-muted); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity .15s; flex-shrink:0; box-shadow:var(--shadow-sm); }
  .wa-row:hover .wa-reply, .wa-reply:focus-visible { opacity:1; }
  @media (hover: none) { .wa-reply { opacity:.55; } }

  .wa-jump { position:absolute; right:22px; bottom:84px; width:42px; height:42px; border-radius:50%; border:0; background:var(--bg-2); color:var(--text-secondary); box-shadow:var(--shadow-md); display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:3; }
  .wa-jump .wa-unread { position:absolute; top:-6px; right:-4px; }

  .wa-composer { padding:8px 12px 10px; background:var(--bg-2); border-top:1px solid var(--border); }
  .wa-composer__row { display:flex; align-items:flex-end; gap:8px; }
  .wa-composer textarea:focus, .wa-composer textarea:focus-visible, .wa-search input:focus-visible { outline:none; box-shadow:none !important; }
  .wa-composer textarea { flex:1; margin:0; min-height:44px; max-height:140px; padding:11px 16px; border-radius:22px !important; border:0 !important; background:var(--bg) !important; resize:none; font-size:15px; line-height:1.4; box-shadow:none !important; }
  .wa-send { width:44px; height:44px; border-radius:50%; border:0; background:var(--green); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:transform .2s, opacity .2s; }
  .wa-send:disabled { opacity:.4; cursor:default; }
  .wa-send:not(:disabled):active { transform:scale(.92); }
  .wa-replying { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .wa-replying .wa-quote { flex:1; min-width:0; margin:0; }
  .wa-locked { display:flex; align-items:center; justify-content:center; gap:8px; padding:16px; background:var(--bg-2); border-top:1px solid var(--border); color:var(--text-muted); font-size:13.5px; }

  .wa-modal { display:flex; flex-direction:column; gap:12px; max-height:80vh; }
  .wa-modal h2 { margin-bottom:4px; }
  .wa-pick { flex:1; overflow-y:auto; border:1px solid var(--border); border-radius:12px; }
  .wa-pick__row { display:flex; align-items:center; gap:12px; width:100%; padding:10px 14px; border:0; border-bottom:1px solid var(--border); background:transparent; color:var(--text-primary); text-align:left; cursor:pointer; }
  .wa-pick__row:last-child { border-bottom:0; }
  .wa-pick__row:hover, .wa-pick__row.is-on { background:rgba(var(--tint),0.05); }
  .wa-pick__row > span:nth-child(2) { flex:1; display:flex; flex-direction:column; }
  .wa-pick__row strong { font-size:14px; font-weight:500; }
  .wa-pick__row small { font-size:12px; color:var(--text-muted); }
  .wa-tick { width:22px; height:22px; border-radius:50%; border:2px solid var(--border-strong); display:flex; align-items:center; justify-content:center; color:#fff; }
  .is-on .wa-tick { background:var(--green); border-color:var(--green); }

  /* phone: list and conversation are separate screens */
  @media (max-width: 768px) {
    .wa { grid-template-columns:minmax(0, 1fr); height:calc(100dvh - 60px - env(safe-area-inset-bottom)); }
    .wa-chat { display:none; }
    .wa.is-open .wa-list { display:none; }
    .wa.is-open .wa-chat { display:flex; }
    .wa-back { display:inline-flex; margin-left:-8px; width:auto; padding:0 6px; border-radius:99px; gap:2px; }
    .wa-chat__head { padding:8px 10px; }
    .wa-row { max-width:86%; }
    .wa-jump { bottom:76px; right:14px; }
  }
`;
