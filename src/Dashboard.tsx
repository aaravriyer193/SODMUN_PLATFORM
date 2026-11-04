import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { chairGetAllMessages, bustSidebarCache } from './committeeApi';

const IconLock   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconFile   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconArrow  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IconTimer  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/><line x1="9" y1="2" x2="15" y2="2"/></svg>;
const IconUsers  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

export default function Dashboard() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile]             = useState<any>(null);
  const [allChats, setAllChats]           = useState<any[]>([]);
  const [blocs, setBlocs]                 = useState<any[]>([]);
  const [resolutions, setResolutions]     = useState<any[]>([]);
  const [delegateCount, setDelegateCount] = useState(0);
  const [messageCount, setMessageCount]     = useState<number | null>(null);

  const isChair = profile?.role !== 'Delegate' && profile?.role !== null;
  const hasFetched    = useRef(false);
  const feedDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setMessageCount(result.messages?.length ?? 0); // feed is already capped at 50; exact count not critical for chairs
      } catch (err) {
        console.error('chairGetAllMessages failed:', err);
      }

      // Parallel: delegate count (header-only) + blocs — no data payload
      const [{ count: delCount }, { data: allBlocs }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true })
          .eq('committee', userData.committee).eq('role', 'Delegate'),
        supabase.from('blocs').select('*').eq('committee', userData.committee),
      ]);
      setDelegateCount(delCount ?? 0);

      setBlocs(allBlocs || []);

      if ((allBlocs || []).length > 0) {
        const { data: res } = await supabase.from('resolutions').select('*').in('bloc_id', (allBlocs || []).map((b: any) => b.id));
        if (res) setResolutions(res);
      }
    } else {
      // ── DELEGATE: normal RLS-scoped queries ─────────────────────────────
      // Feed (limited payload) + exact count (header only) in parallel
      const [{ data: msgs }, { count: msgCount }] = await Promise.all([
        supabase.from('messages')
          .select('*, users!inner(role, delegation, committee)')
          .eq('users.committee', userData.committee)
          .or(`recipient_group.eq.${userData.committee},recipient_group.ilike.%${authUser?.id}%`)
          .order('timestamp', { ascending: false })
          .limit(30),
        supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('users.committee', userData.committee)
          .or(`recipient_group.eq.${userData.committee},recipient_group.ilike.%${authUser?.id}%`),
      ]);
      if (msgs) setAllChats(msgs);
      setMessageCount(msgCount ?? msgs?.length ?? 0);

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

  // Debounced feed prepend — batches rapid real-time updates into one render
  const prependToFeed = (msg: any) => {
    if (feedDebounce.current) clearTimeout(feedDebounce.current);
    feedDebounce.current = setTimeout(() => {
      setAllChats(prev => [msg, ...prev].slice(0, 50));
      setMessageCount(c => (c ?? 0) + 1);
    }, 250);
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
    global: { bg: 'var(--accent-soft)',         color: 'var(--accent-2)', label: 'Global' },
    bloc:   { bg: 'rgba(99,102,241,0.12)',      color: '#7C83F2',         label: 'Bloc'   },
    dm:     { bg: 'rgba(var(--tint),0.06)',     color: 'var(--text-muted)', label: 'DM'   },
  };

  const STATUS: Record<string, { label: string; color: string; bg: string }> = {
    draft:     { label: 'Draft',     color: 'var(--accent-2)', bg: 'var(--accent-soft)' },
    submitted: { label: 'Submitted', color: '#F59E0B',         bg: 'rgba(245,158,11,0.12)' },
    locked:    { label: 'Locked',    color: '#EF4444',         bg: 'rgba(239,68,68,0.12)' },
  };

  const timeAgo = (ts?: string) => {
    if (!ts) return '';
    const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  const initials = (u: any) => {
    const name = u?.role === 'Delegate' ? u?.delegation : u?.role;
    return (name || '?').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const stats = [
    { label: 'Blocs',       value: blocs.length,                      hint: isChair ? 'Alliances in committee' : 'You belong to',  to: '/chat' },
    { label: 'Resolutions', value: resolutions.length,                hint: isChair ? 'Drafts in committee' : 'Your bloc drafts',    to: '/resolutions' },
    { label: 'Messages',    value: messageCount ?? allChats.length,   hint: 'Across your channels',                                   to: '/chat' },
    ...(isChair ? [{ label: 'Delegates', value: delegateCount, hint: 'In your committee', to: '/committee' }] : []),
  ];

  return (
    <div className="container dash">
      <style>{`
        .dash { display:flex; flex-direction:column; gap:28px; }

        .dash-hero { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; flex-wrap:wrap; padding-bottom:28px; border-bottom:1px solid var(--border); }
        .dash-eyebrow { font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--green-mint); display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .dash-eyebrow i { width:3px; height:3px; border-radius:50%; background:currentColor; opacity:.6; }
        .dash-title { font-size:clamp(48px, 7vw, 104px); line-height:.9; margin:14px 0 12px; color:var(--text-primary); }
        .dash-sub { font-size:15px; color:var(--text-muted); }
        .dash-actions { display:flex; gap:10px; flex-wrap:wrap; }
        .dash-ghost { display:inline-flex; align-items:center; gap:8px; height:44px; padding:0 18px; border-radius:99px; border:0; background:transparent; box-shadow:inset 0 0 0 1px var(--border-strong); color:var(--text-primary); font-size:14px; font-weight:500; cursor:pointer; transition:background .3s var(--ease), color .3s var(--ease), box-shadow .3s var(--ease); }
        .dash-ghost:hover { background:var(--ink); color:var(--bg); box-shadow:none; }

        .dash-stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:12px; }
        .dash-stat { position:relative; text-align:left; padding:20px 22px 22px; border-radius:16px; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; overflow:hidden; transition:border-color .3s var(--ease), transform .5s var(--ease-out); }
        .dash-stat:hover { border-color:var(--accent-border); transform:translateY(-2px); }
        .dash-stat::after { content:''; position:absolute; left:0; right:0; bottom:0; height:2px; background:var(--green); transform:scaleX(0); transform-origin:left; transition:transform .6s var(--ease-out); }
        .dash-stat:hover::after { transform:scaleX(1); }
        .dash-stat__top { display:flex; justify-content:space-between; align-items:center; font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); }
        .dash-stat__top svg { opacity:0; transform:translateX(-4px); transition:opacity .3s, transform .5s var(--ease-out); color:var(--green-2); }
        .dash-stat:hover .dash-stat__top svg { opacity:1; transform:none; }
        .dash-stat__value { font-family:var(--display); font-size:60px; line-height:1; margin:18px 0 6px; color:var(--text-primary); }
        .dash-stat__hint { font-size:13px; color:var(--text-muted); }

        .dash-grid { display:grid; grid-template-columns:minmax(0, 1.6fr) minmax(0, 1fr); gap:20px; align-items:start; }
        .dash-side { display:flex; flex-direction:column; gap:20px; min-width:0; }
        .dash-card { border:1px solid var(--border); background:var(--bg-surface); border-radius:16px; overflow:hidden; min-width:0; }
        .dash-card__head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:18px 22px; border-bottom:1px solid var(--border); }
        .dash-card__title { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:500; color:var(--text-primary); }
        .dash-card__title svg { color:var(--green-mint); }
        .dash-card__count { font-family:var(--mono); font-size:11px; color:var(--text-muted); padding:2px 8px; border-radius:99px; background:rgba(var(--tint),0.05); }
        .dash-link { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-muted); background:none; border:0; cursor:pointer; padding:0; }
        .dash-link:hover { color:var(--text-primary); }
        .dash-live { width:7px; height:7px; border-radius:50%; background:var(--green); box-shadow:0 0 0 0 rgba(34,164,87,.5); animation:dash-pulse 2s infinite; }
        @keyframes dash-pulse { 0% { box-shadow:0 0 0 0 rgba(34,164,87,.45); } 70% { box-shadow:0 0 0 8px rgba(34,164,87,0); } 100% { box-shadow:0 0 0 0 rgba(34,164,87,0); } }

        .dash-feed { max-height:560px; overflow-y:auto; }
        .dash-msg { display:grid; grid-template-columns:36px minmax(0,1fr) auto; gap:12px; align-items:start; padding:14px 22px; border-bottom:1px solid var(--border); cursor:pointer; transition:background .2s; }
        .dash-msg:last-child { border-bottom:0; }
        .dash-msg:hover { background:rgba(var(--tint),0.03); }
        .dash-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:var(--mono); font-size:11px; font-weight:500; }
        .dash-msg__who { display:flex; align-items:center; gap:8px; min-width:0; font-size:13px; font-weight:500; color:var(--text-primary); }
        .dash-msg__who span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dash-chip { font-size:10px; font-weight:500; padding:2px 8px; border-radius:99px; letter-spacing:.02em; flex-shrink:0; }
        .dash-msg__text { font-size:13.5px; color:var(--text-secondary); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dash-msg__time { font-family:var(--mono); font-size:11px; color:var(--text-muted); padding-top:2px; }

        .dash-row { display:flex; align-items:center; gap:12px; width:100%; padding:13px 22px; border:0; border-bottom:1px solid var(--border); background:transparent; color:var(--text-primary); font-size:13.5px; text-align:left; cursor:pointer; transition:background .2s; }
        .dash-row:last-child { border-bottom:0; }
        .dash-row:hover { background:rgba(var(--tint),0.03); }
        .dash-row__main { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .dash-row__meta { font-family:var(--mono); font-size:11px; color:var(--text-muted); flex-shrink:0; }
        .dash-row__icon { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--green-2); flex-shrink:0; }
        .dash-row svg.chev { color:var(--text-muted); flex-shrink:0; }

        .dash-empty { padding:32px 22px; text-align:center; color:var(--text-muted); font-size:13.5px; display:flex; flex-direction:column; align-items:center; gap:12px; }
        .dash-empty strong { font-family:var(--display); font-weight:400; font-size:24px; color:var(--text-primary); }

        .dash-tool { display:flex; align-items:center; gap:14px; padding:18px 22px; border-radius:16px; border:1px solid var(--accent-border); background:linear-gradient(135deg, var(--accent-soft), transparent 70%); cursor:pointer; transition:transform .5s var(--ease-out); text-align:left; width:100%; color:var(--text-primary); }
        .dash-tool:hover { transform:translateY(-2px); }
        .dash-tool__icon { width:42px; height:42px; border-radius:12px; background:var(--green); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

        @media (max-width: 1000px) { .dash-grid { grid-template-columns:1fr; } }
        @media (max-width: 768px) {
          .dash { gap:20px; }
          .dash-stats { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
          .dash-stat { padding:16px; }
          .dash-stat:last-child:nth-child(odd) { grid-column:span 2; }
          .dash-stat__value { font-size:40px; margin:10px 0 4px; }
          .dash-stat__hint { font-size:12px; }
          .dash-hero { padding-bottom:20px; }
          .dash-actions { width:100%; flex-wrap:nowrap; }
          .dash-actions > button { flex:1; justify-content:center; padding:0 12px; }
          .dash-msg, .dash-row, .dash-card__head { padding-left:16px; padding-right:16px; }
        }
      `}</style>

      {/* Header */}
      <header className="dash-hero">
        <div>
          <p className="dash-eyebrow">
            <span>{greeting}</span><i /><span>{profile?.role || '…'}</span>{profile?.committee && <><i /><span>{profile.committee}</span></>}
          </p>
          <h1 className="dash-title">{profile?.delegation || profile?.role || ' '}</h1>
          <p className="dash-sub">{today} · here's what's happening in your committee.</p>
        </div>
        <div className="dash-actions">
          <button className="dash-ghost" onClick={() => navigate('/resolutions')}><IconFile /> Resolutions</button>
          {isChair ? (
            <button className="primary-btn" onClick={() => navigate('/timer')}><IconTimer /> Speakers timer</button>
          ) : (
            <button className="primary-btn" onClick={() => navigate('/chat')}>Open communications <IconArrow /></button>
          )}
        </div>
      </header>

      {/* Stats */}
      <section className="dash-stats" aria-label="Overview">
        {stats.map(st => (
          <button key={st.label} className="dash-stat" onClick={() => navigate(st.to)}>
            <div className="dash-stat__top"><span>{st.label}</span><IconArrow /></div>
            <div className="dash-stat__value">{st.value}</div>
            <div className="dash-stat__hint">{st.hint}</div>
          </button>
        ))}
      </section>

      <section className="dash-grid">
        {/* Activity */}
        <div className="dash-card">
          <div className="dash-card__head">
            <div className="dash-card__title"><span className="dash-live" aria-hidden="true" /> {isChair ? 'All committee activity' : 'Live activity'}</div>
            <button className="dash-link" onClick={() => navigate('/chat')}>Open chat <IconArrow /></button>
          </div>
          <div className="dash-feed">
            {allChats.map((m: any) => {
              const type = getChannelType(m.recipient_group);
              const chip = CHIP[type] ?? CHIP.global;
              return (
                <div key={m.id} className="dash-msg" onClick={() => navigate('/chat')}>
                  <div className="dash-avatar" style={{ background: chip.bg, color: chip.color }}>{initials(m.users)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="dash-msg__who">
                      <span>{getOfficialTitle(m.users)}</span>
                      <span className="dash-chip" style={{ background: chip.bg, color: chip.color }}>{chip.label}</span>
                    </div>
                    <p className="dash-msg__text">{m.content}</p>
                  </div>
                  <span className="dash-msg__time">{timeAgo(m.timestamp)}</span>
                </div>
              );
            })}
            {allChats.length === 0 && (
              <div className="dash-empty">
                <strong>Quiet for now</strong>
                Messages from your committee, blocs and DMs will appear here.
                <button className="dash-ghost" onClick={() => navigate('/chat')}>Start a conversation</button>
              </div>
            )}
          </div>
        </div>

        {/* Side */}
        <div className="dash-side">
          {isChair && (
            <button className="dash-tool" onClick={() => navigate('/timer')}>
              <span className="dash-tool__icon"><IconTimer /></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>Speakers timer</span>
                <span style={{ display: 'block', fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Run the General Speakers List with a live countdown</span>
              </span>
              <IconArrow />
            </button>
          )}

          <div className="dash-card">
            <div className="dash-card__head">
              <div className="dash-card__title"><IconLock /> {isChair ? 'Committee blocs' : 'My blocs'}</div>
              <span className="dash-card__count">{blocs.length}</span>
            </div>
            {blocs.map((b: any) => (
              <button key={b.id} className="dash-row" onClick={() => navigate('/chat')}>
                <span className="dash-row__icon"><IconUsers /></span>
                <span className="dash-row__main">{b.name}</span>
                <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
            {blocs.length === 0 && (
              <div className="dash-empty">
                {isChair ? 'No blocs have formed yet.' : 'Team up with allies to draft together.'}
                {!isChair && <button className="dash-ghost" onClick={() => navigate('/chat')}>Form a bloc</button>}
              </div>
            )}
          </div>

          <div className="dash-card">
            <div className="dash-card__head">
              <div className="dash-card__title"><IconFile /> {isChair ? 'Committee drafts' : 'My resolutions'}</div>
              <span className="dash-card__count">{resolutions.length}</span>
            </div>
            {resolutions.map((r: any) => {
              const st = STATUS[r.status || 'draft'] ?? STATUS.draft;
              return (
                <button key={r.id} className="dash-row" onClick={() => navigate('/resolutions')}>
                  <span className="dash-row__main">{r.title || 'Untitled resolution'}</span>
                  <span className="dash-chip" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  <span className="dash-row__meta">{timeAgo(r.updated_at || r.created_at)}</span>
                </button>
              );
            })}
            {resolutions.length === 0 && (
              <div className="dash-empty">
                No drafts yet.
                <button className="dash-ghost" onClick={() => navigate('/resolutions')}>Start a resolution</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
