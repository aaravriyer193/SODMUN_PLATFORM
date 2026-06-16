// CommitteeManager.tsx — /committee (Chair only)
// Manage delegates across blocs: add, remove, view unassigned

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getCommitteeMembers, addToBlocApi, removeFromBlocApi, bustSidebarCache, lockRoom } from './committeeApi';
import { supabase } from './api';

const IconPause  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/></svg>;
const IconPlay   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>;
const IconGlobe  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconLockSm = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconChat2  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IconPlus   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconMinus  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconUsers  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconRefresh= () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.08"/></svg>;

interface Delegate { id: string; delegation: string; role: string; email: string; }
interface Bloc     { id: number; name: string; }
interface Member   { user_id: string; bloc_id: number; }

export default function CommitteeManager() {
  const { user: authUser } = useAuth();
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [blocs,     setBlocs]     = useState<Bloc[]>([]);
  const [members,   setMembers]   = useState<Member[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState<string | null>(null);
  const [search,    setSearch]    = useState('');
  const [filterBloc, setFilterBloc] = useState<string>('all');
  const [lockedRooms, setLockedRooms] = useState<Set<string>>(new Set());
  const [lockBusy,  setLockBusy]   = useState<string | null>(null);
  const [allBusy,   setAllBusy]    = useState(false);
  const [committee, setCommittee]  = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memberResult, { data: lockData }, { data: userData }] = await Promise.all([
        getCommitteeMembers(),
        supabase.from('room_locks').select('recipient_group'),
        supabase.auth.getUser(),
      ]);
      setDelegates(memberResult.users  || []);
      setBlocs(memberResult.blocs      || []);
      setMembers(memberResult.members  || []);
      setLockedRooms(new Set((lockData || []).map((l: any) => l.recipient_group)));
      // Get committee from first delegate or blocs
      const comm = memberResult.blocs?.[0]?.committee || memberResult.users?.[0]?.committee || '';
      setCommittee(comm);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getBlocsForDelegate = (uid: string) =>
    members.filter(m => m.user_id === uid).map(m => blocs.find(b => b.id === m.bloc_id)).filter(Boolean) as Bloc[];

  const getMembersOfBloc = (bid: number) =>
    members.filter(m => m.bloc_id === bid).map(m => delegates.find(d => d.id === m.user_id)).filter(Boolean) as Delegate[];

  const unassigned = delegates.filter(d => !members.some(m => m.user_id === d.id));

  const handleAdd = async (uid: string, bid: number) => {
    const key = `add-${uid}-${bid}`;
    setBusy(key);
    try {
      await addToBlocApi(uid, bid);
      setMembers(prev => [...prev, { user_id: uid, bloc_id: bid }]);
      bustSidebarCache();
    } catch (e) { console.error(e); }
    setBusy(null);
  };

  const handleRemove = async (uid: string, bid: number) => {
    const key = `rem-${uid}-${bid}`;
    setBusy(key);
    try {
      await removeFromBlocApi(uid, bid);
      setMembers(prev => prev.filter(m => !(m.user_id === uid && m.bloc_id === bid)));
      bustSidebarCache();
    } catch (e) { console.error(e); }
    setBusy(null);
  };

  const handleToggleLock = async (roomId: string) => {
    setLockBusy(roomId);
    const isLocked = lockedRooms.has(roomId);
    try {
      await lockRoom(roomId, !isLocked);
      setLockedRooms(prev => {
        const next = new Set(prev);
        if (isLocked) next.delete(roomId); else next.add(roomId);
        return next;
      });
    } catch (e) { console.error(e); }
    setLockBusy(null);
  };

  const handleToggleAll = async () => {
    if (rooms.length === 0) return;
    const allLocked = rooms.every(r => lockedRooms.has(r.id));
    const targetLocked = !allLocked; // if all locked → resume all; otherwise → pause all
    setAllBusy(true);
    try {
      await Promise.all(rooms.map(r => lockRoom(r.id, targetLocked)));
      setLockedRooms(() => {
        if (targetLocked) return new Set(rooms.map(r => r.id));
        return new Set();
      });
    } catch (e) { console.error(e); }
    setAllBusy(false);
  };

  // Build room list: global committee + one per bloc
  const rooms = [
    { id: committee, name: 'Global Committee', type: 'global' as const },
    ...blocs.map(b => ({ id: `bloc_${b.id}`, name: b.name, type: 'bloc' as const })),
  ].filter(r => r.id);

  const filteredDelegates = delegates.filter(d => {
    const matchSearch = !search || d.delegation.toLowerCase().includes(search.toLowerCase());
    const matchBloc = filterBloc === 'all'
      ? true
      : filterBloc === 'unassigned'
        ? !members.some(m => m.user_id === d.id)
        : members.some(m => m.user_id === d.id && m.bloc_id === parseInt(filterBloc));
    return matchSearch && matchBloc;
  });

  return (
    <div className="container">
      <style>{`
        .cm-bloc-card { background:var(--bg-elevated); border:1px solid var(--border); border-radius:16px; padding:20px; margin-bottom:16px; }
        .cm-del-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
        .cm-del-row:last-child { border-bottom:none; }
        .cm-tag { font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; }
        .cm-btn { border:none; cursor:pointer; border-radius:8px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; transition:all 0.12s; }
        .cm-btn-add { background:rgba(34,197,94,0.12); color:#16A34A; }
        .cm-btn-add:hover { background:rgba(34,197,94,0.22); }
        .cm-btn-rem { background:rgba(220,38,38,0.10); color:#DC2626; }
        .cm-btn-rem:hover { background:rgba(220,38,38,0.20); }
        .cm-section { margin-bottom:32px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div className="top-bar">
        <div>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'var(--accent)', marginBottom:6 }}>Chair · Committee</p>
          <h1 className="delegation-brand">Committee Manager</h1>
        </div>
        <button
          className="primary-btn"
          onClick={load}
          style={{ display:'flex', alignItems:'center', gap:8 }}
        >
          <IconRefresh /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:12, marginBottom:28, flexWrap:'wrap' }}>
        <input
          placeholder="Search delegation…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:240, margin:0 }}
          className="dark-input"
        />
        <select
          className="dark-input"
          value={filterBloc}
          onChange={e => setFilterBloc(e.target.value)}
          style={{ width:200, margin:0 }}
        >
          <option value="all">All Delegates</option>
          <option value="unassigned">Unassigned</option>
          {blocs.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color:'var(--text-muted)', fontSize:14 }}>Loading committee data…</p>
      ) : (
        <div className="main-grid" style={{ gridTemplateColumns:'1.2fr 1fr', gap:24 }}>

          {/* Left: Delegates table */}
          <div>
            <div className="panel">
              <span className="label"><IconUsers /> All Delegates ({filteredDelegates.length})</span>
              {filteredDelegates.length === 0 && (
                <p style={{ color:'var(--text-muted)', fontSize:13 }}>No delegates match.</p>
              )}
              {filteredDelegates.map(d => {
                const dBlocs = getBlocsForDelegate(d.id);
                return (
                  <div key={d.id} className="cm-del-row">
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.delegation}</p>
                      <p style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>{d.email}</p>
                    </div>
                    {/* Bloc tags */}
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:160 }}>
                      {dBlocs.length === 0
                        ? <span className="cm-tag" style={{ background:'rgba(0,0,0,0.06)', color:'var(--text-muted)' }}>Unassigned</span>
                        : dBlocs.map(b => (
                          <div key={b.id} style={{ display:'flex', alignItems:'center', gap:3, background:'var(--accent-soft)', border:'1px solid var(--accent-mid)', borderRadius:99, padding:'2px 8px 2px 6px' }}>
                            <span style={{ fontSize:10, fontWeight:700, color:'var(--accent)' }}>{b.name}</span>
                            <button
                              className="cm-btn cm-btn-rem"
                              style={{ width:18, height:18, borderRadius:4 }}
                              disabled={busy === `rem-${d.id}-${b.id}`}
                              onClick={() => handleRemove(d.id, b.id)}
                              title={`Remove from ${b.name}`}
                            ><IconMinus /></button>
                          </div>
                        ))
                      }
                    </div>
                    {/* Add to bloc dropdown */}
                    <select
                      className="dark-input"
                      style={{ width:130, margin:0, fontSize:11, padding:'6px 10px', minHeight:32 }}
                      value=""
                      onChange={e => { if (e.target.value) handleAdd(d.id, parseInt(e.target.value)); }}
                    >
                      <option value="">Add to…</option>
                      {blocs
                        .filter(b => !members.some(m => m.user_id === d.id && m.bloc_id === b.id))
                        .map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                      }
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Bloc breakdown */}
          <div>
            {/* Unassigned */}
            {unassigned.length > 0 && (
              <div className="cm-bloc-card" style={{ borderColor:'rgba(220,38,38,0.20)', background:'rgba(220,38,38,0.04)' }}>
                <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'#DC2626', marginBottom:12 }}>
                  Unassigned ({unassigned.length})
                </p>
                {unassigned.map(d => (
                  <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid rgba(220,38,38,0.10)' }}>
                    <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{d.delegation}</span>
                    <select
                      className="dark-input"
                      style={{ width:130, margin:0, fontSize:11, padding:'5px 10px', minHeight:30 }}
                      value=""
                      onChange={e => { if (e.target.value) handleAdd(d.id, parseInt(e.target.value)); }}
                    >
                      <option value="">Add to bloc…</option>
                      {blocs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* Per-bloc cards */}
            {blocs.map(b => {
              const bMembers = getMembersOfBloc(b.id);
              return (
                <div key={b.id} className="cm-bloc-card">
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'var(--accent)' }}>
                      {b.name}
                    </p>
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>
                      {bMembers.length} delegate{bMembers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {bMembers.length === 0
                    ? <p style={{ fontSize:12, color:'var(--text-muted)' }}>No delegates yet</p>
                    : bMembers.map(d => (
                      <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                        <span style={{ flex:1, fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{d.delegation}</span>
                        <button
                          className="cm-btn cm-btn-rem"
                          disabled={busy === `rem-${d.id}-${b.id}`}
                          onClick={() => handleRemove(d.id, b.id)}
                          title="Remove from bloc"
                        ><IconMinus /></button>
                      </div>
                    ))
                  }
                </div>
              );
            })}
            </div>

          {/* ── Channel controls ── */}
          <div className="cm-bloc-card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'var(--text-secondary)' }}>
                  Chat Channels
                </p>
                <p style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500, marginTop:2 }}>Pause to disable delegate messaging</p>
              </div>
              <button
                onClick={handleToggleAll}
                disabled={allBusy || rooms.length === 0}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  fontSize:11, fontWeight:700, padding:'7px 14px', borderRadius:9,
                  border:'1px solid', cursor: allBusy ? 'not-allowed' : 'pointer',
                  fontFamily:'Manrope,sans-serif', transition:'all 0.15s',
                  background: allBusy ? 'var(--bg-surface)'
                    : rooms.every(r => lockedRooms.has(r.id)) ? 'rgba(34,197,94,0.10)'
                    : 'rgba(220,38,38,0.08)',
                  color: allBusy ? 'var(--text-muted)'
                    : rooms.every(r => lockedRooms.has(r.id)) ? '#16A34A'
                    : '#DC2626',
                  borderColor: allBusy ? 'var(--border)'
                    : rooms.every(r => lockedRooms.has(r.id)) ? 'rgba(34,197,94,0.25)'
                    : 'rgba(220,38,38,0.22)',
                  opacity: allBusy ? 0.7 : 1,
                }}
              >
                {allBusy ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                    {rooms.every(r => lockedRooms.has(r.id)) ? 'Resuming all…' : 'Pausing all…'}
                  </>
                ) : rooms.every(r => lockedRooms.has(r.id)) ? (
                  <><IconPlay /> Resume All</>
                ) : (
                  <><IconPause /> Pause All</>
                )}
              </button>
            </div>
            {rooms.length === 0 && <p style={{ fontSize:12, color:'var(--text-muted)' }}>Loading channels…</p>}
            {rooms.map(room => {
              const isLocked = lockedRooms.has(room.id);
              const isBusy   = lockBusy === room.id;
              return (
                <div key={room.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                  <span style={{ color: isLocked ? '#DC2626' : 'var(--accent)', flexShrink:0 }}>
                    {room.type === 'global' ? <IconGlobe /> : <IconLockSm />}
                  </span>
                  <span style={{ flex:1, fontSize:13, fontWeight:600, color: isLocked ? '#DC2626' : 'var(--text-primary)' }}>
                    {room.name}
                  </span>
                  {isLocked && (
                    <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', color:'#DC2626', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.20)', borderRadius:99, padding:'2px 8px' }}>
                      Paused
                    </span>
                  )}
                  <button
                    onClick={() => handleToggleLock(room.id)}
                    disabled={isBusy}
                    style={{
                      display:'flex', alignItems:'center', gap:5,
                      fontSize:11, fontWeight:700, padding:'6px 12px', borderRadius:8,
                      border:'1px solid', cursor: isBusy ? 'not-allowed' : 'pointer',
                      fontFamily:'Manrope,sans-serif', transition:'all 0.15s',
                      background: isBusy ? 'var(--bg-surface)' : isLocked ? 'rgba(34,197,94,0.10)' : 'rgba(220,38,38,0.08)',
                      color: isBusy ? 'var(--text-muted)' : isLocked ? '#16A34A' : '#DC2626',
                      borderColor: isBusy ? 'var(--border)' : isLocked ? 'rgba(34,197,94,0.25)' : 'rgba(220,38,38,0.22)',
                      opacity: isBusy ? 0.7 : 1,
                      minWidth: 90,
                      justifyContent: 'center',
                    }}
                  >
                    {isBusy ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
                        {isLocked ? 'Resuming…' : 'Pausing…'}
                      </>
                    ) : isLocked ? (
                      <><IconPlay /> Resume</>
                    ) : (
                      <><IconPause /> Pause</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}