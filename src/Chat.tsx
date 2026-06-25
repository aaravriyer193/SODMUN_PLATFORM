import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { subscribeToMessagePoll, triggerImmediatePoll } from './committeeApi';

const IconGlobe   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconLock    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconSend    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconPlus    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconBell    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IconBellOff = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IconReply   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>;
const IconClose   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconChevronLeft = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;

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

// mobile = <= 768px
function useIsMobile() {
  const [m, setM] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return m;
}

export default function Chat() {
  const { user: authUser } = useAuth();
  const isMobile = useIsMobile();

  const [profile, setProfile]               = useState<any>(null);
  const [isChair, setIsChair]               = useState(false);
  const [channels, setChannels]             = useState<{ blocs: any[]; dms: any[] }>({ blocs: [], dms: [] });
  const [committeeUsers, setCommitteeUsers] = useState<any[]>([]);
  const [messages, setMessages]             = useState<any[]>([]);
  const [input, setInput]                   = useState('');
  const [activeRoom, setActiveRoom]         = useState<string>('');
  const [activeRoomName, setActiveRoomName] = useState<string>('Global Committee');
  const [isDMModal, setIsDMModal]           = useState(false);
  const [isBlocModal, setIsBlocModal]       = useState(false);
  const [newBlocName, setNewBlocName]       = useState('');
  const [selectedUsers, setSelectedUsers]   = useState<string[]>([]);
  const [lockedRooms, setLockedRooms]       = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts]     = useState<Map<string, number>>(new Map());
  const [soundEnabled, setSoundEnabled]     = useState(() => localStorage.getItem('sodmun_notif_sound') !== 'false');
  const [replyingTo, setReplyingTo]         = useState<any | null>(null);
  const [hoveredMsgId, setHoveredMsgId]     = useState<string | null>(null);

  // Mobile view: 'channels' = fullscreen channel list, 'chat' = fullscreen chat
  const [mobileView, setMobileView]         = useState<'channels' | 'chat'>('channels');

  const scrollRef       = useRef<HTMLDivElement>(null);
  const activeRoomRef   = useRef(activeRoom);
  const knownDMRooms    = useRef<Set<string>>(new Set());
  const profileRef      = useRef<any>(null);
  const soundEnabledRef = useRef(true);
  const inputRef        = useRef<HTMLInputElement>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
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
    setIsChair(userData.role !== 'Delegate');
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setActiveRoom(userData.committee);
      setActiveRoomName('Global Committee');
      // On mobile, start on channel list
      if (window.innerWidth <= 768) setMobileView('channels');
      else setMobileView('chat');
    }
    await refreshSidebar(userData);
  };

  const refreshSidebar = async (userData: any = profile) => {
    if (!userData) return;
    const { data: peers } = await supabase.from('users').select('*').eq('committee', userData.committee);
    if (peers) setCommitteeUsers(peers);
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
  };

  useEffect(() => { if (activeRoom) fetchMessages(activeRoom); }, [activeRoom]);

  const fetchMessages = async (roomId: string) => {
    try {
      const { data } = await supabase.from('messages')
        .select('*, users(*), reply_to_message:reply_to(id, content, users(role, delegation, committee))')
        .eq('recipient_group', roomId).order('timestamp', { ascending: true });
      if (data) setMessages(data);
      setUnreadCounts(prev => { const m = new Map(prev); m.delete(roomId); return m; });
      scrollToBottom();
    } catch (e) { console.error(e); }
  };

  const handlePollResults = useCallback((incoming: any[], lockedRoomsList: string[] | null) => {
    if (lockedRoomsList !== null) setLockedRooms(new Set(lockedRoomsList));
    if (incoming.length === 0) return;
    const relevantToActiveRoom = incoming.some((m: any) => m.recipient_group === activeRoomRef.current);
    if (relevantToActiveRoom && activeRoomRef.current) fetchMessages(activeRoomRef.current);
    incoming.forEach((m: any) => {
      const rg = m.recipient_group;
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
  const scrollToBottom = () => setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom || isRoomLocked) return;
    const content = input;
    const replyToId = replyingTo?.id ?? null;
    setInput('');
    setReplyingTo(null);
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, sender_id: authUser?.id, content,
      recipient_group: activeRoom, timestamp: new Date().toISOString(),
      users: profile,
      reply_to_message: replyingTo ? { id: replyingTo.id, content: replyingTo.content, users: replyingTo.users } : null,
      _sending: true,
    }]);
    scrollToBottom();
    try {
      await supabase.from('messages').insert([{ sender_id: authUser?.id, content, recipient_group: activeRoom, reply_to: replyToId }]);
      await pollForMessages();
    } finally {
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
    setActiveRoom(id);
    setActiveRoomName(name);
    setMessages([]);
    setUnreadCounts(prev => { const m = new Map(prev); m.delete(id); return m; });
    setReplyingTo(null);
    // On mobile, go to chat view after selecting a channel
    setMobileView('chat');
  };

  const isRoomLocked = lockedRooms.has(activeRoom) && !isChair;
  const totalUnread = Array.from(unreadCounts.values()).reduce((a, b) => a + b, 0);

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
      const replied = m.reply_to_message;
      const msgId = m.id ?? String(i);
      items.push(
        <div key={msgId} className={`msg-wrap ${isMe ? 'me' : 'them'}`}
          onMouseEnter={() => setHoveredMsgId(msgId)}
          onMouseLeave={() => setHoveredMsgId(null)}
          style={{ position:'relative' }}
        >
          <span className="msg-sender">{m.users?.role} · {m.users?.delegation || m.users?.committee}</span>
          {replied && (
            <div className={`reply-preview ${isMe ? 'reply-me' : 'reply-them'}`}>
              <span className="reply-preview-author">{replied.users?.delegation || replied.users?.role || 'Unknown'}</span>
              <span className="reply-preview-text">{replied.content}</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
            <div className={`msg-bubble ${m._sending ? 'msg-sending' : ''}`}>{m.content}</div>
            {!m._sending && hoveredMsgId === msgId && (
              <button className="reply-btn" onClick={() => { setReplyingTo(m); setTimeout(() => inputRef.current?.focus(), 50); }} title="Reply">
                <IconReply />
              </button>
            )}
          </div>
          <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500, marginTop:3, alignSelf: isMe ? 'flex-end' : 'flex-start', display:'flex', alignItems:'center', gap:4 }}>
            {m._sending ? <span className="sending-dots"><span/><span/><span/></span> : formatTime(m.timestamp || m.created_at)}
          </span>
        </div>
      );
    });
    return items;
  };

  // ── Channel list (used in sidebar on desktop, fullscreen on mobile) ────────
  const ChannelList = ({ mobile = false }: { mobile?: boolean }) => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-sidebar)', ...(mobile ? { position:'fixed', inset:0, zIndex:300, paddingBottom:'calc(env(safe-area-inset-bottom) + 60px)' } : {}) }}>
      {/* Header */}
      <div style={{ padding: mobile ? '20px 16px 12px' : '24px 16px 12px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {mobile ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Communications</h2>
              <p style={{ fontSize:11, color:'var(--accent)', fontWeight:600, marginTop:2 }}>{profile?.committee} Network</p>
            </div>
            <button onClick={toggleSound} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:9, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color: soundEnabled ? 'var(--accent)' : 'var(--text-muted)', flexShrink:0 }}>
              {soundEnabled ? <IconBell /> : <IconBellOff />}
            </button>
          </div>
        ) : (
          <div className="sec-label">Channels</div>
        )}
      </div>

      {/* Scrollable channel list */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 12px' }}>
        {/* Global */}
        <div style={{ marginBottom:4 }}>
          <div className="sec-label" style={{ marginBottom:6, paddingLeft:4 }}>Public</div>
          <div className={`ch-btn ${activeRoom === profile?.committee ? 'active' : 'inactive'}`}
            onClick={() => switchRoom(profile?.committee, 'Global Committee')}>
            <span style={{ opacity:0.7 }}><IconGlobe /></span>
            <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis' }}>Global Committee</span>
            {lockedRooms.has(profile?.committee) && <span className="lock-chip">Paused</span>}
            {(unreadCounts.get(profile?.committee) ?? 0) > 0 && activeRoom !== profile?.committee && (
              <span className="unread-dot">{unreadCounts.get(profile?.committee)}</span>
            )}
          </div>
        </div>

        {/* Blocs */}
        <div style={{ marginTop:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, padding:'0 2px' }}>
            <div className="sec-label">Bloc Group Chats</div>
            {!isChair && <button className="plus-btn-sm" onClick={() => setIsBlocModal(true)}><IconPlus /></button>}
          </div>
          {channels.blocs.length === 0 && <p style={{ fontSize:12, color:'var(--text-muted)', padding:'4px 4px 8px', fontWeight:500 }}>No blocs yet</p>}
          {channels.blocs.map((b: any) => (
            <div key={b.id} className={`ch-btn ${activeRoom === `bloc_${b.id}` ? 'active' : 'inactive'}`}
              onClick={() => switchRoom(`bloc_${b.id}`, b.name)}>
              <span style={{ opacity:0.7 }}><IconLock /></span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>{b.name}</span>
              {lockedRooms.has(`bloc_${b.id}`) && <span className="lock-chip">Paused</span>}
              {(unreadCounts.get(`bloc_${b.id}`) ?? 0) > 0 && activeRoom !== `bloc_${b.id}` && (
                <span className="unread-dot">{unreadCounts.get(`bloc_${b.id}`)}</span>
              )}
            </div>
          ))}
        </div>

        {/* DMs */}
        <div style={{ marginTop:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, padding:'0 2px' }}>
            <div className="sec-label">Direct Messages</div>
            <button className="plus-btn-sm" onClick={() => setIsDMModal(true)}><IconPlus /></button>
          </div>
          {channels.dms.length === 0 && <p style={{ fontSize:12, color:'var(--text-muted)', padding:'4px 4px 8px', fontWeight:500 }}>No messages yet</p>}
          {channels.dms.map((dm: any) => (
            <div key={dm.roomId} className={`ch-btn ${activeRoom === dm.roomId ? 'active' : 'inactive'}`}
              onClick={() => switchRoom(dm.roomId, dm.name)}>
              <span style={{ opacity:0.7 }}><IconMessage /></span>
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{dm.name}</span>
              {(unreadCounts.get(dm.roomId) ?? 0) > 0 && activeRoom !== dm.roomId && (
                <span className="unread-dot">{unreadCounts.get(dm.roomId)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer on mobile */}
      {mobile && (
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1px' }}>{profile?.delegation || profile?.role} · {profile?.committee}</p>
        </div>
      )}
    </div>
  );

  // ── Chat view ──────────────────────────────────────────────────────────────
  const ChatView = ({ mobile = false }: { mobile?: boolean }) => (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg-base)', ...(mobile ? { position:'fixed', inset:0, zIndex:300, paddingBottom:'calc(env(safe-area-inset-bottom) + 60px)' } : {}) }}>
      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-elevated)', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
        {mobile && (
          <button onClick={() => setMobileView('channels')}
            style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--accent)', display:'flex', alignItems:'center', padding:4, flexShrink:0 }}>
            <IconChevronLeft />
          </button>
        )}
        <h2 style={{ fontSize:'15px', fontWeight:700, color:'var(--text-primary)', margin:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeRoomName}</h2>
        {lockedRooms.has(activeRoom) && (
          <span style={{ fontSize:10, fontWeight:800, color:'#DC2626', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.20)', borderRadius:99, padding:'3px 10px', letterSpacing:'1px', textTransform:'uppercase' }}>Paused</span>
        )}
        {!mobile && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:99, padding:'4px 10px' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 0 2px rgba(34,197,94,0.15)' }} />
              <span style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)' }}>Synced</span>
            </div>
            <button onClick={toggleSound} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color: soundEnabled ? 'var(--accent)' : 'var(--text-muted)' }}>
              {soundEnabled ? <IconBell /> : <IconBellOff />}
            </button>
          </div>
        )}
      </div>

      {isRoomLocked && (
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(220,38,38,0.07)', borderBottom:'1px solid rgba(220,38,38,0.18)', padding:'10px 20px', fontSize:12, fontWeight:700, color:'#DC2626', flexShrink:0 }}>
          <IconLock /> This channel has been paused by the Chair
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, padding:'16px 16px', overflowY:'auto', display:'flex', flexDirection:'column' }}>
        {messages.length === 0 && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <p style={{ fontSize:13, color:'var(--text-muted)', fontWeight:500 }}>No messages in this channel yet</p>
          </div>
        )}
        {renderMessages()}
        <div ref={scrollRef} />
      </div>

      {/* Reply bar */}
      {replyingTo && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', background:'var(--bg-surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ color:'var(--accent)', flexShrink:0 }}><IconReply /></div>
          <div style={{ flex:1, minWidth:0, borderLeft:'3px solid var(--accent)', paddingLeft:8 }}>
            <span style={{ display:'block', fontWeight:800, fontSize:11, color:'var(--accent)', marginBottom:2 }}>{replyingTo.users?.delegation || replyingTo.users?.role}</span>
            <span style={{ display:'block', fontSize:12, color:'var(--text-secondary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{replyingTo.content}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4 }}><IconClose /></button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', background:'var(--bg-elevated)', display:'flex', gap:'10px', alignItems:'center', flexShrink:0 }}>
        <input
          ref={inputRef}
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
    </div>
  );

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', padding: isMobile ? 0 : '32px 32px 24px', gap: isMobile ? 0 : '20px', boxSizing:'border-box' }} className="chat-page-wrap">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .chat-shell { flex:1; display:flex; border-radius:20px; overflow:hidden; border:1px solid var(--border); box-shadow:var(--shadow-md); background:var(--bg-surface); min-height:0; }
        .chat-sidebar-inner { width:260px; flex-shrink:0; border-right:1px solid var(--border); overflow:hidden; }
        .chat-main-inner { flex:1; min-width:0; overflow:hidden; }
        .ch-btn { display:flex; align-items:center; gap:9px; padding:10px 12px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:600; transition:all 0.12s; margin-bottom:2px; border:1px solid transparent; position:relative; }
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
        @keyframes msgSendPulse { 0%,100%{opacity:0.6} 50%{opacity:0.95} }
        .sending-dots { display:inline-flex; gap:3px; align-items:center; }
        .sending-dots span { width:3px; height:3px; border-radius:50%; background:var(--text-muted); animation:sendDotBounce 1.1s ease-in-out infinite; }
        .sending-dots span:nth-child(2){animation-delay:0.15s} .sending-dots span:nth-child(3){animation-delay:0.3s}
        @keyframes sendDotBounce { 0%,80%,100%{opacity:0.3;transform:translateY(0)} 40%{opacity:1;transform:translateY(-2px)} }
        .plus-btn-sm { width:24px; height:24px; background:var(--accent-soft); border:1px solid var(--accent-mid); color:var(--accent); border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.12s; }
        .plus-btn-sm:hover { background:var(--accent); color:#fff; }
        .sec-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:var(--text-muted); }
        .lock-chip { font-size:9px; font-weight:700; background:rgba(220,38,38,0.10); color:#DC2626; padding:1px 6px; border-radius:99px; flex-shrink:0; }
        .reply-preview { border-left:3px solid var(--accent); border-radius:8px; padding:6px 10px; margin-bottom:4px; max-width:100%; overflow:hidden; }
        .reply-me { background:rgba(240,124,0,0.15); }
        .reply-them { background:var(--bg-surface); border-color:var(--text-muted); }
        .reply-preview-author { display:block; font-size:10px; font-weight:800; color:var(--accent); letter-spacing:0.5px; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .reply-them .reply-preview-author { color:var(--text-secondary); }
        .reply-preview-text { display:block; font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:500; }
        .reply-btn { background:var(--bg-elevated); border:1px solid var(--border); border-radius:8px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-muted); flex-shrink:0; transition:all 0.12s; }
        .reply-btn:hover { background:var(--accent-soft); color:var(--accent); border-color:var(--accent-mid); }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.25);border-radius:99px}
        @media (max-width:768px) {
          .msg-wrap { max-width:88%; }
          .chat-page-wrap { height:100vh; }
        }
      `}</style>

      {isMobile ? (
        /* ── MOBILE: fullscreen channel list OR fullscreen chat ── */
        mobileView === 'channels'
          ? <ChannelList mobile />
          : <ChatView mobile />
      ) : (
        /* ── DESKTOP: sidebar + chat side by side ── */
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <div>
              <h1 className="delegation-brand">Communications</h1>
              <p style={{ color:'var(--accent)', fontWeight:600, fontSize:'12px', marginTop:'4px' }}>{profile?.committee} Network</p>
            </div>
          </div>
          <div className="chat-shell">
            <div className="chat-sidebar-inner">
              <ChannelList />
            </div>
            <div className="chat-main-inner">
              <ChatView />
            </div>
          </div>
        </>
      )}

      {/* ── DM Modal ── */}
      {isDMModal && (
        <div className="overlay">
          <div className="modal" style={{ display:'flex', flexDirection:'column', maxHeight:'80vh' }}>
            <h2>Start a Direct Message</h2>
            <div style={{ flex:1, overflowY:'auto', border:'1px solid var(--border)', borderRadius:'12px' }}>
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
          <div className="modal" style={{ display:'flex', flexDirection:'column', maxHeight:'80vh' }}>
            <h2>New Bloc Group Chat</h2>
            <input className="dark-input" value={newBlocName} onChange={e => setNewBlocName(e.target.value)} placeholder="Bloc name…" />
            <div style={{ flex:1, overflowY:'auto', border:'1px solid var(--border)', borderRadius:'12px', marginBottom:'14px' }}>
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