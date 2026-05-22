import React, { useEffect, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

const IconGlobe = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const IconLock = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>;
const IconFile = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>;
const IconArrow = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>;

export default function Dashboard() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [blocs, setBlocs] = useState<any[]>([]);
  const [resolutions, setResolutions] = useState<any[]>([]);

  const isChair = profile?.role !== 'Delegate' && profile?.role !== null;

  useEffect(() => { if (authUser) fetchDashboardData(); }, [authUser]);

  const fetchDashboardData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;
    setProfile(userData);

    const { data: msgs } = await supabase
      .from('messages')
      .select('*, users!inner(role, delegation, committee)')
      .eq('users.committee', userData.committee)
      .or(`recipient_group.eq.${userData.committee},recipient_group.ilike.%${authUser?.id}%`)
      .order('timestamp', { ascending: false })
      .limit(30);
    if (msgs) setAllChats(msgs);

    let blocData;
    if (userData.role !== 'Delegate') {
      const { data } = await supabase.from('blocs').select('*').eq('committee', userData.committee);
      blocData = data || [];
    } else {
      const { data: memberOf } = await supabase.from('bloc_members').select('bloc_id, blocs(*)').eq('user_id', authUser?.id);
      blocData = memberOf?.map(b => b.blocs).filter(b => b.committee === userData.committee) || [];
    }
    setBlocs(blocData);

    if (blocData.length > 0) {
      const { data: res } = await supabase.from('resolutions').select('*, blocs!inner(committee)').eq('blocs.committee', userData.committee).in('bloc_id', blocData.map(b => b.id));
      if (res) setResolutions(res);
    }
  };

  const getOfficialTitle = (u: any) => {
    if (!u) return 'System';
    return u.role === 'Delegate' ? u.delegation : `${u.role} · ${u.committee}`;
  };

  return (
    <div className="container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .dash-stat-card {
          background: rgba(255,255,255,0.80);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.7);
          border-radius: 16px;
          padding: 20px 22px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .feed-item {
          display: flex;
          gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          cursor: pointer;
          transition: all 0.12s;
        }
        .feed-item:last-child { border-bottom: none; }
        .feed-item:hover { padding-left: 4px; }

        .feed-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 6px;
          flex-shrink: 0;
        }

        .side-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.07);
          background: rgba(255,255,255,0.75);
          cursor: pointer;
          margin-bottom: 8px;
          transition: all 0.15s;
          font-size: 13px;
          font-weight: 600;
          color: #27272A;
        }
        .side-card:hover {
          border-color: rgba(240,124,0,0.30);
          background: rgba(255,255,255,0.95);
          transform: translateX(2px);
        }
        .side-card:last-child { margin-bottom: 0; }
      `}</style>

      {/* Header */}
      <div className="top-bar">
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#F07C00', marginBottom: '6px' }}>
            {profile?.role} · {profile?.committee}
          </p>
          <h1 className="delegation-brand">{profile?.delegation || profile?.role}</h1>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
        {!isChair && (
          <button className="primary-btn" onClick={() => navigate('/chat')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            New Bloc <IconArrow />
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div className="dash-stat-card">
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#A1A1AA', marginBottom: '8px' }}>Alliances</p>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#18181B', letterSpacing: '-1px' }}>{blocs.length}</p>
        </div>
        <div className="dash-stat-card">
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#A1A1AA', marginBottom: '8px' }}>Resolutions</p>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#18181B', letterSpacing: '-1px' }}>{resolutions.length}</p>
        </div>
        <div className="dash-stat-card">
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#A1A1AA', marginBottom: '8px' }}>Messages</p>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#18181B', letterSpacing: '-1px' }}>{allChats.length}</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="main-grid">
        {/* Intelligence Feed */}
        <div className="panel">
          <span className="label"><IconGlobe /> Intelligence Feed</span>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {allChats.map(m => {
              const isDM = m.recipient_group?.startsWith('dm_');
              return (
                <div key={m.id} className="feed-item" onClick={() => navigate('/chat')}>
                  <div className="feed-dot" style={{ background: isDM ? '#71717A' : '#F07C00' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isDM ? '#71717A' : '#F07C00', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {getOfficialTitle(m.users)}
                      </span>
                      {isDM && (
                        <span style={{ fontSize: '9px', fontWeight: 700, background: 'rgba(113,113,122,0.10)', color: '#71717A', padding: '2px 7px', borderRadius: '99px', letterSpacing: '0.5px' }}>
                          DM
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: '#52525B', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.content}
                    </p>
                  </div>
                </div>
              );
            })}
            {allChats.length === 0 && (
              <p style={{ color: '#A1A1AA', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No messages yet</p>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Alliances */}
          <div className="panel">
            <span className="label"><IconLock /> {isChair ? 'Committee Alliances' : 'My Alliances'}</span>
            {blocs.map(b => (
              <div key={b.id} className="side-card" onClick={() => navigate('/chat')}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F07C00', flexShrink: 0 }} />
                {b.name}
              </div>
            ))}
            {blocs.length === 0 && <p style={{ color: '#A1A1AA', fontSize: '13px' }}>No alliances yet</p>}
          </div>

          {/* Resolutions */}
          <div className="panel">
            <span className="label"><IconFile /> {isChair ? 'Committee Drafts' : 'My Resolutions'}</span>
            {resolutions.map(r => (
              <div key={r.id} className="side-card" onClick={() => navigate('/resolutions')}>
                <span style={{ color: '#A1A1AA', flexShrink: 0 }}><IconFile /></span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
              </div>
            ))}
            {resolutions.length === 0 && <p style={{ color: '#A1A1AA', fontSize: '13px' }}>No resolutions yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}