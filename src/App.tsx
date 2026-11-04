import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from './api';
import { subscribeToMessagePoll, triggerImmediatePoll } from './committeeApi';
import { joinRoom, roomId, setCommitteeHandle } from './live';
import Login from './Login';
import Dashboard from './Dashboard';
import Chat from './Chat';
import Resolutions from './Resolutions';
import Announcements from './Announcements';
import SoddyBot from './SoddyBot';
import Schedule from './Schedule';
import SpeakersTimer from './SpeakersTimer';
import CommitteeManager from './CommitteeManager';
import SetPassword    from './auth-pages/SetPassword';
import ForgotPassword from './auth-pages/ForgotPassword';
import ResetPassword  from './auth-pages/ResetPassword';
import Onboarding     from './auth-pages/Onboarding';
import Loader from './Loader';
import ThemeSwitch from './ThemeSwitch';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Notification {
  id: string;
  sender: string;       // display name
  senderRole: string;
  content: string;
  room: string;         // recipient_group value
  roomLabel: string;
  timestamp: Date;
  read: boolean;
}

// ─── ICONS ────────────────────────────────────────────────────────────────────
const IconDash    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>;
const IconMega    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>;
const IconChat    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconDocs    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IconBot     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg>;
const IconCal     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconCommittee = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconTimer   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/><line x1="9" y1="2" x2="15" y2="2"/></svg>;
const IconPlus    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconLogout  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconChevron = ({ dir = 'left' }: { dir?: 'left'|'right' }) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{dir === 'left' ? <polyline points="15 18 9 12 15 6"/> : <polyline points="9 18 15 12 9 6"/>}</svg>;
const IconClose   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCheck   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconUsers   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconBell    = ({ dot }: { dot?: boolean }) => (
  <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    {dot && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid var(--bg)', display: 'block' }} />}
  </span>
);
const IconGlobe   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconLock    = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconDM      = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const timeAgo = (d: Date) => {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60)  return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
};

const roomIcon = (room: string) => {
  if (room.startsWith('dm_'))   return <IconDM />;
  if (room.startsWith('bloc_')) return <IconLock />;
  return <IconGlobe />;
};

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
const LoadingScreen = ({ label }: { label: string }) => (
  <div style={{ height:'100vh', width:'100vw', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,var(--bg) 0%,var(--bg-2) 100%)', position:'fixed', inset:0, zIndex:9999 }}>
    <Loader />
    <p style={{ marginTop:24, color:'var(--accent)', fontWeight:500, letterSpacing:'2.5px', textTransform:'uppercase', fontSize:'11px', opacity:0.75 }}>{label}…</p>
  </div>
);

// ─── TOAST ────────────────────────────────────────────────────────────────────
const Toast = ({ notif, onDismiss, onGo }: { notif: Notification; onDismiss: () => void; onGo: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="toast-card"
      onClick={onGo}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
          <span style={{ color:'var(--accent)', opacity:0.75, flexShrink:0 }}>{roomIcon(notif.room)}</span>
          <span style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'1px', color:'var(--accent)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {notif.roomLabel}
          </span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center', padding:2, flexShrink:0 }}
        ><IconClose /></button>
      </div>
      <p style={{ fontSize:'12px', fontWeight:500, color:'var(--text-primary)', margin:'4px 0 2px' }}>{notif.sender}</p>
      <p style={{ fontSize:'12px', color:'var(--text-secondary)', fontWeight:400, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
        {notif.content}
      </p>
      {/* Progress bar */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'rgba(var(--tint),0.06)', borderRadius:'0 0 14px 14px', overflow:'hidden' }}>
        <div className="toast-progress" />
      </div>
    </div>
  );
};

// ─── NOTIFICATION PANEL ───────────────────────────────────────────────────────
const NotifPanel = ({
  notifs, onClose, onMarkAllRead, onClear, onGoToRoom
}: {
  notifs: Notification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onClear: () => void;
  onGoToRoom: (notif: Notification) => void;
}) => {
  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className="notif-panel">
      {/* Header */}
      <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(var(--tint),0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>Notifications</span>
          {unread > 0 && (
            <span style={{ background:'var(--accent)', color:'#fff', fontSize:'10px', fontWeight:600, padding:'1px 6px', borderRadius:'99px' }}>{unread}</span>
          )}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {unread > 0 && (
            <button onClick={onMarkAllRead} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'11px', color:'var(--accent)', fontWeight:500, fontFamily:'var(--sans)', padding:'4px 8px', borderRadius:6, transition:'background 0.1s' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(34,164,87,0.07)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
            >Mark all read</button>
          )}
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:7, border:'1px solid rgba(var(--tint),0.09)', background:'rgba(var(--tint),0.03)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><IconClose /></button>
        </div>
      </div>

      {/* List */}
      <div style={{ maxHeight:340, overflowY:'auto' }}>
        {notifs.length === 0 ? (
          <div style={{ padding:'36px 16px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
            <p style={{ fontSize:'13px', color:'var(--text-muted)', fontWeight:500 }}>No notifications yet</p>
            <p style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:4 }}>New messages will appear here</p>
          </div>
        ) : (
          notifs.map(n => (
            <div
              key={n.id}
              onClick={() => onGoToRoom(n)}
              className={`notif-item ${!n.read ? 'notif-unread' : ''}`}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                {/* Unread dot */}
                <div style={{ width:7, height:7, borderRadius:'50%', background: n.read ? 'transparent' : 'var(--accent)', marginTop:5, flexShrink:0, transition:'background 0.2s' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                    <span style={{ color: n.read ? 'var(--text-muted)' : 'var(--accent)', opacity:0.85 }}>{roomIcon(n.room)}</span>
                    <span style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.8px', color: n.read ? 'var(--text-muted)' : 'var(--accent)' }}>{n.roomLabel}</span>
                    <span style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:400, marginLeft:'auto', whiteSpace:'nowrap' }}>{timeAgo(n.timestamp)}</span>
                  </div>
                  <p style={{ fontSize:'12px', fontWeight: n.read ? 500 : 700, color:'var(--text-primary)', marginBottom:2 }}>{n.sender}</p>
                  <p style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:400, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{n.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifs.length > 0 && (
        <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(var(--tint),0.07)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClear} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'11px', color:'var(--text-muted)', fontWeight:500, fontFamily:'var(--sans)', padding:'4px 8px', borderRadius:6, transition:'all 0.1s' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color='#DC2626'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color='var(--text-muted)'}
          >Clear all</button>
        </div>
      )}
    </div>
  );
};

// ─── NAV ITEM ─────────────────────────────────────────────────────────────────
const NavItem = ({ to, icon, label, badge, collapsed, isChair }: {
  to: string; icon: React.ReactNode; label: string;
  badge?: number; collapsed: boolean; isChair?: boolean;
}) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} title={collapsed ? label : undefined} style={{ textDecoration:'none', display:'block' }}>
      <div className={`nav-item ${isActive?'nav-active':''} ${isChair?'nav-chair':''}`} style={{ justifyContent:collapsed?'center':'flex-start' }}>
        <span className="nav-icon-wrap">{icon}</span>
        {!collapsed && <span className="nav-label">{label}</span>}
        {!collapsed && badge != null && badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
        {/* Collapsed badge dot */}
        {collapsed && badge != null && badge > 0 && (
          <span style={{ position:'absolute', top:4, right:4, width:7, height:7, borderRadius:'50%', background:'var(--accent)', border:'1.5px solid var(--border)' }} />
        )}
      </div>
    </Link>
  );
};

// ─── ROUTE GUARDS ─────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen label="Authenticating" />;
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const ChairRoute = ({ children, role, roleLoading }: { children: React.ReactNode; role: string|null; roleLoading: boolean }) => {
  if (roleLoading) return <LoadingScreen label="Verifying clearance" />;
  return role !== 'Delegate' && role !== null ? <>{children}</> : <Navigate to="/" />;
};

// ─── NEW BLOC MODAL ────────────────────────────────────────────────────────────
const NewBlocModal = ({ onClose, profile, authUser }: { onClose: ()=>void; profile: any; authUser: any }) => {
  const [step, setStep]           = useState<'name'|'members'>('name');
  const [blocName, setBlocName]   = useState('');
  const [users, setUsers]         = useState<any[]>([]);
  const [selected, setSelected]   = useState<string[]>([]);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('users').select('*').eq('committee', profile?.committee).eq('role','Delegate').neq('id', authUser?.id)
      .then(({ data }) => { if (data) setUsers(data); });
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);

  const handleCreate = async () => {
    if (!blocName.trim() || selected.length===0) return;
    setLoading(true);
    const { data: bloc } = await supabase.from('blocs').insert([{ name:blocName, committee:profile?.committee }]).select().single();
    if (bloc) await supabase.from('bloc_members').insert([authUser.id,...selected].map(uid=>({ user_id:uid, bloc_id:bloc.id })));
    setDone(true);
    setTimeout(onClose, 1300);
  };

  return (
    <div onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.15s ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}} .nbm{animation:modalIn 0.22s cubic-bezier(0.34,1.4,0.64,1);}`}</style>
      <div className="nbm" style={{ background:'var(--bg-elevated)', backdropFilter:'blur(24px)', border:'1px solid var(--border)', borderRadius:24, width:420, boxShadow:'0 32px 80px rgba(0,0,0,0.14),0 8px 24px rgba(0,0,0,0.07)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'24px 24px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'10px', fontWeight:500, textTransform:'uppercase', letterSpacing:'2px', color:'var(--accent)', marginBottom:4 }}>{step==='name'?'Step 1 of 2':'Step 2 of 2'}</p>
            <h2 style={{ fontSize:'18px', fontWeight:600, color:'var(--text-primary)', letterSpacing:'-0.5px', margin:0 }}>{done?'✓ Bloc Formed':step==='name'?'New Bloc Group Chat':'Add Delegates'}</h2>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'1px solid rgba(var(--tint),0.09)', background:'rgba(var(--tint),0.03)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}><IconClose /></button>
        </div>
        <div style={{ margin:'16px 24px 0', height:3, background:'rgba(var(--tint),0.06)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', width:step==='name'?'50%':'100%', background:'var(--accent)', borderRadius:99, transition:'width 0.3s ease' }} />
        </div>
        <div style={{ padding:'20px 24px 24px', display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
          {done ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(34,197,94,0.10)', border:'2px solid rgba(34,197,94,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:24 }}>✓</div>
              <p style={{ fontSize:'14px', color:'var(--text-secondary)', fontWeight:500 }}><strong style={{ color:'var(--text-primary)' }}>{blocName}</strong> created with {selected.length} member{selected.length!==1?'s':''}.</p>
            </div>
          ) : step==='name' ? (
            <>
              <input ref={inputRef} value={blocName} onChange={e=>setBlocName(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&blocName.trim()) setStep('members'); }} placeholder="e.g. Progressive Bloc, G7 Bloc…" style={{ width:'100%', padding:'13px 16px', border:'1px solid rgba(var(--tint),0.12)', borderRadius:12, fontSize:14, fontWeight:500, fontFamily:'var(--sans)', outline:'none', background:'var(--bg-2)', color:'var(--text-primary)', marginBottom:16, boxSizing:'border-box', transition:'border-color 0.15s,box-shadow 0.15s' }} onFocus={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.boxShadow='0 0 0 3px rgba(34,164,87,0.10)';}} onBlur={e=>{e.currentTarget.style.borderColor='rgba(var(--tint),0.12)';e.currentTarget.style.boxShadow='none';}} />
              <button disabled={!blocName.trim()} onClick={()=>setStep('members')} style={{ width:'100%', height:44, background:blocName.trim()?'var(--accent)':'rgba(var(--tint),0.06)', color:blocName.trim()?'#fff':'var(--text-muted)', border:'none', borderRadius:12, fontWeight:500, fontSize:13, cursor:blocName.trim()?'pointer':'not-allowed', fontFamily:'var(--sans)', transition:'all 0.15s', boxShadow:blocName.trim()?'0 4px 12px rgba(34,164,87,0.25)':'none' }}>Continue →</button>
            </>
          ) : (
            <>
              <p style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500, marginBottom:10 }}>Select delegates for <strong style={{ color:'var(--text-primary)' }}>{blocName}</strong></p>
              <div style={{ flex:1, overflowY:'auto', border:'1px solid rgba(var(--tint),0.09)', borderRadius:12, marginBottom:14, background:'var(--bg-2)' }}>
                {users.length===0 && <p style={{ padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No other delegates found</p>}
                {users.map((u,i) => { const s=selected.includes(u.id); return (
                  <div key={u.id} onClick={()=>toggle(u.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', cursor:'pointer', borderBottom:i<users.length-1?'1px solid rgba(var(--tint),0.06)':'none', background:s?'rgba(34,164,87,0.05)':'transparent', transition:'background 0.1s' }}>
                    <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${s?'var(--accent)':'rgba(var(--tint),0.15)'}`, background:s?'var(--accent)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.12s' }}>{s&&<span style={{ color:'#fff' }}><IconCheck /></span>}</div>
                    <span style={{ fontSize:13, fontWeight:500, color:s?'var(--text-primary)':'var(--text-secondary)' }}>{u.delegation}</span>
                  </div>
                ); })}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setStep('name')} style={{ width:40, height:44, background:'rgba(var(--tint),0.04)', border:'1px solid rgba(var(--tint),0.09)', borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', flexShrink:0 }}><IconChevron dir="left" /></button>
                <button disabled={selected.length===0||loading} onClick={handleCreate} style={{ flex:1, height:44, background:selected.length>0?'var(--accent)':'rgba(var(--tint),0.06)', color:selected.length>0?'#fff':'var(--text-muted)', border:'none', borderRadius:12, fontWeight:500, fontSize:13, cursor:selected.length>0?'pointer':'not-allowed', fontFamily:'var(--sans)', transition:'all 0.15s', boxShadow:selected.length>0?'0 4px 12px rgba(34,164,87,0.25)':'none' }}>
                  {loading?'Creating…':`Form Bloc${selected.length>0?` (${selected.length})`:''}` }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── APP SHELL ────────────────────────────────────────────────────────────────
const AppShell = () => {
  const { user, logout }          = useAuth();
  const [role, setRole]           = useState<string|null>(null);
  const [profile, setProfile]     = useState<any>(null);
  const [roleLoading, setRL]      = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [showBloc, setShowBloc]   = useState(false);
  const [showUserMenu, setShowUM] = useState(false);
  const [showNotifPanel, setShowNP] = useState(false);
  const [notifications, setNotifs] = useState<Notification[]>([]);
  const [toasts, setToasts]       = useState<Notification[]>([]);

  const userMenuRef  = useRef<HTMLDivElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);
  const profileRef   = useRef<any>(null);
  const location     = useLocation();

  const isChair = role !== 'Delegate' && role !== null;
  const unreadCount = notifications.filter(n => !n.read).length;
  const onChatPage  = location.pathname === '/chat';
  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  // ── Load profile ──
  useEffect(() => {
    if (user) {
      supabase.from('users').select('*').eq('id', user.id).single().then(({ data }) => {
        setProfile(data); profileRef.current = data;
        setRole(data?.role || 'Delegate');
        setRL(false);
      });
    } else { setRole(null); setRL(false); }
  }, [user]);

  // ── Live committee room: instant "new message" pings (no-op without a key) ──
  useEffect(() => {
    if (!user || !profile?.committee) return;
    const handle = joinRoom(
      roomId.committee(profile.committee),
      { userId: user.id, delegation: profile.delegation || profile.role || '', blockId: null, offset: null },
      {
        onPing: p => { if (p.type === 'message') triggerImmediatePoll(); },
        onStatus: connected => { if (connected) triggerImmediatePoll(); }, // catch up after (re)connect
      },
    );
    setCommitteeHandle(handle);
    return () => { handle.leave(); };
  }, [user?.id, profile?.committee]);

  // ── Notification listener — shared poller, no WebSocket ──
  // Subscribes to the same unified cross-tab poller Chat.tsx uses. This was
  // previously its own separate WebSocket channel (app_notifications),
  // meaning every user held TWO connections — one for Chat, one for this.
  // Now it's a third independent subscriber to the same single poll cycle,
  // adding zero extra server requests.
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToMessagePoll((incoming: any[]) => {
      incoming.forEach(async (msg: any) => {
        if (msg.sender_id === user.id) return;

        const { data: sender } = await supabase.from('users').select('role,delegation,committee').eq('id', msg.sender_id).single();
        const p = profileRef.current;

        const isGlobal = msg.recipient_group === p?.committee;
        const isDM     = msg.recipient_group?.startsWith('dm_') && msg.recipient_group?.includes(user.id);
        const isBloc   = msg.recipient_group?.startsWith('bloc_') && sender?.committee === p?.committee;

        if (!isGlobal && !isDM && !isBloc) return;

        let roomLabel = 'Committee';
        if (msg.recipient_group === p?.committee) roomLabel = 'Global Committee';
        else if (isDM) roomLabel = 'Direct Message';
        else if (isBloc) roomLabel = 'Bloc Bloc';

        const notif: Notification = {
          id: `${msg.id ?? Date.now()}-${Math.random()}`,
          sender: sender?.role === 'Delegate' ? (sender?.delegation || 'Delegate') : `${sender?.role} · ${sender?.committee}`,
          senderRole: sender?.role || '',
          content: msg.content,
          room: msg.recipient_group,
          roomLabel,
          timestamp: new Date(),
          read: false,
        };

        setNotifs(prev => [notif, ...prev].slice(0, 50));

        if (location.pathname !== '/chat') {
          setToasts(prev => [notif, ...prev].slice(0, 3));
        }
      });
    });
    return unsubscribe;
  }, [user]);

  // ── Mark notifications read when visiting chat ──
  useEffect(() => {
    if (onChatPage) {
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    }
  }, [onChatPage]);

  // ── Outside click handlers ──
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUM(false);
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) setShowNP(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const dismissToast = (id: string) => setToasts(p => p.filter(t => t.id !== id));

  const sidebarW = collapsed ? 68 : 240;

  return (
    <div style={{ display:'flex', height:'100vh', width:'100vw', overflow:'hidden', background:'var(--bg-base)', fontFamily:'var(--sans)' }}>
      <style>{`
        /* ── Nav item (website-style: quiet text, green active rail) ── */
        .nav-item { display:flex; align-items:center; gap:11px; padding:9px 12px; border-radius:10px; font-size:13.5px; font-weight:400; color:var(--text-muted); cursor:pointer; transition:color .3s var(--ease), background .3s var(--ease); border:0; margin-bottom:2px; white-space:nowrap; position:relative; user-select:none; letter-spacing:-0.005em; }
        .nav-label { flex:1; overflow:hidden; text-overflow:ellipsis; transition:opacity 0.15s; }
        .nav-item::before { content:''; position:absolute; left:0; top:9px; bottom:9px; width:2px; border-radius:2px; background:var(--green); transform:scaleY(0); transition:transform .4s var(--ease-out); }
        .nav-item:hover { background:var(--bg-2); color:var(--text-primary); }
        .nav-item.nav-active { background:var(--bg-3); color:var(--text-primary); }
        .nav-item.nav-active::before { transform:none; }
        .nav-item.nav-active .nav-icon-wrap { opacity:1; color:var(--green-2); }
        .nav-icon-wrap { display:flex; align-items:center; justify-content:center; flex-shrink:0; opacity:0.7; transition:opacity .3s; }
        .nav-item:hover .nav-icon-wrap { opacity:1; }
        .nav-badge { background:var(--green); color:#fff; font-family:var(--mono); font-size:10px; font-weight:500; padding:1px 7px; border-radius:99px; flex-shrink:0; }
        .nav-chair .nav-icon-wrap { color:var(--green-mint); }

        /* ── Section labels ── */
        .side-label { font-size:11px; font-weight:400; text-transform:uppercase; letter-spacing:.08em; color:var(--text-muted); padding-left:12px; margin-bottom:8px; }
        .side-label--green { color:var(--green-mint); }
        .side-rule { height:1px; background:var(--border); }

        /* ── Round icon buttons (toggle, bell) ── */
        .sidebar-toggle, .bell-btn { width:32px; height:32px; border-radius:99px; border:0; box-shadow:inset 0 0 0 1px var(--border); background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-muted); transition:all .3s var(--ease); flex-shrink:0; position:relative; }
        .sidebar-toggle:hover, .bell-btn:hover { background:var(--ink); color:var(--bg); box-shadow:none; }
        .bell-btn.has-unread { color:var(--green-2); box-shadow:inset 0 0 0 1px var(--accent-border); }

        /* ── New Bloc btn (ghost pill) ── */
        .new-bloc-btn { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; height:38px; padding:0 14px; border-radius:99px; border:0; box-shadow:inset 0 0 0 1px var(--line-2); background:transparent; color:var(--text-primary); font-size:13px; font-weight:500; cursor:pointer; transition:all .4s var(--ease); font-family:var(--sans); }
        .new-bloc-btn:hover { background:var(--green); color:#fff; box-shadow:none; }

        /* ── Notification panel ── */
        .notif-panel { position:fixed; bottom:80px; left:12px; width:320px; background:var(--bg-2); border:1px solid var(--border); border-radius:14px; box-shadow:var(--shadow-lg); overflow:hidden; animation:panelIn .35s var(--ease-out); z-index:600; }
        @keyframes panelIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

        .notif-item { padding:12px 16px; cursor:pointer; transition:background 0.1s; border-bottom:1px solid var(--border); }
        .notif-item:last-child { border-bottom:none; }
        .notif-item:hover { background:var(--bg-3); }
        .notif-item.notif-unread { background:var(--green-wash); }
        .notif-item.notif-unread:hover { background:rgba(34,164,87,0.18); }

        /* ── Toast ── */
        .toast-card { position:relative; background:var(--bg-2); border:1px solid var(--border); border-radius:14px; padding:14px 14px 16px; width:300px; box-shadow:var(--shadow-lg); overflow:hidden; animation:toastIn .5s var(--ease-out); transition:transform 0.15s, opacity 0.15s; }
        .toast-card:hover { transform:translateY(-2px); }
        @keyframes toastIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes toastProgress { from{width:100%} to{width:0%} }
        .toast-progress { height:100%; background:var(--green); border-radius:0 0 14px 14px; animation:toastProgress 5s linear forwards; }

        /* ── User footer ── */
        .user-footer { border-top:1px solid var(--border); padding-top:12px; margin-top:12px; }
        .user-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; cursor:pointer; transition:background .3s var(--ease); position:relative; }
        .user-row:hover { background:var(--bg-2); }
        .user-avatar { width:32px; height:32px; background:var(--green-deep); box-shadow:inset 0 0 0 1px var(--accent-border); border-radius:99px; display:flex; align-items:center; justify-content:center; font-family:var(--mono); font-size:11px; font-weight:500; color:var(--green-mint); flex-shrink:0; letter-spacing:0.02em; }
        .user-menu { position:fixed; bottom:72px; left:12px; width:220px; background:var(--bg-2); border:1px solid var(--border); border-radius:14px; box-shadow:var(--shadow-lg); overflow:hidden; animation:slideUp .35s var(--ease-out); z-index:700; }
        @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        .user-menu-item { display:flex; align-items:center; gap:10px; padding:11px 14px; font-size:13px; font-weight:400; color:var(--text-primary); cursor:pointer; transition:background 0.1s; font-family:var(--sans); }
        .user-menu-item:hover { background:var(--bg-3); }
        .user-menu-item.danger { color:#EF4444; }
        .user-menu-item.danger:hover { background:rgba(239,68,68,0.10); }
        .user-menu-divider { height:1px; background:var(--border); margin:4px 0; }

        /* ── Mobile overlay backdrop ── */
        .mobile-drawer-backdrop {
          position:fixed; inset:0; background:rgba(0,0,0,0.45);
          backdrop-filter:blur(6px); z-index:199;
          animation:fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }

        /* ── Mobile drawer ── */
        .mobile-drawer {
          position:fixed; top:0; left:0; bottom:0; width:280px;
          background:var(--bg-sidebar);
          backdrop-filter:saturate(200%) blur(24px);
          -webkit-backdrop-filter:saturate(200%) blur(24px);
          border-right:1px solid var(--border);
          z-index:200; padding:20px 12px 16px;
          display:flex; flex-direction:column;
          transform:translateX(-100%);
          transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
          box-shadow:4px 0 24px rgba(0,0,0,0.15);
        }
        .mobile-drawer.open { transform:translateX(0); }

        /* ── Bottom tab bar ── */
        .bottom-tab-bar {
          position:fixed; bottom:0; left:0; right:0; z-index:150;
          background:var(--bg-elevated);
          backdrop-filter:saturate(200%) blur(20px);
          -webkit-backdrop-filter:saturate(200%) blur(20px);
          border-top:1px solid var(--border);
          display:flex; align-items:center;
          padding:0 4px;
          padding-bottom:env(safe-area-inset-bottom);
          box-shadow:0 -4px 20px rgba(0,0,0,0.08);
          height:60px;
        }
        .tab-item {
          flex:1; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          gap:4px; padding:8px 4px;
          border-radius:12px; cursor:pointer;
          color:var(--text-muted); font-size:9px;
          font-weight:500; text-transform:uppercase;
          letter-spacing:0.5px; text-decoration:none;
          transition:color 0.12s, background 0.12s;
          position:relative;
        }
        .tab-item.active { color:var(--accent); }
        .tab-item:hover  { background:var(--accent-soft); color:var(--accent); }
        .tab-badge {
          position:absolute; top:4px; right:calc(50% - 16px);
          min-width:16px; height:16px; border-radius:99px;
          background:var(--accent); color:#fff;
          font-size:9px; font-weight:600;
          display:flex; align-items:center; justify-content:center;
          padding:0 4px;
          border:1.5px solid var(--bg-elevated);
        }
      `}</style>

      {/* ═══ SIDEBAR — desktop only ══════════════════════════════════════════════ */}
      {user && !isMobile && (
        <aside style={{ width:sidebarW, flexShrink:0, background:'var(--bg-sidebar)', backdropFilter:'saturate(200%) blur(24px)', WebkitBackdropFilter:'saturate(200%) blur(24px)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'20px 12px 16px', zIndex:100, transition:'width 0.22s cubic-bezier(0.4,0,0.2,1)', overflow:'visible', boxShadow:'2px 0 12px rgba(0,0,0,0.04)', minWidth:sidebarW, maxWidth:sidebarW }}>

          {/* Logo + collapse */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between', marginBottom:28, paddingLeft:collapsed?0:4 }}>
            {!collapsed && <Link to="/" className="brand" aria-label="SODMUN home"><span className="brand__mark" aria-hidden="true" />SODMUN</Link>}
            <button className="sidebar-toggle" onClick={()=>setCollapsed(c=>!c)} title={collapsed?'Expand':'Collapse'}>
              <IconChevron dir={collapsed?'right':'left'} />
            </button>
          </div>

          {/* Section label */}
          {!collapsed && <p className="side-label">Platform</p>}
          {collapsed  && <div className="side-rule" style={{ margin:'0 4px 10px' }} />}

          {/* Main nav */}
          <nav style={{ display:'flex', flexDirection:'column', gap:0 }}>
            <NavItem to="/"            icon={<IconDash />} label="Dashboard"      collapsed={collapsed} />
            <NavItem to="/announcements" icon={<IconMega />} label="Announcements"  collapsed={collapsed} />
            <NavItem to="/chat"        icon={<IconChat />} label="Communications" collapsed={collapsed} badge={unreadCount} />
            <NavItem to="/resolutions" icon={<IconDocs />} label="Resolutions"    collapsed={collapsed} />
            <NavItem to="/soddy"       icon={<IconBot  />} label="Soddy AI"       collapsed={collapsed} />
            <NavItem to="/schedule"    icon={<IconCal  />} label="Schedule"       collapsed={collapsed} />
          </nav>

          {/* New Bloc btn — delegates only */}
          {!isChair && (
            <div style={{ marginTop:16 }}>
              {!collapsed && <div className="side-rule" style={{ marginBottom:12 }} />}
              <button className="new-bloc-btn" onClick={()=>setShowBloc(true)} title="Form a new alliance" style={{ padding:collapsed?'9px 0':undefined, gap:collapsed?0:7 }}>
                <IconPlus />
                {!collapsed && 'New Bloc Group Chat'}
              </button>
            </div>
          )}

          {/* ── Chair section ── */}
          {isChair && (
            <div style={{ marginTop:16 }}>
              {!collapsed && <p className="side-label side-label--green">Chair</p>}
              {collapsed  && <div className="side-rule" style={{ margin:'4px 4px 8px' }} />}
              <NavItem to="/timer"       icon={<IconTimer />}     label="Speakers Timer"  collapsed={collapsed} isChair />
              <NavItem to="/committee"   icon={<IconCommittee />} label="Committee Mgr"  collapsed={collapsed} isChair />
            </div>
          )}

          <div style={{ flex:1 }} />

          {/* ── Theme ── */}
          <div style={{ padding:'0 4px 12px', display:'flex', justifyContent:'center' }}>
            {collapsed ? <ThemeSwitch compact /> : <div style={{ width:'100%' }}><ThemeSwitch /></div>}
          </div>

          {/* ── Notifications + User footer ── */}
          <div ref={notifPanelRef} style={{ position:'relative', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between', padding:'6px 4px', marginBottom:2 }}>
              {!collapsed && (
                <span className="side-label" style={{ marginBottom:0 }}>Notifications</span>
              )}
              <button
                className={`bell-btn ${unreadCount>0?'has-unread':''}`}
                onClick={()=>setShowNP(v=>!v)}
                title="Notifications"
              >
                <IconBell dot={unreadCount > 0} />
                {collapsed && unreadCount > 0 && (
                  <span style={{ position:'absolute', top:3, right:3, minWidth:14, height:14, borderRadius:99, background:'var(--accent)', color:'#fff', fontSize:8, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', border:'1.5px solid var(--border)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            </div>

            {showNotifPanel && (
              <NotifPanel
                notifs={notifications}
                onClose={() => setShowNP(false)}
                onMarkAllRead={() => setNotifs(p => p.map(n => ({...n, read:true})))}
                onClear={() => setNotifs([])}
                onGoToRoom={(notif) => {
                  setNotifs(p => p.map(n => n.id===notif.id ? {...n,read:true} : n));
                  setShowNP(false);
                  window.location.href = '/chat';
                }}
              />
            )}
          </div>

          {/* User row */}
          <div className="user-footer" ref={userMenuRef} style={{ position:'relative' }}>
            {showUserMenu && (
              <div className="user-menu">
                <div style={{ padding:'14px 14px 10px' }}>
                  <p style={{ fontSize:'12px', fontWeight:500, color:'var(--text-primary)', marginBottom:2 }}>{profile?.delegation||profile?.role}</p>
                  <p style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:500 }}>{profile?.role} · {profile?.committee}</p>
                </div>
                <div className="user-menu-divider" />
                {!isChair && (
                  <>
                    <div className="user-menu-item" onClick={()=>{ setShowBloc(true); setShowUM(false); }}><IconUsers /> New Bloc Group Chat</div>
                    <div className="user-menu-divider" />
                  </>
                )}

                <div className="user-menu-item danger" onClick={()=>{ logout(); setShowUM(false); }}><IconLogout /> Sign out</div>
              </div>
            )}
            <div className="user-row" onClick={()=>setShowUM(v=>!v)}>
              <div className="user-avatar">{(profile?.delegation||profile?.role||'?').slice(0,2).toUpperCase()}</div>
              {!collapsed && (
                <>
                  <div style={{ flex:1, minWidth:0, overflow:'hidden' }}>
                    <p style={{ fontSize:'12px', fontWeight:500, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.delegation||profile?.role}</p>
                    <p style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.committee}</p>
                  </div>
                  <div style={{ color:'var(--text-muted)', display:'flex', alignItems:'center', flexShrink:0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ═══ MOBILE DRAWER ══════════════════════════════════════════════════════ */}
      {user && isMobile && (
        <>
          {mobileOpen && <div className="mobile-drawer-backdrop" onClick={()=>setMobileOpen(false)} />}
          <div className={`mobile-drawer ${mobileOpen?'open':''}`}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:28, paddingLeft:4 }}>
              <Link to="/" className="brand" aria-label="SODMUN home"><span className="brand__mark" aria-hidden="true" />SODMUN</Link>
              <button className="sidebar-toggle" onClick={()=>setMobileOpen(false)}><IconClose /></button>
            </div>
            <p className="side-label">Platform</p>
            <nav style={{ display:'flex', flexDirection:'column', gap:0 }}>
              <NavItem to="/"            icon={<IconDash />} label="Dashboard"      collapsed={false} />
              <NavItem to="/announcements" icon={<IconMega />} label="Announcements"  collapsed={false} />
              <NavItem to="/chat"        icon={<IconChat />} label="Communications" collapsed={false} badge={unreadCount} />
              <NavItem to="/resolutions" icon={<IconDocs />} label="Resolutions"    collapsed={false} />
              <NavItem to="/soddy"       icon={<IconBot  />} label="Soddy AI"       collapsed={false} />
              <NavItem to="/schedule"    icon={<IconCal  />} label="Schedule"       collapsed={false} />
            </nav>
            {!isChair && (
              <div style={{ marginTop:16 }}>
                <div style={{ height:1, background:'var(--border)', marginBottom:12 }} />
                <button className="new-bloc-btn" onClick={()=>{ setShowBloc(true); setMobileOpen(false); }}>
                  <IconPlus /> New Bloc Group Chat
                </button>
              </div>
            )}
            {isChair && (
              <div style={{ marginTop:16 }}>
                <p className="side-label side-label--green">Chair</p>
                <NavItem to="/timer"     icon={<IconTimer />}     label="Speakers Timer" collapsed={false} isChair />
              <NavItem to="/committee" icon={<IconCommittee />} label="Committee Mgr" collapsed={false} isChair />
              </div>
            )}
            <div style={{ flex:1 }} />
            <div style={{ padding:'0 4px 12px' }}><ThemeSwitch /></div>
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:11 }}>
                <div className="user-avatar">{(profile?.delegation||profile?.role||'?').slice(0,2).toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'12px', fontWeight:500, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.delegation||profile?.role}</p>
                  <p style={{ fontSize:'10px', color:'var(--text-muted)', fontWeight:500 }}>{profile?.committee}</p>
                </div>
                <button onClick={logout} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center' }}><IconLogout /></button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ MAIN ═══════════════════════════════════════════════════════════════ */}
      <main style={{ flex:1, height:'100vh', overflowY:'auto', position:'relative', transition:'all 0.22s' }}>
        <Routes>
          <Route path="/login"        element={<Login />} />
          <Route path="/"             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/chat"         element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/resolutions"  element={<ProtectedRoute><Resolutions /></ProtectedRoute>} />
          <Route path="/soddy"        element={<ProtectedRoute><SoddyBot /></ProtectedRoute>} />
          <Route path="/schedule"     element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
          <Route path="/timer"        element={<ProtectedRoute><ChairRoute role={role} roleLoading={roleLoading}><SpeakersTimer /></ChairRoute></ProtectedRoute>} />
          <Route path="/committee"    element={<ProtectedRoute><ChairRoute role={role} roleLoading={roleLoading}><CommitteeManager /></ChairRoute></ProtectedRoute>} />
        </Routes>
      </main>

      {/* ═══ BOTTOM TAB BAR — mobile only ════════════════════════════════════════ */}
      {user && isMobile && (
        <nav className="bottom-tab-bar">
          {[
            { to:'/',            icon:<IconDash />,  label:'Home'  },
            { to:'/chat',        icon:<IconChat />,  label:'Chat', badge:unreadCount },
            { to:'/resolutions', icon:<IconDocs />,  label:'Docs'  },
            { to:'/soddy',       icon:<IconBot />,   label:'Soddy' },
          ].map(tab => (
            <Link key={tab.to} to={tab.to} className={`tab-item ${location.pathname===tab.to?'active':''}`}>
              {tab.badge ? <span className="tab-badge">{tab.badge > 9 ? '9+' : tab.badge}</span> : null}
              {tab.icon}
              {tab.label}
            </Link>
          ))}
          <div className="tab-item" onClick={()=>setMobileOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            More
          </div>
        </nav>
      )}

      {/* ═══ TOASTS ══════════════════════════════════════════════════════════════ */}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:3000, display:'flex', flexDirection:'column', gap:10, pointerEvents:'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents:'all' }}>
            <Toast
              notif={t}
              onDismiss={() => dismissToast(t.id)}
              onGo={() => {
                setNotifs(p => p.map(n => n.id===t.id ? {...n,read:true} : n));
                dismissToast(t.id);
                window.location.href = '/chat';
              }}
            />
          </div>
        ))}
      </div>

      {/* ═══ NEW BLOC MODAL ══════════════════════════════════════════════════════ */}
      {showBloc && profile && <NewBlocModal onClose={()=>setShowBloc(false)} profile={profile} authUser={user} />}
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* ── Bare auth routes — completely isolated, no AppShell ── */}
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/forgot"       element={<ForgotPassword />} />
          <Route path="/reset"        element={<ResetPassword />} />
          <Route path="/welcome"      element={<Onboarding />} />
          {/* ── Everything else goes through AppShell ── */}
          <Route path="/*"            element={<AppShell />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}