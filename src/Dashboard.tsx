import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { chairGetAllMessages, bustSidebarCache } from './chairApi';

const IconGlobe  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconLock   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconFile   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconArrow  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IconTimer  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/><line x1="9" y1="2" x2="15" y2="2"/></svg>;
const IconUsers  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

export default function Dashboard() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile]             = useState<any>(null);
  const [allChats, setAllChats]           = useState<any[]>([]);
  const [blocs, setBlocs]                 = useState<any[]>([]);
  const [resolutions, setResolutions]     = useState<any[]>([]);
  const [delegateCount, setDelegateCount] = useState(0);

  const isChair = profile?.role !== 'Delegate' && profile?.role !== null;
  const hasFetched = useRef(false);

  useEffect(() => { if (authUser && !hasFetched.current) { hasFetched.current = true; fetchDashboardData(); } }, [authUser]);

  const fetchDashboardData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;
    setProfile(userData);
    const chair = userData.role !== 'Delegate';

    if (chair) {
      // ── CHAIR: use Edge Function to bypass RLS ──────────────────────────
      try {
        const result = await chairGetAllMessages(50);
        setAllChats(result.messages || []);
      } catch (err) {
        console.error('chairGetAllMessages failed:', err);
      }

      // These are committee-scoped so RLS passes for a chair in the committee
      const { data: peers } = await supabase.from('users').select('*').eq('committee', userData.committee);
      setDelegateCount((peers || []).filter((p: any) => p.role === 'Delegate').length);

      const { data: allBlocs } = await supabase.from('blocs').select('*').eq('committee', userData.committee);
      setBlocs(allBlocs || []);

      if ((allBlocs || []).length > 0) {
        const { data: res } = await supabase.from('resolutions').select('*').in('bloc_id', (allBlocs || []).map((b: any) => b.id));
        if (res) setResolutions(res);
      }
    } else {
      // ── DELEGATE: normal RLS-scoped queries ─────────────────────────────
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, users!inner(role, delegation, committee)')
        .eq('users.committee', userData.committee)
        .or(`recipient_group.eq.${userData.committee},recipient_group.ilike.%${authUser?.id}%`)
        .order('timestamp', { ascending: false })
        .limit(30);
      if (msgs) setAllChats(msgs);

      const { data: memberOf } = await supabase.from('bloc_members').select('bloc_id, blocs(*)').eq('user_id', authUser?.id);
      const blocData = (memberOf?.map((b: any) => b.blocs) ?? []).filter(
        (b: any) => b && b.committee === userData.committee
      );
      setBlocs(blocData);

      if (blocData.length > 0) {
        const { data: res } = await supabase.from('resolutions').select('*').in('bloc_id', blocData.map((b: any) => b.id));
        if (res) setResolutions(res);
      }
    }
  };

  const getOfficialTitle = (u: any) => {
    if (!u) return 'System';
    return u.role === 'Delegate' ? u.delegation : `${u.role} · ${u.committee}`;
  };

  const getChannelType = (rg: string) => {
    if (!rg) return 'global';
    if (rg.startsWith('dm_'))   return 'dm';
    if (rg.startsWith('bloc_')) return 'bloc';
    return 'global';
  };

  const CHIP: Record<string, { bg: string; color: string; label: string }> = {
    global: { bg: 'rgba(240,124,0,0.10)',   color: '#F07C00', label: 'Global' },
    bloc:   { bg: 'rgba(99,102,241,0.10)',  color: '#6366F1', label: 'Bloc'   },
    dm:     { bg: 'rgba(113,113,122,0.10)', color: '#71717A', label: 'DM'     },
  };

  return (
    <div className="container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .dash-stat-card { background:rgba(255,255,255,0.80); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.7); border-radius:16px; padding:20px 22px; box-shadow:0 2px 8px rgba(0,0,0,0.05); }
        .timer-quick-card { background:linear-gradient(135deg,rgba(240,124,0,0.10) 0%,rgba(255,173,71,0.08) 100%); border:1.5px solid rgba(240,124,0,0.25); border-radius:16px; padding:18px 20px; cursor:pointer; transition:all 0.18s; position:relative; overflow:hidden; }
        .timer-quick-card:hover { background:linear-gradient(135deg,rgba(240,124,0,0.15) 0%,rgba(255,173,71,0.12) 100%); border-color:rgba(240,124,0,0.40); transform:translateY(-1px); box-shadow:0 6px 20px rgba(240,124,0,0.15); }
        .feed-item { display:flex; gap:14px; padding:14px 0; border-bottom:1px solid rgba(0,0,0,0.06); cursor:pointer; transition:all 0.12s; }
        .feed-item:last-child { border-bottom:none; }
        .feed-item:hover { padding-left:4px; }
        .feed-dot { width:8px; height:8px; border-radius:50%; margin-top:6px; flex-shrink:0; }
        .side-card { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px; border:1px solid rgba(0,0,0,0.07); background:rgba(255,255,255,0.75); cursor:pointer; margin-bottom:8px; transition:all 0.15s; font-size:13px; font-weight:600; color:#27272A; }
        .side-card:hover { border-color:rgba(240,124,0,0.30); background:rgba(255,255,255,0.95); transform:translateX(2px); }
        .side-card:last-child { margin-bottom:0; }
        .channel-chip { font-size:9px; font-weight:700; padding:2px 7px; border-radius:99px; letter-spacing:0.5px; flex-shrink:0; }
      `}</style>

      {/* Header */}
      <div className="top-bar">
        <div>
          <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'#F07C00', marginBottom:'6px' }}>
            {profile?.role} · {profile?.committee}
          </p>
          <h1 className="delegation-brand">{profile?.delegation || profile?.role}</h1>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
        {!isChair && (
          <button className="primary-btn" onClick={() => navigate('/chat')} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            New Bloc <IconArrow />
          </button>
        )}
      </div>

      {/* Timer quick-access — chairs only */}
      {isChair && (
        <div className="timer-quick-card" onClick={() => navigate('/timer')}
          style={{ marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(240,124,0,0.15)', border:'1.5px solid rgba(240,124,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', color:'#F07C00', flexShrink:0 }}>
              <IconTimer />
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:800, color:'#18181B', letterSpacing:'-0.2px', marginBottom:2 }}>Speakers Timer</p>
              <p style={{ fontSize:11, fontWeight:500, color:'#71717A' }}>Manage your General Speakers List with a live countdown</p>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, color:'#F07C00', fontWeight:700, fontSize:12, flexShrink:0 }}>
            Open <IconArrow />
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns: isChair ? 'repeat(4,1fr)' : 'repeat(3,1fr)', gap:'16px', marginBottom:'28px' }}>
        <div className="dash-stat-card">
          <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'#A1A1AA', marginBottom:'8px' }}>Blocs</p>
          <p style={{ fontSize:'28px', fontWeight:800, color:'#18181B', letterSpacing:'-1px' }}>{blocs.length}</p>
        </div>
        <div className="dash-stat-card">
          <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'#A1A1AA', marginBottom:'8px' }}>Resolutions</p>
          <p style={{ fontSize:'28px', fontWeight:800, color:'#18181B', letterSpacing:'-1px' }}>{resolutions.length}</p>
        </div>
        <div className="dash-stat-card">
          <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'#A1A1AA', marginBottom:'8px' }}>Messages</p>
          <p style={{ fontSize:'28px', fontWeight:800, color:'#18181B', letterSpacing:'-1px' }}>{allChats.length}</p>
        </div>
        {isChair && (
          <div className="dash-stat-card">
            <p style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'#A1A1AA', marginBottom:'8px' }}>Delegates</p>
            <p style={{ fontSize:'28px', fontWeight:800, color:'#18181B', letterSpacing:'-1px' }}>{delegateCount}</p>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="main-grid">
        {/* Feed */}
        <div className="panel">
          <span className="label"><IconGlobe /> {isChair ? 'All Committee Activity' : 'Intelligence Feed'}</span>
          <div style={{ maxHeight:'600px', overflowY:'auto' }}>
            {allChats.map((m: any) => {
              const type = getChannelType(m.recipient_group);
              const chip = CHIP[type] ?? CHIP.global;
              return (
                <div key={m.id} className="feed-item" onClick={() => navigate('/chat')}>
                  <div className="feed-dot" style={{ background: chip.color }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px', gap:8 }}>
                      <span style={{ fontSize:'11px', fontWeight:700, color:chip.color, textTransform:'uppercase', letterSpacing:'0.5px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {getOfficialTitle(m.users)}
                      </span>
                      <span className="channel-chip" style={{ background:chip.bg, color:chip.color }}>{chip.label}</span>
                    </div>
                    <p style={{ fontSize:'13px', color:'#52525B', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.content}</p>
                  </div>
                </div>
              );
            })}
            {allChats.length === 0 && (
              <p style={{ color:'#A1A1AA', fontSize:'13px', textAlign:'center', padding:'32px 0' }}>No messages yet</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
          {isChair && (
            <div className="panel">
              <span className="label"><IconUsers /> Committee Overview</span>
              <div className="side-card" onClick={() => navigate('/timer')} style={{ borderColor:'rgba(240,124,0,0.20)', background:'rgba(240,124,0,0.04)' }}>
                <span style={{ color:'#F07C00' }}><IconTimer /></span>
                <span>Speakers Timer</span>
                <span style={{ marginLeft:'auto', color:'#F07C00' }}><IconArrow /></span>
              </div>
              <div className="side-card" onClick={() => navigate('/chat')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>All Messages</span>
                <span style={{ marginLeft:'auto', color:'#A1A1AA' }}><IconArrow /></span>
              </div>
            </div>
          )}

          <div className="panel">
            <span className="label"><IconLock /> {isChair ? 'Committee Alliances' : 'My Alliances'}</span>
            {blocs.map((b: any) => (
              <div key={b.id} className="side-card" onClick={() => navigate('/chat')}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#F07C00', flexShrink:0 }} />
                {b.name}
              </div>
            ))}
            {blocs.length === 0 && <p style={{ color:'#A1A1AA', fontSize:'13px' }}>No blocs yet</p>}
          </div>

          <div className="panel">
            <span className="label"><IconFile /> {isChair ? 'Committee Drafts' : 'My Resolutions'}</span>
            {resolutions.map((r: any) => (
              <div key={r.id} className="side-card" onClick={() => navigate('/resolutions')}>
                <span style={{ color:'#A1A1AA', flexShrink:0 }}><IconFile /></span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
              </div>
            ))}
            {resolutions.length === 0 && <p style={{ color:'#A1A1AA', fontSize:'13px' }}>No resolutions yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}