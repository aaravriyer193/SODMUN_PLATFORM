import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from './api';
import { subscribeToMessagePoll } from './committeeApi';
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
import logo from './assets/logo.png';

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
    {dot && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#F07C00', border: '1.5px solid #fff', display: 'block' }} />}
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
  <div style={{ height:'100vh', width:'100vw', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#F5F3EF 0%,#FEF3E6 100%)', position:'fixed', inset:0, zIndex:9999 }}>
    <Loader />
    <p style={{ marginTop:24, color:'#F07C00', fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', fontSize:'11px', opacity:0.75 }}>{label}…</p>
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
          <span style={{ color:'#F07C00', opacity:0.75, flexShrink:0 }}>{roomIcon(notif.room)}</span>
          <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', color:'#F07C00', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {notif.roomLabel}
          </span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDismiss(); }}
          style={{ background:'transparent', border:'none', cursor:'pointer', color:'#BABABA', display:'flex', alignItems:'center', padding:2, flexShrink:0 }}
        ><IconClose /></button>
      </div>
      <p style={{ fontSize:'12px', fontWeight:700, color:'#18181B', margin:'4px 0 2px' }}>{notif.sender}</p>
      <p style={{ fontSize:'12px', color:'#52525B', fontWeight:400, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
        {notif.content}
      </p>
      {/* Progress bar */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:2, background:'rgba(0,0,0,0.06)', borderRadius:'0 0 14px 14px', overflow:'hidden' }}>
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
      <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(0,0,0,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:'13px', fontWeight:800, color:'#18181B' }}>Notifications</span>
          {unread > 0 && (
            <span style={{ background:'#F07C00', color:'#fff', fontSize:'10px', fontWeight:800, padding:'1px 6px', borderRadius:'99px' }}>{unread}</span>
          )}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {unread > 0 && (
            <button onClick={onMarkAllRead} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'11px', color:'#F07C00', fontWeight:600, fontFamily:'Manrope,sans-serif', padding:'4px 8px', borderRadius:6, transition:'background 0.1s' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(240,124,0,0.07)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
            >Mark all read</button>
          )}
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:7, border:'1px solid rgba(0,0,0,0.09)', background:'rgba(0,0,0,0.03)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#888' }}><IconClose /></button>
        </div>
      </div>

      {/* List */}
      <div style={{ maxHeight:340, overflowY:'auto' }}>
        {notifs.length === 0 ? (
          <div style={{ padding:'36px 16px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🔔</div>
            <p style={{ fontSize:'13px', color:'#A1A1AA', fontWeight:500 }}>No notifications yet</p>
            <p style={{ fontSize:'11px', color:'#C4C4C4', marginTop:4 }}>New messages will appear here</p>
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
                <div style={{ width:7, height:7, borderRadius:'50%', background: n.read ? 'transparent' : '#F07C00', marginTop:5, flexShrink:0, transition:'background 0.2s' }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                    <span style={{ color: n.read ? '#BABABA' : '#F07C00', opacity:0.85 }}>{roomIcon(n.room)}</span>
                    <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', color: n.read ? '#A1A1AA' : '#F07C00' }}>{n.roomLabel}</span>
                    <span style={{ fontSize:'10px', color:'#C4C4C4', fontWeight:400, marginLeft:'auto', whiteSpace:'nowrap' }}>{timeAgo(n.timestamp)}</span>
                  </div>
                  <p style={{ fontSize:'12px', fontWeight: n.read ? 500 : 700, color:'#27272A', marginBottom:2 }}>{n.sender}</p>
                  <p style={{ fontSize:'12px', color:'#71717A', fontWeight:400, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{n.content}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifs.length > 0 && (
        <div style={{ padding:'10px 14px', borderTop:'1px solid rgba(0,0,0,0.07)', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClear} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:'11px', color:'#BABABA', fontWeight:600, fontFamily:'Manrope,sans-serif', padding:'4px 8px', borderRadius:6, transition:'all 0.1s' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color='#DC2626'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color='#BABABA'}
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
          <span style={{ position:'absolute', top:4, right:4, width:7, height:7, borderRadius:'50%', background:'#F07C00', border:'1.5px solid rgba(255,255,255,0.9)' }} />
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
      style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(10,8,5,0.35)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', animation:'fadeIn 0.15s ease' }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}} .nbm{animation:modalIn 0.22s cubic-bezier(0.34,1.4,0.64,1);}`}</style>
      <div className="nbm" style={{ background:'rgba(255,255,255,0.97)', backdropFilter:'blur(24px)', border:'1px solid rgba(255,255,255,0.8)', borderRadius:24, width:420, boxShadow:'0 32px 80px rgba(0,0,0,0.14),0 8px 24px rgba(0,0,0,0.07)', overflow:'hidden', maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'24px 24px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <p style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'#F07C00', marginBottom:4 }}>{step==='name'?'Step 1 of 2':'Step 2 of 2'}</p>
            <h2 style={{ fontSize:'18px', fontWeight:800, color:'#18181B', letterSpacing:'-0.5px', margin:0 }}>{done?'✓ Bloc Formed':step==='name'?'New Bloc Group Chat':'Add Delegates'}</h2>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:10, border:'1px solid rgba(0,0,0,0.09)', background:'rgba(0,0,0,0.03)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#71717A' }}><IconClose /></button>
        </div>
        <div style={{ margin:'16px 24px 0', height:3, background:'rgba(0,0,0,0.06)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', width:step==='name'?'50%':'100%', background:'#F07C00', borderRadius:99, transition:'width 0.3s ease' }} />
        </div>
        <div style={{ padding:'20px 24px 24px', display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
          {done ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(34,197,94,0.10)', border:'2px solid rgba(34,197,94,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', fontSize:24 }}>✓</div>
              <p style={{ fontSize:'14px', color:'#52525B', fontWeight:500 }}><strong style={{ color:'#18181B' }}>{blocName}</strong> created with {selected.length} member{selected.length!==1?'s':''}.</p>
            </div>
          ) : step==='name' ? (
            <>
              <input ref={inputRef} value={blocName} onChange={e=>setBlocName(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&blocName.trim()) setStep('members'); }} placeholder="e.g. Progressive Bloc, G7 Bloc…" style={{ width:'100%', padding:'13px 16px', border:'1px solid rgba(0,0,0,0.12)', borderRadius:12, fontSize:14, fontWeight:500, fontFamily:'Manrope,sans-serif', outline:'none', background:'#FAFAF8', color:'#18181B', marginBottom:16, boxSizing:'border-box', transition:'border-color 0.15s,box-shadow 0.15s' }} onFocus={e=>{e.currentTarget.style.borderColor='#F07C00';e.currentTarget.style.boxShadow='0 0 0 3px rgba(240,124,0,0.10)';}} onBlur={e=>{e.currentTarget.style.borderColor='rgba(0,0,0,0.12)';e.currentTarget.style.boxShadow='none';}} />
              <button disabled={!blocName.trim()} onClick={()=>setStep('members')} style={{ width:'100%', height:44, background:blocName.trim()?'#F07C00':'rgba(0,0,0,0.06)', color:blocName.trim()?'#fff':'#A1A1AA', border:'none', borderRadius:12, fontWeight:700, fontSize:13, cursor:blocName.trim()?'pointer':'not-allowed', fontFamily:'Manrope,sans-serif', transition:'all 0.15s', boxShadow:blocName.trim()?'0 4px 12px rgba(240,124,0,0.25)':'none' }}>Continue →</button>
            </>
          ) : (
            <>
              <p style={{ fontSize:12, color:'#71717A', fontWeight:500, marginBottom:10 }}>Select delegates for <strong style={{ color:'#18181B' }}>{blocName}</strong></p>
              <div style={{ flex:1, overflowY:'auto', border:'1px solid rgba(0,0,0,0.09)', borderRadius:12, marginBottom:14, background:'#FAFAF8' }}>
                {users.length===0 && <p style={{ padding:20, textAlign:'center', color:'#A1A1AA', fontSize:13 }}>No other delegates found</p>}
                {users.map((u,i) => { const s=selected.includes(u.id); return (
                  <div key={u.id} onClick={()=>toggle(u.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', cursor:'pointer', borderBottom:i<users.length-1?'1px solid rgba(0,0,0,0.06)':'none', background:s?'rgba(240,124,0,0.05)':'transparent', transition:'background 0.1s' }}>
                    <div style={{ width:18, height:18, borderRadius:5, border:`2px solid ${s?'#F07C00':'rgba(0,0,0,0.15)'}`, background:s?'#F07C00':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.12s' }}>{s&&<span style={{ color:'#fff' }}><IconCheck /></span>}</div>
                    <span style={{ fontSize:13, fontWeight:600, color:s?'#18181B':'#52525B' }}>{u.delegation}</span>
                  </div>
                ); })}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setStep('name')} style={{ width:40, height:44, background:'rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.09)', borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#71717A', flexShrink:0 }}><IconChevron dir="left" /></button>
                <button disabled={selected.length===0||loading} onClick={handleCreate} style={{ flex:1, height:44, background:selected.length>0?'#F07C00':'rgba(0,0,0,0.06)', color:selected.length>0?'#fff':'#A1A1AA', border:'none', borderRadius:12, fontWeight:700, fontSize:13, cursor:selected.length>0?'pointer':'not-allowed', fontFamily:'Manrope,sans-serif', transition:'all 0.15s', boxShadow:selected.length>0?'0 4px 12px rgba(240,124,0,0.25)':'none' }}>
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

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('sodmun_dark');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('sodmun_dark', String(darkMode));
  }, [darkMode]);

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
        const isBloc   = msg.recipient_group?.startsWith('bloc_');

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
    <div style={{ display:'flex', height:'100vh', width:'100vw', overflow:'hidden', background:'var(--bg-base)', fontFamily:"'Manrope', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        /* ── Nav item ── */
        .nav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:11px; font-size:13px; font-weight:500; color:#6B6B6B; cursor:pointer; transition:all 0.13s ease; border:1px solid transparent; margin-bottom:1px; white-space:nowrap; position:relative; user-select:none; }
        .nav-label { flex:1; overflow:hidden; text-overflow:ellipsis; transition:opacity 0.15s; }
        .nav-item:hover { background:rgba(0,0,0,0.045); color:#1A1A1A; }
        .nav-item.nav-active { background:rgba(240,124,0,0.11); color:#E07000; border-color:rgba(240,124,0,0.20); font-weight:700; }
        .nav-item.nav-active .nav-icon-wrap { opacity:1; }
        .nav-icon-wrap { display:flex; align-items:center; justify-content:center; flex-shrink:0; opacity:0.55; transition:opacity 0.13s; }
        .nav-item:hover .nav-icon-wrap { opacity:0.85; }
        .nav-badge { background:rgba(240,124,0,0.15); color:#E07000; font-size:10px; font-weight:800; padding:1px 6px; border-radius:99px; flex-shrink:0; }
        .nav-chair { color:#E07000 !important; border-color:rgba(240,124,0,0.18) !important; background:rgba(240,124,0,0.06) !important; }
        .nav-chair.nav-active { background:rgba(240,124,0,0.14) !important; border-color:rgba(240,124,0,0.28) !important; }

        /* ── Sidebar toggle ── */
        .sidebar-toggle { width:26px; height:26px; border-radius:8px; border:1px solid rgba(0,0,0,0.09); background:rgba(255,255,255,0.70); cursor:pointer; display:flex; align-items:center; justify-content:center; color:#888; transition:all 0.13s; flex-shrink:0; }
        .sidebar-toggle:hover { background:#fff; color:#F07C00; border-color:rgba(240,124,0,0.25); }

        /* ── New Bloc btn ── */
        .new-bloc-btn { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; padding:9px 12px; border-radius:11px; border:1.5px dashed rgba(240,124,0,0.35); background:rgba(240,124,0,0.05); color:#E07000; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.15s; font-family:'Manrope',sans-serif; letter-spacing:0.2px; }
        .new-bloc-btn:hover { background:rgba(240,124,0,0.10); border-color:rgba(240,124,0,0.50); box-shadow:0 2px 8px rgba(240,124,0,0.12); }

        /* ── Bell button ── */
        .bell-btn { width:32px; height:32px; border-radius:9px; border:1px solid rgba(0,0,0,0.09); background:rgba(255,255,255,0.70); cursor:pointer; display:flex; align-items:center; justify-content:center; color:#888; transition:all 0.13s; flex-shrink:0; position:relative; }
        .bell-btn:hover { background:#fff; color:#F07C00; border-color:rgba(240,124,0,0.25); }
        .bell-btn.has-unread { background:rgba(240,124,0,0.08); border-color:rgba(240,124,0,0.25); color:#F07C00; }

        /* ── Notification panel ── */
        .notif-panel { position:fixed; bottom:80px; left:12px; width:320px; background:rgba(255,255,255,0.97); border:1px solid rgba(0,0,0,0.09); border-radius:16px; box-shadow:0 16px 48px rgba(0,0,0,0.13),0 4px 12px rgba(0,0,0,0.06); overflow:hidden; animation:panelIn 0.18s cubic-bezier(0.34,1.3,0.64,1); z-index:600; }
        @keyframes panelIn { from{opacity:0;transform:translateY(8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }

        /* ── Notif item ── */
        .notif-item { padding:12px 16px; cursor:pointer; transition:background 0.1s; border-bottom:1px solid rgba(0,0,0,0.05); }
        .notif-item:last-child { border-bottom:none; }
        .notif-item:hover { background:rgba(0,0,0,0.02); }
        .notif-item.notif-unread { background:rgba(240,124,0,0.03); }
        .notif-item.notif-unread:hover { background:rgba(240,124,0,0.06); }

        /* ── Toast ── */
        .toast-card { position:relative; background:rgba(255,255,255,0.97); border:1px solid rgba(0,0,0,0.09); border-radius:14px; padding:14px 14px 16px; width:300px; box-shadow:0 12px 40px rgba(0,0,0,0.13),0 4px 12px rgba(0,0,0,0.07); overflow:hidden; animation:toastIn 0.25s cubic-bezier(0.34,1.3,0.64,1); transition:transform 0.15s, opacity 0.15s; }
        .toast-card:hover { transform:scale(1.01); }
        @keyframes toastIn { from{opacity:0;transform:translateX(20px) scale(0.96)} to{opacity:1;transform:translateX(0) scale(1)} }
        @keyframes toastProgress { from{width:100%} to{width:0%} }
        .toast-progress { height:100%; background:rgba(240,124,0,0.35); border-radius:0 0 14px 14px; animation:toastProgress 5s linear forwards; }

        /* ── User footer ── */
        .user-footer { border-top:1px solid rgba(0,0,0,0.07); padding-top:12px; margin-top:12px; }
        .user-row { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:11px; cursor:pointer; transition:all 0.12s; border:1px solid transparent; position:relative; }
        .user-row:hover { background:rgba(0,0,0,0.04); border-color:rgba(0,0,0,0.07); }
        .user-avatar { width:30px; height:30px; background:linear-gradient(135deg,#F07C00,#FFAD47); border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; color:#fff; flex-shrink:0; letter-spacing:0.5px; }
        .user-menu { position:fixed; bottom:72px; left:12px; width:210px; background:rgba(255,255,255,0.97); border:1px solid rgba(0,0,0,0.09); border-radius:14px; box-shadow:0 16px 40px rgba(0,0,0,0.12),0 4px 12px rgba(0,0,0,0.06); overflow:hidden; animation:slideUp 0.15s cubic-bezier(0.34,1.3,0.64,1); z-index:700; }
        @keyframes slideUp { from{opacity:0;transform:translateY(6px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .user-menu-item { display:flex; align-items:center; gap:10px; padding:11px 14px; font-size:13px; font-weight:600; color:#3F3F46; cursor:pointer; transition:background 0.1s; font-family:'Manrope',sans-serif; }
        .user-menu-item:hover { background:rgba(0,0,0,0.04); }
        .user-menu-item.danger { color:#DC2626; }
        .user-menu-item.danger:hover { background:rgba(220,38,38,0.06); }
        .user-menu-divider { height:1px; background:rgba(0,0,0,0.07); margin:4px 0; }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.14); border-radius:99px; }
        ::-webkit-scrollbar-thumb:hover { background:rgba(0,0,0,0.22); }

        /* ── Dark mode via data-theme (manual toggle) overrides prefers-color-scheme ── */
        [data-theme="dark"] {
          --bg-base:        #0F0E0C;
          --bg-surface:     rgba(28,26,22,0.85);
          --bg-elevated:    rgba(36,33,28,0.95);
          --bg-input:       rgba(40,37,32,0.90);
          --bg-overlay:     rgba(15,14,12,0.96);
          --bg-sidebar:     rgba(22,20,17,0.92);
          --bg-card:        rgba(30,28,24,0.90);
          --text-primary:   #F0EDE8;
          --text-secondary: #A1A1AA;
          --text-muted:     #71717A;
          --border:         rgba(255,255,255,0.07);
          --border-strong:  rgba(255,255,255,0.12);
          --border-accent:  rgba(240,124,0,0.35);
          --shadow-sm:      0 1px 3px rgba(0,0,0,0.30),0 1px 2px rgba(0,0,0,0.20);
          --shadow-md:      0 4px 16px rgba(0,0,0,0.35),0 2px 6px rgba(0,0,0,0.20);
          --shadow-lg:      0 12px 40px rgba(0,0,0,0.40),0 4px 12px rgba(0,0,0,0.25);
          --shadow-xl:      0 24px 64px rgba(0,0,0,0.50),0 8px 24px rgba(0,0,0,0.30);
        }
        [data-theme="light"] {
          --bg-base:        #F5F3EF;
          --bg-surface:     rgba(255,255,255,0.72);
          --bg-elevated:    rgba(255,255,255,0.92);
          --bg-input:       rgba(255,255,255,0.85);
          --bg-sidebar:     rgba(255,255,255,0.78);
          --text-primary:   #18181B;
          --text-secondary: #71717A;
          --text-muted:     #A1A1AA;
          --border:         rgba(0,0,0,0.08);
          --border-strong:  rgba(0,0,0,0.14);
          --shadow-sm:      0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);
          --shadow-md:      0 4px 16px rgba(0,0,0,0.07),0 2px 6px rgba(0,0,0,0.04);
          --shadow-lg:      0 12px 40px rgba(0,0,0,0.10),0 4px 12px rgba(0,0,0,0.06);
          --shadow-xl:      0 24px 64px rgba(0,0,0,0.12),0 8px 24px rgba(0,0,0,0.07);
        }

        /* ── Dark mode sidebar / nav ── */
        .nav-item { color: var(--text-secondary); }
        .nav-item:hover { background:rgba(128,128,128,0.08); color:var(--text-primary); }
        .sidebar-toggle { background:var(--bg-elevated); border-color:var(--border); color:var(--text-muted); }
        .sidebar-toggle:hover { background:var(--bg-card); color:var(--accent); }
        .bell-btn { background:var(--bg-elevated); border-color:var(--border); color:var(--text-muted); }
        .bell-btn:hover { background:var(--bg-card); color:var(--accent); }
        .user-row:hover { background:var(--bg-surface); border-color:var(--border); }
        .user-menu { background:var(--bg-elevated); border-color:var(--border); }
        .user-menu-item { color:var(--text-primary); }
        .user-menu-item:hover { background:var(--bg-surface); }
        .user-menu-divider { background:var(--border); }
        .notif-panel { background:var(--bg-elevated); border-color:var(--border); }
        .notif-item:hover { background:var(--bg-surface); }
        .toast-card { background:var(--bg-elevated); border-color:var(--border); }

        /* ── Theme switch toggle ── */
        .theme-switch {
          font-size: 14px;
          position: relative;
          display: inline-block;
          width: 4em;
          height: 2.2em;
          border-radius: 30px;
          box-shadow: 0 0 8px rgba(0,0,0,0.18);
          flex-shrink: 0;
          cursor: pointer;
        }
        .theme-switch input { opacity:0; width:0; height:0; position:absolute; }
        .ts-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #2a2a2a;
          transition: 0.4s;
          border-radius: 30px;
          overflow: hidden;
        }
        .ts-slider:before {
          position: absolute;
          content: "";
          height: 1.2em; width: 1.2em;
          border-radius: 20px;
          left: 0.5em; bottom: 0.5em;
          transition: 0.4s;
          transition-timing-function: cubic-bezier(0.81,-0.04,0.38,1.5);
          box-shadow: inset 8px -4px 0px 0px #fff;
        }
        .theme-switch input:checked + .ts-slider { background-color: #00a6ff; }
        .theme-switch input:checked + .ts-slider:before {
          transform: translateX(1.8em);
          box-shadow: inset 15px -4px 0px 15px #ffcf48;
        }
        .ts-star {
          background-color: #fff;
          border-radius: 50%;
          position: absolute;
          width: 5px; height: 5px;
          transition: all 0.4s;
        }
        .ts-star1 { left: 2.5em; top: 0.5em; }
        .ts-star2 { left: 2.2em; top: 1.2em; }
        .ts-star3 { left: 3em;   top: 0.9em; }
        .theme-switch input:checked ~ .ts-slider .ts-star { opacity: 0; }
        .ts-cloud {
          width: 3.5em;
          position: absolute;
          bottom: -1.4em; left: -1.1em;
          opacity: 0;
          transition: all 0.4s;
        }
        .theme-switch input:checked ~ .ts-slider .ts-cloud { opacity: 1; }

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
          font-weight:700; text-transform:uppercase;
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
          font-size:9px; font-weight:800;
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
            {!collapsed && <img src={logo} alt="SODMUN" style={{ height:36, objectFit:'contain', flexShrink:0 }} />}
            <button className="sidebar-toggle" onClick={()=>setCollapsed(c=>!c)} title={collapsed?'Expand':'Collapse'}>
              <IconChevron dir={collapsed?'right':'left'} />
            </button>
          </div>

          {/* Section label */}
          {!collapsed && <p style={{ fontSize:'9.5px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2.2px', color:'#BABABA', paddingLeft:12, marginBottom:6 }}>Platform</p>}
          {collapsed  && <div style={{ height:1, background:'rgba(0,0,0,0.07)', margin:'0 4px 10px' }} />}

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
              {!collapsed && <div style={{ height:1, background:'rgba(0,0,0,0.07)', marginBottom:12 }} />}
              <button className="new-bloc-btn" onClick={()=>setShowBloc(true)} title="Form a new alliance" style={{ padding:collapsed?'9px 0':undefined, gap:collapsed?0:7 }}>
                <IconPlus />
                {!collapsed && 'New Bloc Group Chat'}
              </button>
            </div>
          )}

          {/* ── Chair section ── */}
          {isChair && (
            <div style={{ marginTop:16 }}>
              {!collapsed && <p style={{ fontSize:'9.5px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2.2px', color:'rgba(240,124,0,0.55)', paddingLeft:12, marginBottom:6 }}>Chair</p>}
              {collapsed  && <div style={{ height:1, background:'rgba(240,124,0,0.18)', margin:'4px 4px 8px' }} />}
              <NavItem to="/timer"       icon={<IconTimer />}     label="Speakers Timer"  collapsed={collapsed} isChair />
              <NavItem to="/committee"   icon={<IconCommittee />} label="Committee Mgr"  collapsed={collapsed} isChair />
            </div>
          )}

          <div style={{ flex:1 }} />

          {/* ── Theme Switch — above notifications ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between', padding:'6px 4px 10px', gap:8 }}>
            {!collapsed && (
              <span style={{ fontSize:'9.5px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'var(--text-muted)', paddingLeft:8 }}>Appearance</span>
            )}
            <label className="theme-switch" title={darkMode ? 'Light mode' : 'Dark mode'}>
              <input
                type="checkbox"
                checked={!darkMode}
                onChange={() => setDarkMode((d:boolean) => !d)}
              />
              <span className="ts-slider">
                <div className="ts-star ts-star1" />
                <div className="ts-star ts-star2" />
                <div className="ts-star ts-star3" />
                <svg viewBox="0 0 16 16" className="ts-cloud">
                  <path transform="matrix(.77976 0 0 .78395-299.99-418.63)" fill="#fff" d="m391.84 540.91c-.421-.329-.949-.524-1.523-.524-1.351 0-2.451 1.084-2.485 2.435-1.395.526-2.388 1.88-2.388 3.466 0 1.874 1.385 3.423 3.182 3.667v.034h12.73v-.006c1.775-.104 3.182-1.584 3.182-3.395 0-1.747-1.309-3.186-2.994-3.379.007-.106.011-.214.011-.322 0-2.707-2.271-4.901-5.072-4.901-2.073 0-3.856 1.202-4.643 2.925" />
                </svg>
              </span>
            </label>
          </div>

          {/* ── Notifications + User footer ── */}
          <div ref={notifPanelRef} style={{ position:'relative', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:collapsed?'center':'space-between', padding:'6px 4px', marginBottom:2 }}>
              {!collapsed && (
                <span style={{ fontSize:'9.5px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'var(--text-muted)', paddingLeft:8 }}>Notifications</span>
              )}
              <button
                className={`bell-btn ${unreadCount>0?'has-unread':''}`}
                onClick={()=>setShowNP(v=>!v)}
                title="Notifications"
              >
                <IconBell dot={unreadCount > 0} />
                {collapsed && unreadCount > 0 && (
                  <span style={{ position:'absolute', top:3, right:3, minWidth:14, height:14, borderRadius:99, background:'#F07C00', color:'#fff', fontSize:8, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', border:'1.5px solid rgba(255,255,255,0.9)' }}>
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
                  <p style={{ fontSize:'12px', fontWeight:700, color:'var(--text-primary)', marginBottom:2 }}>{profile?.delegation||profile?.role}</p>
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
                    <p style={{ fontSize:'12px', fontWeight:700, color:'#27272A', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.delegation||profile?.role}</p>
                    <p style={{ fontSize:'10px', color:'#A1A1AA', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.committee}</p>
                  </div>
                  <div style={{ color:'#BABABA', display:'flex', alignItems:'center', flexShrink:0 }}>
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
              <img src={logo} alt="SODMUN" style={{ height:32, objectFit:'contain' }} />
              <button className="sidebar-toggle" onClick={()=>setMobileOpen(false)}><IconClose /></button>
            </div>
            <p style={{ fontSize:'9.5px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2.2px', color:'var(--text-muted)', paddingLeft:12, marginBottom:6 }}>Platform</p>
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
                <p style={{ fontSize:'9.5px', fontWeight:700, textTransform:'uppercase', letterSpacing:'2.2px', color:'rgba(240,124,0,0.55)', paddingLeft:12, marginBottom:6 }}>Chair</p>
                <NavItem to="/timer"     icon={<IconTimer />}     label="Speakers Timer" collapsed={false} isChair />
              <NavItem to="/committee" icon={<IconCommittee />} label="Committee Mgr" collapsed={false} isChair />
              </div>
            )}
            <div style={{ flex:1 }} />
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:11 }}>
                <div className="user-avatar">{(profile?.delegation||profile?.role||'?').slice(0,2).toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'12px', fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{profile?.delegation||profile?.role}</p>
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