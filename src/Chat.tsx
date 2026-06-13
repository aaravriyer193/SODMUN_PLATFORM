import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { chairGetSidebar, chairGetRoomMessages, bustSidebarCache, appendToRoomCache } from './chairApi';

const IconGlobe   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconLock    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconSend    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IconPlus    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconEye     = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;

export default function Chat() {
  const { user: authUser } = useAuth();
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
  const scrollRef      = useRef<HTMLDivElement>(null);
  const activeRoomRef  = useRef(activeRoom);
  const knownDMRooms   = useRef<Set<string>>(new Set());

  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);
  useEffect(() => { if (authUser) initializeChat(); }, [authUser]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  const initializeChat = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;
    setProfile(userData);
    const chair = userData.role !== 'Delegate';
    setIsChair(chair);
    setActiveRoom(userData.committee);
    setActiveRoomName('Global Committee');
    await refreshSidebar(userData, chair);
  };

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const refreshSidebar = async (userData: any = profile, chair: boolean = isChair) => {
    if (!userData) return;

    if (chair) {
      // Use Edge Function — bypasses RLS entirely
      try {
        const result = await chairGetSidebar();
        setCommitteeUsers(result.committeeUsers || []);
        setChannels({ blocs: result.blocs || [], dms: result.dms || [] });
        // Seed known DM rooms so real-time doesn't re-fetch for existing ones
        (result.dms || []).forEach((dm: any) => knownDMRooms.current.add(dm.roomId));
      } catch (err) {
        console.error('chairGetSidebar failed:', err);
      }
    } else {
      // Delegate: normal RLS-scoped queries
      const { data: peers } = await supabase
        .from('users').select('*').eq('committee', userData.committee);
      if (peers) setCommitteeUsers(peers);

      const { data: memberOf } = await supabase
        .from('bloc_members').select('blocs(*)').eq('user_id', authUser?.id);
      const myBlocs = (memberOf?.map((b: any) => b.blocs) ?? []).filter(
        (b: any) => b && b.committee === userData.committee
      );

      const { data: myDMs } = await supabase
        .from('messages')
        .select('recipient_group')
        .ilike('recipient_group', `%${authUser?.id}%`)
        .filter('recipient_group', 'ilike', 'dm_%');

      const uniqueDMs = Array.from(new Set((myDMs || []).map((m: any) => m.recipient_group)));
      const mappedDMs = uniqueDMs.map(roomId => {
        const otherId = (roomId as string).replace('dm_', '').split('_').find(id => id !== authUser?.id);
        const peer = (peers || []).find((p: any) => p.id === otherId);
        return { roomId, name: peer ? (peer.delegation || peer.role) : 'Direct Signal' };
      });

      setChannels({ blocs: myBlocs, dms: mappedDMs });
    }
  };

  // ── Fetch messages for active room ─────────────────────────────────────────
  useEffect(() => {
    if (activeRoom) fetchMessages(activeRoom);
  }, [activeRoom]);

  const fetchMessages = async (roomId: string) => {
    try {
      if (isChair) {
        // Bypass RLS via Edge Function
        const result = await chairGetRoomMessages(roomId);
        setMessages(result.messages || []);
      } else {
        const { data } = await supabase
          .from('messages').select('*, users(*)')
          .eq('recipient_group', roomId)
          .order('timestamp', { ascending: true });
        if (data) setMessages(data);
      }
      scrollToBottom();
    } catch (err) {
      console.error('fetchMessages failed:', err);
    }
  };

  // ── Real-time ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel('chat_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        // Real-time still only delivers messages RLS allows the user to see.
        // For chairs: we re-fetch the room via the Edge Function when any new
        // message arrives in the currently-open room (even if RT didn't deliver it).
        if (isChair) {
          const rg = payload.new.recipient_group;
          if (rg === activeRoomRef.current) {
            // Fetch sender profile then append — no full re-fetch
            const { data: sender } = await supabase.from('users').select('*').eq('id', payload.new.sender_id).single();
            const msg = { ...payload.new, users: sender };
            setMessages(prev => [...prev, msg]);
            appendToRoomCache(rg, msg);
            scrollToBottom();
          }
          // Only bust sidebar if this is a DM room we haven't seen before
          if (rg?.startsWith('dm_') && !knownDMRooms.current.has(rg)) {
            knownDMRooms.current.add(rg);
            bustSidebarCache();
            refreshSidebar();
          }
          return;
        }

        // Delegate path: normal
        if (payload.new.recipient_group === activeRoomRef.current) {
          const { data: sender } = await supabase.from('users').select('*').eq('id', payload.new.sender_id).single();
          setMessages(prev => [...prev, { ...payload.new, users: sender }]);
          scrollToBottom();
        }
        // Only refresh sidebar for new DM rooms the delegate hasn't seen
        if (payload.new.recipient_group?.startsWith('dm_') && !knownDMRooms.current.has(payload.new.recipient_group)) {
          knownDMRooms.current.add(payload.new.recipient_group);
          refreshSidebar();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isChair]);

  const scrollToBottom = () => {
    setTimeout(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeRoom || isObserving) return;
    const content = input;
    setInput('');
    await supabase.from('messages').insert([{ sender_id: authUser?.id, content, recipient_group: activeRoom }]);
  };

  // ── Start DM ───────────────────────────────────────────────────────────────
  const startDM = (peer: any) => {
    const roomId = `dm_${[authUser?.id, peer.id].sort().join('_')}`;
    switchRoom(roomId, peer.delegation || peer.role);
    setIsDMModal(false);
  };

  // ── Create Bloc ────────────────────────────────────────────────────────────
  const handleCreateBloc = async () => {
    if (!newBlocName.trim() || selectedUsers.length === 0) return;
    const { data: bloc } = await supabase
      .from('blocs').insert([{ name: newBlocName, committee: profile?.committee }])
      .select().single();
    if (bloc) {
      await supabase.from('bloc_members').insert(
        [authUser?.id, ...selectedUsers].map(uid => ({ user_id: uid, bloc_id: bloc.id }))
      );
      bustSidebarCache();
      await refreshSidebar();
      setIsBlocModal(false); setNewBlocName(''); setSelectedUsers([]);
      switchRoom(`bloc_${bloc.id}`, bloc.name);
    }
  };

  const switchRoom = (id: string, name: string) => {
    setActiveRoom(id); setActiveRoomName(name); setMessages([]);
  };

  // Chair observing a DM they're not personally in
  const isObserving = isChair
    && activeRoom.startsWith('dm_')
    && !activeRoom.includes(authUser?.id ?? '');

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: '32px 32px 24px', gap: '20px', boxSizing: 'border-box' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .chat-shell { flex:1; display:flex; border-radius:20px; overflow:hidden; border:1px solid rgba(0,0,0,0.08); box-shadow:0 8px 32px rgba(0,0,0,0.07); background:rgba(255,255,255,0.55); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); min-height:0; }
        .chat-sidebar-inner { width:260px; flex-shrink:0; background:rgba(250,250,249,0.90); border-right:1px solid rgba(0,0,0,0.07); display:flex; flex-direction:column; padding:24px 16px; overflow-y:auto; }
        .chat-main-inner { flex:1; display:flex; flex-direction:column; background:#FAFAF9; min-width:0; }
        .ch-btn { display:flex; align-items:center; gap:9px; padding:9px 12px; border-radius:10px; cursor:pointer; font-size:13px; font-weight:600; transition:all 0.12s; margin-bottom:2px; border:1px solid transparent; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .ch-btn.active { background:rgba(240,124,0,0.12); color:#F07C00; border-color:rgba(240,124,0,0.20); }
        .ch-btn.inactive { color:#71717A; background:transparent; }
        .ch-btn.inactive:hover { background:rgba(0,0,0,0.04); color:#27272A; }
        .msg-wrap { display:flex; flex-direction:column; margin-bottom:16px; max-width:70%; }
        .msg-wrap.me { align-self:flex-end; align-items:flex-end; }
        .msg-wrap.them { align-self:flex-start; align-items:flex-start; }
        .msg-sender { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; color:#A1A1AA; }
        .msg-bubble { padding:10px 16px; border-radius:14px; font-size:14px; line-height:1.5; font-family:'Manrope',sans-serif; }
        .me .msg-bubble { background:#F07C00; color:#fff; border-bottom-right-radius:4px; box-shadow:0 2px 8px rgba(240,124,0,0.20); }
        .them .msg-bubble { background:#fff; color:#18181B; border-bottom-left-radius:4px; border:1px solid rgba(0,0,0,0.08); box-shadow:0 1px 4px rgba(0,0,0,0.04); }
        .plus-btn-sm { width:24px; height:24px; background:rgba(240,124,0,0.10); border:1px solid rgba(240,124,0,0.22); color:#F07C00; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.12s; }
        .plus-btn-sm:hover { background:#F07C00; color:#fff; }
        .sec-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:0 2px; }
        .sec-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:2px; color:#A1A1AA; }
        .observe-banner { display:flex; align-items:center; gap:7px; background:rgba(240,124,0,0.08); border-bottom:1px solid rgba(240,124,0,0.15); padding:8px 20px; font-size:11px; font-weight:700; color:#E07000; letter-spacing:0.3px; flex-shrink:0; }
        .obs-chip { font-size:9px; font-weight:700; background:rgba(113,113,122,0.10); color:#71717A; padding:1px 6px; border-radius:99px; letter-spacing:0.5px; flex-shrink:0; display:flex; align-items:center; gap:3px; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:99px; }
      `}</style>

      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <h1 className="delegation-brand">Communications</h1>
          <p style={{ color:'#F07C00', fontWeight:600, fontSize:'12px', marginTop:'4px' }}>{profile?.committee} Network</p>
        </div>
        {isChair && (
          <div style={{ fontSize:11, fontWeight:700, color:'#F07C00', background:'rgba(240,124,0,0.08)', border:'1px solid rgba(240,124,0,0.20)', borderRadius:99, padding:'5px 14px', letterSpacing:'0.5px', textTransform:'uppercase' }}>
            Chair View — Full Access
          </div>
        )}
      </div>

      <div className="chat-shell">
        {/* ── Sidebar ── */}
        <div className="chat-sidebar-inner">
          <div className="sec-label" style={{ marginBottom:'8px' }}>Public</div>
          <div className={`ch-btn ${activeRoom === profile?.committee ? 'active' : 'inactive'}`} onClick={() => switchRoom(profile?.committee, 'Global Committee')}>
            <span style={{ opacity:0.7 }}><IconGlobe /></span> Global Committee
          </div>

          <div className="sec-header" style={{ marginTop:'20px' }}>
            <span className="sec-label">Bloc Alliances</span>
            {!isChair && <button className="plus-btn-sm" onClick={() => setIsBlocModal(true)}><IconPlus /></button>}
          </div>
          <div style={{ maxHeight:'180px', overflowY:'auto' }}>
            {channels.blocs.length === 0 && <p style={{ fontSize:12, color:'#C4C4C4', padding:'4px 4px 8px', fontWeight:500 }}>No alliances yet</p>}
            {channels.blocs.map((b: any) => (
              <div key={b.id} className={`ch-btn ${activeRoom === `bloc_${b.id}` ? 'active' : 'inactive'}`} onClick={() => switchRoom(`bloc_${b.id}`, b.name)}>
                <span style={{ opacity:0.7 }}><IconLock /></span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>{b.name}</span>
              </div>
            ))}
          </div>

          <div className="sec-header" style={{ marginTop:'20px' }}>
            <span className="sec-label">{isChair ? 'All DMs' : 'Direct Messages'}</span>
            <button className="plus-btn-sm" onClick={() => setIsDMModal(true)}><IconPlus /></button>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {channels.dms.length === 0 && <p style={{ fontSize:12, color:'#C4C4C4', padding:'4px 4px 8px', fontWeight:500 }}>No messages yet</p>}
            {channels.dms.map((dm: any) => (
              <div key={dm.roomId} title={dm.name} className={`ch-btn ${activeRoom === dm.roomId ? 'active' : 'inactive'}`} onClick={() => switchRoom(dm.roomId, dm.name)}>
                <span style={{ opacity:0.7 }}><IconMessage /></span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{dm.name}</span>
                {isChair && !dm.roomId.includes(authUser?.id ?? '') && (
                  <span className="obs-chip"><IconEye />obs</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Main ── */}
        <div className="chat-main-inner">
          <div style={{ padding:'16px 24px', borderBottom:'1px solid rgba(0,0,0,0.07)', background:'rgba(255,255,255,0.80)', backdropFilter:'blur(8px)', flexShrink:0 }}>
            <h2 style={{ fontSize:'15px', fontWeight:700, color:'#18181B', margin:0 }}>{activeRoomName}</h2>
          </div>

          {isObserving && (
            <div className="observe-banner">
              <IconEye /> Chair observation mode — read-only
            </div>
          )}

          <div style={{ flex:1, padding:'24px', overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {messages.length === 0 && (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <p style={{ fontSize:13, color:'#C4C4C4', fontWeight:500 }}>No messages in this channel yet</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={m.id ?? i} className={`msg-wrap ${m.sender_id === authUser?.id ? 'me' : 'them'}`}>
                <span className="msg-sender">{m.users?.role} · {m.users?.delegation || m.users?.committee}</span>
                <div className="msg-bubble">{m.content}</div>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          {!isObserving && (
            <form onSubmit={sendMessage} style={{ padding:'16px 20px', borderTop:'1px solid rgba(0,0,0,0.07)', background:'rgba(255,255,255,0.80)', display:'flex', gap:'10px', alignItems:'center', flexShrink:0 }}>
              <input
                style={{ flex:1, background:'#fff', border:'1px solid rgba(0,0,0,0.10)', color:'#18181B', padding:'12px 16px', borderRadius:'12px', fontSize:'14px', fontFamily:'Manrope,sans-serif', outline:'none', transition:'border-color 0.15s' }}
                value={input} onChange={e => setInput(e.target.value)}
                placeholder={`Message ${activeRoomName}…`}
                onFocus={e => e.currentTarget.style.borderColor='#F07C00'}
                onBlur={e => e.currentTarget.style.borderColor='rgba(0,0,0,0.10)'}
              />
              <button type="submit" style={{ background:'#F07C00', border:'none', color:'#fff', width:'44px', height:'44px', borderRadius:'12px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(240,124,0,0.25)' }}>
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
            <div style={{ maxHeight:'280px', overflowY:'auto', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'12px', overflow:'hidden' }}>
              {committeeUsers.filter((u: any) => u.id !== authUser?.id).map((u: any) => (
                <div key={u.id} onClick={() => startDM(u)}
                  style={{ padding:'13px 16px', cursor:'pointer', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:'13px', fontWeight:600, display:'flex', alignItems:'center', gap:'10px', transition:'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(240,124,0,0.05)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
                >
                  <span style={{ fontSize:'10px', fontWeight:700, background: u.role !== 'Delegate' ? 'rgba(240,124,0,0.10)' : 'rgba(0,0,0,0.06)', color: u.role !== 'Delegate' ? '#F07C00' : '#71717A', padding:'2px 8px', borderRadius:'99px', textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>{u.role}</span>
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
            <h2>Form a Bloc</h2>
            <input className="dark-input" value={newBlocName} onChange={e => setNewBlocName(e.target.value)} placeholder="Bloc name…" />
            <div style={{ maxHeight:'160px', overflowY:'auto', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'12px', overflow:'hidden', marginBottom:'14px' }}>
              {committeeUsers.filter((u: any) => u.role === 'Delegate' && u.id !== authUser?.id).map((u: any) => (
                <div key={u.id}
                  onClick={() => setSelectedUsers(prev => prev.includes(u.id) ? prev.filter(i => i !== u.id) : [...prev, u.id])}
                  style={{ padding:'11px 16px', cursor:'pointer', borderBottom:'1px solid rgba(0,0,0,0.06)', fontSize:'13px', fontWeight:600, background: selectedUsers.includes(u.id) ? 'rgba(240,124,0,0.08)' : 'transparent', color: selectedUsers.includes(u.id) ? '#F07C00' : '#27272A', display:'flex', alignItems:'center', gap:'10px', transition:'all 0.1s' }}
                >
                  <div style={{ width:'16px', height:'16px', borderRadius:'4px', border:`2px solid ${selectedUsers.includes(u.id)?'#F07C00':'rgba(0,0,0,0.15)'}`, background: selectedUsers.includes(u.id)?'#F07C00':'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {selectedUsers.includes(u.id) && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {u.delegation}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <button className="primary-btn" style={{ flex:1, height:'44px' }} onClick={handleCreateBloc}>Initialize</button>
              <button className="logout-btn" style={{ flex:1, height:'44px', marginTop:0 }} onClick={() => { setIsBlocModal(false); setNewBlocName(''); setSelectedUsers([]); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}