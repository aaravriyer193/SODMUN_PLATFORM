import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import {
  getResolutions,
  submitResolution, lockResolution, unlockResolution, reopenResolution,
  saveResolutionVersion, getResolutionVersions, restoreResolutionVersion,
  submitAmendment, getAmendments, reviewAmendment,
} from './committeeApi';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconBold      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>;
const IconItalic    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>;
const IconUnderline = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>;
const IconHighlight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>;
const IconFile      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IconBack      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;
const IconLock      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconUnlock    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;
const IconHistory   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>;
const IconCheck     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IconX         = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconAmend     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IconCursor    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M4 0l16 12.3-6.6.9L9.8 20z"/></svg>;

// ── Time ago helper ───────────────────────────────────────────────────────────
function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Delegate color palette for cursors ───────────────────────────────────────
const CURSOR_COLORS = ['#F07C00','#6366F1','#22C55E','#EC4899','#14B8A6','#F59E0B','#8B5CF6','#EF4444'];
function userColor(uid: string) {
  let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length];
}

// ── Floating format toolbar ───────────────────────────────────────────────────
const FloatingToolbar = ({ position, onAction }: any) => {
  if (!position) return null;
  return (
    <div onMouseDown={e => e.preventDefault()} style={{ position:'fixed', top:position.top, left:position.left, transform:'translateY(-110%)', display:'flex', gap:2, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, padding:6, zIndex:1000, boxShadow:'var(--shadow-lg)' }}>
      {[{icon:<IconBold/>,a:'bold'},{icon:<IconItalic/>,a:'italic'},{icon:<IconUnderline/>,a:'underline'},{icon:<IconHighlight/>,a:'hilite'}].map(({icon,a}) => (
        <button key={a} onClick={() => onAction(a)} style={{ background:'transparent', border:'1px solid transparent', color:'var(--text-secondary)', width:30, height:30, borderRadius:7, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.1s' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--accent-soft)';(e.currentTarget as HTMLElement).style.color='var(--accent)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--text-secondary)';}}
        >{icon}</button>
      ))}
    </div>
  );
};

// ── Editable block ────────────────────────────────────────────────────────────
const EditableBlock = ({ block, index, commitBlocks, blocks, handleKeyDown, getPrefix, canEdit, presences }: any) => {
  const editorRef  = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<any>(null);

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      if (editorRef.current.innerHTML !== block.html) editorRef.current.innerHTML = block.html || '';
    }
  }, [block.html]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const updated = blocks.map((b: any) => b.id === block.id
      ? { ...b, html: e.currentTarget.innerHTML, text: e.currentTarget.textContent || '' }
      : b
    );
    commitBlocks(updated);
  };

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setToolbarPos({ top: rect.top, left: rect.left + rect.width / 2 - 66 });
    } else setToolbarPos(null);
  };

  const applyFormat = (cmd: string) => {
    document.execCommand(cmd, false);
    if (editorRef.current)
      commitBlocks(blocks.map((b: any) => b.id === block.id ? { ...b, html: editorRef.current!.innerHTML, text: editorRef.current!.textContent || '' } : b));
    setToolbarPos(null);
  };

  const handleFormatAction = (action: string) => {
    if (action === 'hilite') {
      const isH = document.queryCommandValue('backColor') === 'rgba(240, 124, 0, 0.2)';
      document.execCommand('backColor', false, isH ? 'transparent' : 'rgba(240, 124, 0, 0.2)');
    } else applyFormat(action);
  };

  const handleLocalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); handleFormatAction('hilite'); }
    handleKeyDown(e, index, block.id, editorRef.current);
  };

  const marginLeft = block.type === 'point' ? `${block.indent * 32}px` : '0px';
  const fontSize   = block.type === 'heading' ? '22px' : '15px';
  const fontWeight = block.type === 'heading' ? '800' : '400';
  const fontColor  = block.type === 'heading' ? 'var(--accent)' : 'var(--text-primary)';

  // Presence cursors in this block
  const blockPresences = (presences || []).filter((p: any) => p.blockId === block.id);

  return (
    <div style={{ display:'flex', alignItems:'flex-start', marginLeft, marginBottom:4, position:'relative', cursor:'text', width:'100%', boxSizing:'border-box' }}
      onClick={() => editorRef.current?.focus()}
    >
      <FloatingToolbar position={toolbarPos} onAction={handleFormatAction} />

      {block.type === 'point' && (
        <div style={{ width:36, paddingTop:3, color:'var(--accent)', fontWeight:800, fontSize:14, flexShrink:0, textAlign:'right', paddingRight:12, userSelect:'none', fontFamily:'Manrope,sans-serif' }}>
          {getPrefix(index)}
        </div>
      )}
      {block.type === 'heading' && (
        <div style={{ width:20, paddingTop:6, marginRight:8, flexShrink:0 }}>
          <div style={{ width:4, height:20, background:'var(--accent)', borderRadius:2, opacity:0.6 }} />
        </div>
      )}

      <div ref={editorRef} contentEditable={canEdit} suppressContentEditableWarning
        style={{ flex:1, minHeight:'1.6em', padding:'3px 0', fontFamily:'Manrope,sans-serif', fontSize, fontWeight, color:fontColor, lineHeight:block.type==='heading'?1.3:1.7, outline:'none', wordBreak:'break-word', overflowWrap:'break-word', whiteSpace:'pre-wrap', marginBottom:block.type==='heading'?'16px':'0px', letterSpacing:block.type==='heading'?'-0.5px':'0px', textTransform:block.type==='heading'?'uppercase':'none', maxWidth:'100%', boxSizing:'border-box', cursor:canEdit?'text':'default' }}
        spellCheck={false}
        data-placeholder={block.type==='heading'?'Resolution heading…':block.type==='point'?'Clause…':'Write here…'}
        onInput={handleInput} onMouseUp={handleMouseUp} onKeyDown={handleLocalKeyDown}
      />

      {/* Presence cursors */}
      {blockPresences.map((p: any) => (
        <div key={p.userId} title={p.delegation} style={{ position:'absolute', right:0, top:0, display:'flex', alignItems:'center', gap:4, pointerEvents:'none', zIndex:10 }}>
          <div style={{ color:userColor(p.userId), fontSize:10 }}><IconCursor /></div>
          <span style={{ fontSize:10, fontWeight:700, color:userColor(p.userId), background:'var(--bg-elevated)', border:`1px solid ${userColor(p.userId)}`, borderRadius:4, padding:'1px 5px', whiteSpace:'nowrap' }}>
            {p.delegation}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Amendment overlay types ───────────────────────────────────────────────────
type AmendType = 'add' | 'modify' | 'strike';
type AmendMode = null | AmendType;

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Resolutions() {
  const { user: authUser } = useAuth();
  const [profile, setProfile]           = useState<any>(null);
  const [resolutions, setResolutions]   = useState<any[]>([]);
  const [activeRes, setActiveRes]       = useState<any>(null);
  const [blocks, setBlocks]             = useState<any[]>([]);
  const [syncStatus, setSyncStatus]     = useState<'saved'|'saving'>('saved');
  const [isResModal, setIsResModal]     = useState(false);
  const [myBlocs, setMyBlocs]           = useState<any[]>([]);
  const [newResTitle, setNewResTitle]   = useState('');
  const [selectedBlocId, setSelectedBlocId] = useState('');
  const [presentationMode, setPresentationMode] = useState(false);
  const [blocFilter, setBlocFilter]     = useState('all');

  // Version history
  const [showHistory, setShowHistory]   = useState(false);
  const [versions, setVersions]         = useState<any[]>([]);
  const [loadingVersions, setLV]        = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any>(null);

  // Amendments
  const [showAmendments, setShowAmendments] = useState(false);
  const [amendments, setAmendments]     = useState<any[]>([]);
  const [amendMode, setAmendMode]       = useState<AmendMode>(null);
  const [amendDraft, setAmendDraft]     = useState({ blockId:'', charStart:0, charEnd:0, originalText:'', proposedText:'' });
  const [amendInput, setAmendInput]     = useState('');

  // Presence (cursors)
  const [presences, setPresences]       = useState<any[]>([]);
  const presenceChannelRef              = useRef<any>(null);

  const pendingBlocks  = useRef(blocks);
  const activeResRef   = useRef(activeRes);
  const lastSaveTime   = useRef(Date.now());
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionAutoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isChair = profile?.role !== 'Delegate' && profile?.role !== null;

  useEffect(() => { pendingBlocks.current = blocks; }, [blocks]);
  useEffect(() => { activeResRef.current = activeRes; }, [activeRes]);
  useEffect(() => { if (authUser) fetchCoreData(); }, [authUser]);

  // ── Unload save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onUnload = () => {
      if (activeResRef.current && pendingBlocks.current.length > 0)
        supabase.from('resolutions').update({ content: JSON.stringify(pendingBlocks.current) }).eq('id', activeResRef.current.id);
    };
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('beforeunload', onUnload); onUnload(); };
  }, []);

  // ── Realtime: new resolutions appear in list for all bloc members ────────────
  useEffect(() => {
    if (!profile) return;
    const channel = supabase.channel('resolutions_list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'resolutions' }, async (payload) => {
        // Only add if it belongs to our committee / our blocs
        const newRes = payload.new;
        const isOurs = newRes.committee === profile.committee || myBlocs.some((b: any) => b.id === newRes.bloc_id);
        if (!isOurs) return;
        // Fetch with blocs join
        const { data } = await supabase.from('resolutions').select('*, blocs(name)').eq('id', newRes.id).single();
        if (data) setResolutions(prev => [data, ...prev.filter(r => r.id !== data.id)]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'resolutions' }, (payload) => {
        setResolutions(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, myBlocs]);

  // ── Realtime resolution updates ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeRes) return;
    const channel = supabase.channel(`res_${activeRes.id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'resolutions', filter:`id=eq.${activeRes.id}` }, (payload) => {
        try {
          if (payload.new.title !== activeRes.title) {
            setActiveRes((p: any) => ({ ...p, title: payload.new.title, status: payload.new.status }));
            setResolutions(prev => prev.map(r => r.id === activeRes.id ? { ...r, title: payload.new.title, status: payload.new.status } : r));
          } else {
            setActiveRes((p: any) => ({ ...p, status: payload.new.status }));
          }
          const inc = typeof payload.new.content === 'string' ? JSON.parse(payload.new.content) : payload.new.content;
          if (Array.isArray(inc) && JSON.stringify(inc) !== JSON.stringify(blocks)) setBlocks(inc);
        } catch {}
      })
      // Realtime for new amendments
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'resolution_amendments', filter:`resolution_id=eq.${activeRes.id}` }, () => {
        loadAmendments(activeRes.id);
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'resolution_amendments', filter:`resolution_id=eq.${activeRes.id}` }, () => {
        loadAmendments(activeRes.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRes?.id]);

  // ── Presence (cursors) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRes || !authUser || !profile) return;
    const ch = supabase.channel(`presence_res_${activeRes.id}`, { config: { presence: { key: authUser.id } } });
    presenceChannelRef.current = ch;
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const all = Object.values(state).flat().filter((p: any) => p.userId !== authUser.id);
      setPresences(all as any[]);
    })
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ userId: authUser.id, delegation: profile.delegation || profile.role, blockId: null });
      }
    });
    return () => { supabase.removeChannel(ch); presenceChannelRef.current = null; };
  }, [activeRes?.id, authUser?.id, profile]);

  const trackCursorBlock = (blockId: string) => {
    presenceChannelRef.current?.track({ userId: authUser?.id, delegation: profile?.delegation || profile?.role, blockId });
  };

  // ── Fetch core data ───────────────────────────────────────────────────────────
  const fetchCoreData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (!userData) return;
    setProfile(userData);

    // All blocs in committee (for the "Create resolution" dropdown)
    const { data: allBlocs } = await supabase.from('blocs').select('*').eq('committee', userData.committee);

    if (userData.role !== 'Delegate') {
      // ── Chair: service role via Edge Function, sees everything ───────────
      setMyBlocs(allBlocs || []);
      try {
        const result = await getResolutions(); // no bloc_ids = chair mode
        setResolutions(result.resolutions || []);
      } catch (e) {
        console.error('Chair resolution fetch failed:', e);
      }
    } else {
      // ── Delegate: get their bloc IDs first, then fetch via Edge Function ──
      const { data: memberOf } = await supabase
        .from('bloc_members')
        .select('bloc_id')
        .eq('user_id', authUser?.id);
      const myIds = (memberOf || []).map((b: any) => b.bloc_id);
      setMyBlocs(allBlocs?.filter((b: any) => myIds.includes(b.id)) || []);

      if (myIds.length > 0) {
        try {
          const result = await getResolutions(myIds); // delegate mode — pass bloc IDs
          setResolutions(result.resolutions || []);
        } catch (e) {
          console.error('Delegate resolution fetch failed:', e);
        }
      } else {
        setResolutions([]);
      }
    }
  };

  // ── Open / create resolution ──────────────────────────────────────────────────
  const openResolution = (res: any) => {
    setActiveRes(res);
    setSyncStatus('saved');
    setShowHistory(false);
    setShowAmendments(false);
    setAmendMode(null);
    try {
      const parsed = typeof res.content === 'string' ? JSON.parse(res.content) : res.content;
      setBlocks(Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: Date.now().toString(), type:'heading', html:'', text:'', indent:0 }]);
    } catch {
      setBlocks([{ id: Date.now().toString(), type:'heading', html:'', text:'', indent:0 }]);
    }
    loadAmendments(res.id);
  };

  const handleCreateResolution = async () => {
    if (!newResTitle.trim() || !selectedBlocId) return;
    const init = JSON.stringify([{ id: Date.now().toString(), type:'heading', html:'', text:'', indent:0 }]);
    const { data: res } = await supabase.from('resolutions')
      .insert([{ title: newResTitle, bloc_id: parseInt(selectedBlocId), committee: profile?.committee, content: init }])
      .select().single();
    if (res) { setResolutions([res, ...resolutions]); openResolution(res); setIsResModal(false); setNewResTitle(''); }
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const executeDbSave = async (data: any[]) => {
    lastSaveTime.current = Date.now();
    if (activeResRef.current) {
      await supabase.from('resolutions').update({ content: JSON.stringify(data) }).eq('id', activeResRef.current.id);
      setSyncStatus('saved');
    }
  };

  const commitBlocks = (updated: any[]) => {
    setBlocks(updated);
    setSyncStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const since = Date.now() - lastSaveTime.current;
    if (since > 1500) executeDbSave(updated);
    else saveTimeoutRef.current = setTimeout(() => executeDbSave(updated), 400);

    // Auto-version every 5 minutes if changes exist
    if (versionAutoRef.current) clearTimeout(versionAutoRef.current);
    versionAutoRef.current = setTimeout(() => {
      if (activeResRef.current && pendingBlocks.current.length > 0) {
        saveResolutionVersion(activeResRef.current.id, JSON.stringify(pendingBlocks.current), 'Auto').catch(() => {});
      }
    }, 5 * 60 * 1000);
  };

  const handleTitleChange = (t: string) => {
    setActiveRes({ ...activeRes, title: t });
    setSyncStatus('saving');
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      await supabase.from('resolutions').update({ title: t }).eq('id', activeRes.id);
      setSyncStatus('saved');
    }, 600);
  };

  // ── Keyboard handler ──────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, id: string, el: HTMLDivElement | null) => {
    const block = blocks[index];
    trackCursorBlock(block.id);
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const u = [...blocks];
      if (u[index].type === 'paragraph') { u[index].type = 'point'; u[index].indent = 0; }
      else if (u[index].type === 'point' && u[index].indent < 2) u[index].indent += 1;
      commitBlocks(u);
    } else if (e.key === 'Tab' && e.shiftKey && block.type === 'point') {
      e.preventDefault();
      const u = [...blocks];
      if (u[index].indent > 0) u[index].indent -= 1; else u[index].type = 'paragraph';
      commitBlocks(u);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (block.type === 'point' && (el?.textContent === '' || el?.innerHTML === '<br>')) {
        const u = [...blocks];
        if (block.indent > 0) u[index].indent -= 1; else u[index].type = 'paragraph';
        commitBlocks(u); return;
      }
      const nb = { id: Date.now().toString(), type: block.type === 'point' ? 'point' : 'paragraph', html:'', text:'', indent: block.type === 'point' ? block.indent : 0 };
      const u = [...blocks]; u.splice(index + 1, 0, nb); commitBlocks(u);
      setTimeout(() => { const nodes = document.querySelectorAll('[contenteditable]'); if (nodes[index+1]) (nodes[index+1] as HTMLElement).focus(); }, 10);
    } else if (e.key === 'Backspace' && (el?.textContent === '' || el?.innerHTML === '<br>')) {
      e.preventDefault();
      if (block.type === 'point' && block.indent > 0) { const u=[...blocks]; u[index].indent-=1; commitBlocks(u); }
      else if (block.type === 'point') { const u=[...blocks]; u[index].type='paragraph'; commitBlocks(u); }
      else if (blocks.length > 1 && index > 0) {
        commitBlocks(blocks.filter((b: any) => b.id !== id));
        setTimeout(() => { const n = document.querySelectorAll('[contenteditable]')[index-1] as HTMLElement; if (n) { n.focus(); const r = document.createRange(); r.selectNodeContents(n); r.collapse(false); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(r); } }, 10);
      }
    }
  };

  const getPrefix = (ci: number) => {
    const block = blocks[ci];
    if (block.type !== 'point') return '';
    const ind = block.indent;
    let count = 1;
    for (let i = ci - 1; i >= 0; i--) {
      if (blocks[i].type !== 'point') continue;
      if (blocks[i].indent < ind) break;
      if (blocks[i].indent === ind) count++;
    }
    const rom = (n: number) => ['','i','ii','iii','iv','v','vi','vii','viii','ix','x'][n] || n.toString();
    if (ind === 0) return `${count}.`;
    if (ind === 1) return `${String.fromCharCode(96 + count)}.`;
    return `${rom(count)}.`;
  };

  // ── Version history ────────────────────────────────────────────────────────────
  const loadVersions = async () => {
    setLV(true);
    try {
      const result = await getResolutionVersions(activeRes.id);
      setVersions(result.versions || []);
    } catch (e) { console.error(e); }
    setLV(false);
  };

  const handleShowHistory = () => {
    setShowHistory(v => !v);
    setShowAmendments(false);
    if (!showHistory) loadVersions();
  };

  const handleRestoreVersion = async (ver: any) => {
    if (!window.confirm(`Restore version from ${timeAgo(ver.saved_at)}? Current content will be saved as a new version.`)) return;
    try {
      const result = await restoreResolutionVersion(activeRes.id, ver.id);
      const parsed = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
      if (Array.isArray(parsed)) setBlocks(parsed);
      setPreviewVersion(null);
      setShowHistory(false);
      setSyncStatus('saved');
    } catch (e) { console.error(e); }
  };

  // ── Amendments ─────────────────────────────────────────────────────────────────
  const loadAmendments = async (resId: number) => {
    try {
      const result = await getAmendments(resId);
      setAmendments(result.amendments || []);
    } catch (e) { console.error(e); }
  };

  const startAmendMode = (type: AmendType) => {
    setAmendMode(type);
    setAmendInput('');
    setAmendDraft({ blockId:'', charStart:0, charEnd:0, originalText:'', proposedText:'' });
    // Listen for selection
  };

  const captureSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    // Find which block this is in
    const container = range.commonAncestorContainer;
    const blockEl = (container as HTMLElement).closest?.('[data-block-id]') || (container as HTMLElement).parentElement?.closest('[data-block-id]');
    const blockId = blockEl?.getAttribute('data-block-id') || '';
    const text = sel.toString();
    const block = blocks.find((b: any) => b.id === blockId);
    const fullText = block?.text || '';
    const charStart = fullText.indexOf(text);
    const charEnd = charStart + text.length;
    setAmendDraft({ blockId, charStart: Math.max(0, charStart), charEnd: Math.max(0, charEnd), originalText: text, proposedText: '' });
  };

  const submitAmendmentDraft = async () => {
    if (!amendDraft.blockId && amendMode !== 'add') return;
    try {
      await submitAmendment(activeRes.id, amendMode!, amendDraft.blockId, amendDraft.charStart, amendDraft.charEnd, amendDraft.originalText, amendInput);
      setAmendMode(null);
      setAmendInput('');
      loadAmendments(activeRes.id);
    } catch (e) { console.error(e); }
  };

  const handleReviewAmendment = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await reviewAmendment(id, status);
      loadAmendments(activeRes.id);
      if (status === 'approved') {
        // Reload blocks from DB
        const { data: res } = await supabase.from('resolutions').select('content').eq('id', activeRes.id).single();
        if (res) {
          const parsed = JSON.parse(res.content);
          if (Array.isArray(parsed)) setBlocks(parsed);
        }
      }
    } catch (e) { console.error(e); }
  };

  // ── Chair status actions ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!window.confirm('Submit this resolution for review? Delegates will no longer be able to edit it.')) return;
    try {
      await submitResolution(activeRes.id);
      setActiveRes((p: any) => ({ ...p, status: 'submitted' }));
      setResolutions(prev => prev.map(r => r.id === activeRes.id ? { ...r, status: 'submitted' } : r));
    } catch (e) { console.error(e); }
  };

  const handleLock = async () => {
    try {
      if (activeRes.status === 'locked') {
        await unlockResolution(activeRes.id);
        setActiveRes((p: any) => ({ ...p, status: 'draft' }));
      } else {
        await lockResolution(activeRes.id);
        setActiveRes((p: any) => ({ ...p, status: 'locked' }));
      }
    } catch (e) { console.error(e); }
  };

  const handleReopen = async () => {
    try {
      await reopenResolution(activeRes.id);
      setActiveRes((p: any) => ({ ...p, status: 'draft', submitted_at: null }));
    } catch (e) { console.error(e); }
  };

  // ── Permissions ───────────────────────────────────────────────────────────────
  const canEdit = isChair
    ? activeRes?.status !== 'locked'
    : activeRes?.status === 'draft';

  const filteredResolutions = blocFilter === 'all' ? resolutions : resolutions.filter(r => r.bloc_id?.toString() === blocFilter);

  const statusColor = (s: string) => s === 'locked' ? '#DC2626' : s === 'submitted' ? '#F59E0B' : '#22C55E';
  const statusLabel = (s: string) => s === 'locked' ? 'Locked' : s === 'submitted' ? 'Submitted' : 'Draft';

  const pendingAmendments = amendments.filter(a => a.status === 'pending');

  // ── EDITOR VIEW ───────────────────────────────────────────────────────────────
  if (activeRes) {
    const previewBlocks = previewVersion
      ? (() => { try { return JSON.parse(previewVersion.content); } catch { return []; } })()
      : null;

    return (
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', background: presentationMode ? 'var(--bg-elevated)' : 'var(--bg-base)', overflow:'hidden' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
          [contenteditable]:empty:before { content:attr(data-placeholder); color:var(--text-muted); pointer-events:none; display:block; }
          [contenteditable]:focus { outline:none; }
          .amend-panel { width:300px; flex-shrink:0; border-left:1px solid var(--border); background:var(--bg-sidebar); display:flex; flex-direction:column; overflow:hidden; }
          .amend-item { padding:14px 16px; border-bottom:1px solid var(--border); }
          .amend-item:last-child { border-bottom:none; }
          .ver-item { padding:12px 14px; border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.1s; }
          .ver-item:hover { background:var(--bg-surface); }
          .ver-item:last-child { border-bottom:none; }
          .status-pill { font-size:10px; font-weight:800; padding:2px 8px; border-radius:99px; text-transform:uppercase; letter-spacing:1px; }
          @media(max-width:768px) { .amend-panel { display:none; } }
        `}</style>

        {/* ── Toolbar ── */}
        {!presentationMode && (
          <div style={{ padding:'0 24px', height:52, background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'var(--shadow-sm)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <button onClick={() => setActiveRes(null)} style={{ background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color:'var(--text-secondary)', fontSize:13, fontWeight:600, fontFamily:'Manrope,sans-serif', padding:'6px 10px', borderRadius:8 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='var(--bg-surface)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
              ><IconBack /> Resolutions</button>
              <div style={{ width:1, height:20, background:'var(--border)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:syncStatus==='saved'?'#22C55E':'var(--accent)', transition:'background 0.3s' }} />
                <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>{syncStatus==='saved'?'All changes saved':'Saving…'}</span>
              </div>
              {/* Presence indicators */}
              {presences.length > 0 && (
                <div style={{ display:'flex', gap:4 }}>
                  {presences.slice(0,4).map((p: any) => (
                    <div key={p.userId} title={p.delegation} style={{ width:24, height:24, borderRadius:6, background:userColor(p.userId), display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, color:'#fff', flexShrink:0 }}>
                      {(p.delegation||'?').slice(0,2).toUpperCase()}
                    </div>
                  ))}
                  {presences.length > 4 && <div style={{ width:24, height:24, borderRadius:6, background:'var(--bg-surface)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'var(--text-muted)' }}>+{presences.length-4}</div>}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {/* Status pill */}
              <span className="status-pill" style={{ background:`${statusColor(activeRes.status)}18`, color:statusColor(activeRes.status), border:`1px solid ${statusColor(activeRes.status)}30` }}>
                {statusLabel(activeRes.status)}
              </span>

              {/* Chair actions */}
              {isChair && (
                <>
                  {activeRes.status === 'submitted' && (
                    <button onClick={handleReopen} style={{ fontSize:11, padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'Manrope,sans-serif', fontWeight:700 }}>
                      Reopen
                    </button>
                  )}
                  <button onClick={handleLock} style={{ fontSize:11, padding:'6px 12px', borderRadius:8, border:'1px solid', cursor:'pointer', fontFamily:'Manrope,sans-serif', fontWeight:700, display:'flex', alignItems:'center', gap:5, background: activeRes.status==='locked' ? 'rgba(220,38,38,0.08)' : 'var(--bg-surface)', color: activeRes.status==='locked' ? '#DC2626' : 'var(--text-secondary)', borderColor: activeRes.status==='locked' ? 'rgba(220,38,38,0.25)' : 'var(--border)' }}>
                    {activeRes.status==='locked' ? <><IconUnlock/>Unlock</> : <><IconLock/>Lock</>}
                  </button>
                </>
              )}

              {/* Delegate: submit */}
              {!isChair && activeRes.status === 'draft' && (
                <button onClick={handleSubmit} style={{ fontSize:11, padding:'6px 14px', borderRadius:8, background:'var(--accent)', color:'#fff', border:'none', cursor:'pointer', fontFamily:'Manrope,sans-serif', fontWeight:700, boxShadow:'0 2px 8px rgba(240,124,0,0.25)' }}>
                  Submit for Review
                </button>
              )}

              {/* Version history */}
              <button onClick={handleShowHistory} style={{ fontSize:11, padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background: showHistory ? 'var(--accent-soft)' : 'var(--bg-surface)', color: showHistory ? 'var(--accent)' : 'var(--text-secondary)', cursor:'pointer', fontFamily:'Manrope,sans-serif', fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                <IconHistory /> History
              </button>

              {/* Amendments */}
              <button onClick={() => { setShowAmendments(v=>!v); setShowHistory(false); }} style={{ fontSize:11, padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)', background: showAmendments ? 'var(--accent-soft)' : 'var(--bg-surface)', color: showAmendments ? 'var(--accent)' : 'var(--text-secondary)', cursor:'pointer', fontFamily:'Manrope,sans-serif', fontWeight:700, display:'flex', alignItems:'center', gap:5, position:'relative' }}>
                <IconAmend /> Amendments
                {pendingAmendments.length > 0 && <span style={{ position:'absolute', top:-4, right:-4, minWidth:16, height:16, borderRadius:99, background:'#DC2626', color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>{pendingAmendments.length}</span>}
              </button>

              {isChair && <button className="primary-btn" style={{ fontSize:11, padding:'8px 14px' }} onClick={() => setPresentationMode(true)}>Present</button>}
            </div>
          </div>
        )}

        {presentationMode && (
          <button onClick={() => setPresentationMode(false)} style={{ position:'fixed', top:20, right:20, padding:'8px 16px', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)', color:'#fff', borderRadius:8, zIndex:100, border:'none', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'Manrope,sans-serif' }}>Exit</button>
        )}

        {/* ── Status banner for delegates ── */}
        {!isChair && activeRes.status === 'submitted' && (
          <div style={{ padding:'8px 24px', background:'rgba(245,158,11,0.08)', borderBottom:'1px solid rgba(245,158,11,0.20)', fontSize:12, fontWeight:700, color:'#B45309', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
            <IconCheck /> Submitted for review — editing disabled. Use Amendments to propose changes.
          </div>
        )}
        {!isChair && activeRes.status === 'locked' && (
          <div style={{ padding:'8px 24px', background:'rgba(220,38,38,0.07)', borderBottom:'1px solid rgba(220,38,38,0.18)', fontSize:12, fontWeight:700, color:'#DC2626', flexShrink:0, display:'flex', alignItems:'center', gap:8 }}>
            <IconLock /> Locked by Chair — no changes can be made.
          </div>
        )}

        {/* ── Body: doc + side panels ── */}
        <div style={{ flex:1, display:'flex', minHeight:0 }}>

          {/* Doc scroll area */}
          <div style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding: presentationMode ? '60px 40px' : '40px 52px' }}>
            <div style={{ margin:'0 auto', width:'100%', maxWidth:816 }}>
              <div style={{ background:'var(--bg-elevated)', width:'100%', borderRadius: presentationMode ? 0 : 4, padding:`clamp(24px,6vw,72px) clamp(20px,8vw,96px)`, boxShadow: presentationMode ? 'none' : 'var(--shadow-md)', border: presentationMode ? 'none' : '1px solid var(--border)', boxSizing:'border-box', overflow:'hidden' }}>

                {/* Title */}
                <input value={activeRes.title} onChange={e => handleTitleChange(e.target.value)} spellCheck={false}
                  placeholder="Untitled Resolution" disabled={!canEdit}
                  style={{ width:'100%', textAlign:'center', background:'transparent', border:'none', color: presentationMode ? 'var(--text-primary)' : 'var(--text-primary)', fontSize: presentationMode ? '40px' : '26px', fontWeight:800, fontFamily:'Manrope,sans-serif', textTransform:'uppercase', outline:'none', padding:0, marginBottom:8, letterSpacing:'-0.5px', boxSizing:'border-box', cursor: canEdit ? 'text' : 'default' }}
                />

                {/* Subtitle */}
                <div style={{ display:'flex', justifyContent:'center', marginBottom:32, gap:8, alignItems:'center' }}>
                  <div style={{ height:1, flex:1, background:'var(--border)' }} />
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'1.5px', whiteSpace:'nowrap' }}>
                    {profile?.committee} · {activeRes.created_at ? new Date(activeRes.created_at).getFullYear() : new Date().getFullYear()}
                    {activeRes.updated_at && ` · Edited ${timeAgo(activeRes.updated_at)}`}
                  </span>
                  <div style={{ height:1, flex:1, background:'var(--border)' }} />
                </div>

                {/* Blocks — preview or live */}
                {(previewBlocks || blocks).map((block: any, index: number) => (
                  <div key={block.id} data-block-id={block.id} onClick={() => trackCursorBlock(block.id)}>
                    <EditableBlock
                      block={block} index={index}
                      commitBlocks={previewBlocks ? () => {} : commitBlocks}
                      blocks={previewBlocks || blocks}
                      handleKeyDown={handleKeyDown}
                      getPrefix={getPrefix}
                      canEdit={!previewBlocks && canEdit}
                      presences={presences}
                    />
                  </div>
                ))}

                {previewBlocks && (
                  <div style={{ marginTop:32, padding:'12px 16px', background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.20)', borderRadius:10, fontSize:12, fontWeight:600, color:'#6366F1', display:'flex', gap:12, alignItems:'center' }}>
                    Previewing historical version — {previewVersion?.label} · {timeAgo(previewVersion?.saved_at)}
                    <button onClick={() => setPreviewVersion(null)} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'#6366F1', cursor:'pointer', fontWeight:700, fontFamily:'Manrope,sans-serif', fontSize:12 }}>Exit Preview</button>
                    {isChair && <button onClick={() => handleRestoreVersion(previewVersion)} style={{ background:'#6366F1', color:'#fff', border:'none', borderRadius:8, padding:'4px 12px', cursor:'pointer', fontWeight:700, fontFamily:'Manrope,sans-serif', fontSize:12 }}>Restore</button>}
                  </div>
                )}

                <div style={{ height:80 }} />
              </div>
            </div>
          </div>

          {/* ── Version history panel ── */}
          {showHistory && (
            <div className="amend-panel">
              <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                <p style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)' }}>Version History</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>Click to preview, restore to apply</p>
              </div>
              <div style={{ flex:1, overflowY:'auto' }}>
                {loadingVersions && <p style={{ padding:16, fontSize:12, color:'var(--text-muted)' }}>Loading…</p>}
                {!loadingVersions && versions.length === 0 && <p style={{ padding:16, fontSize:12, color:'var(--text-muted)' }}>No versions saved yet. Versions are saved automatically on submit, lock, and every 5 min.</p>}
                {versions.map(v => (
                  <div key={v.id} className="ver-item" onClick={() => setPreviewVersion(v)} style={{ background: previewVersion?.id === v.id ? 'var(--accent-soft)' : undefined }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'var(--accent)' }}>{v.label || 'Auto'}</span>
                      <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>{timeAgo(v.saved_at)}</span>
                    </div>
                    <p style={{ fontSize:11, color:'var(--text-secondary)' }}>{v.users?.delegation || v.users?.role || 'System'}</p>
                    {isChair && previewVersion?.id === v.id && (
                      <button onClick={e => { e.stopPropagation(); handleRestoreVersion(v); }} style={{ marginTop:8, fontSize:11, padding:'4px 10px', borderRadius:6, background:'var(--accent)', color:'#fff', border:'none', cursor:'pointer', fontWeight:700, fontFamily:'Manrope,sans-serif' }}>Restore this version</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Amendments panel ── */}
          {showAmendments && (
            <div className="amend-panel">
              <div style={{ padding:'16px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                <p style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)', marginBottom:8 }}>Amendments</p>
                {/* Delegate: propose amendment */}
                {(activeRes.status === 'submitted' || isChair) && (
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {(['add','modify','strike'] as AmendType[]).map(t => (
                      <button key={t} onClick={() => startAmendMode(t === amendMode ? null : t)}
                        style={{ fontSize:10, padding:'4px 10px', borderRadius:6, border:'1px solid', fontWeight:700, fontFamily:'Manrope,sans-serif', cursor:'pointer', background: amendMode===t ? 'var(--accent)' : 'var(--bg-surface)', color: amendMode===t ? '#fff' : 'var(--text-secondary)', borderColor: amendMode===t ? 'var(--accent)' : 'var(--border)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Amendment draft UI */}
              {amendMode && (
                <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', background:'var(--accent-soft)' }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:8, textTransform:'uppercase', letterSpacing:'1px' }}>
                    {amendMode === 'add' ? 'Place cursor, then type text to add' : amendMode === 'modify' ? 'Select text in document, then type replacement' : 'Select text in document to strike'}
                  </p>
                  {amendMode !== 'strike' && (
                    <input
                      className="dark-input"
                      style={{ margin:'0 0 8px', fontSize:12, padding:'8px 10px', minHeight:36 }}
                      value={amendInput}
                      onChange={e => setAmendInput(e.target.value)}
                      placeholder={amendMode==='add' ? 'Text to insert…' : 'Replacement text…'}
                    />
                  )}
                  <div style={{ display:'flex', gap:6 }}>
                    {(amendMode === 'modify' || amendMode === 'strike') && (
                      <button onClick={captureSelection} style={{ flex:1, fontSize:11, padding:'6px', borderRadius:7, border:'1px solid var(--accent-mid)', background:'transparent', color:'var(--accent)', cursor:'pointer', fontWeight:700, fontFamily:'Manrope,sans-serif' }}>
                        Capture Selection
                      </button>
                    )}
                    <button onClick={submitAmendmentDraft} style={{ flex:1, fontSize:11, padding:'6px', borderRadius:7, background:'var(--accent)', color:'#fff', border:'none', cursor:'pointer', fontWeight:700, fontFamily:'Manrope,sans-serif' }}>
                      Submit
                    </button>
                    <button onClick={() => setAmendMode(null)} style={{ fontSize:11, padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'Manrope,sans-serif' }}>
                      Cancel
                    </button>
                  </div>
                  {amendDraft.originalText && (
                    <p style={{ fontSize:11, marginTop:8, color:'var(--text-secondary)', background:'var(--bg-elevated)', padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', wordBreak:'break-word' }}>
                      Selected: "{amendDraft.originalText}"
                    </p>
                  )}
                </div>
              )}

              {/* Amendment list */}
              <div style={{ flex:1, overflowY:'auto' }}>
                {amendments.length === 0 && <p style={{ padding:16, fontSize:12, color:'var(--text-muted)' }}>No amendments yet.</p>}
                {amendments.map(a => (
                  <div key={a.id} className="amend-item">
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', padding:'2px 7px', borderRadius:99, background:
                        a.type==='add'?'rgba(34,197,94,0.12)':a.type==='strike'?'rgba(220,38,38,0.10)':'rgba(245,158,11,0.12)',
                        color:a.type==='add'?'#16A34A':a.type==='strike'?'#DC2626':'#B45309'
                      }}>{a.type}</span>
                      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:99, fontWeight:700, background:
                        a.status==='pending'?'rgba(245,158,11,0.12)':a.status==='approved'?'rgba(34,197,94,0.12)':'rgba(220,38,38,0.10)',
                        color:a.status==='pending'?'#B45309':a.status==='approved'?'#16A34A':'#DC2626'
                      }}>{a.status}</span>
                      <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>{timeAgo(a.submitted_at)}</span>
                    </div>
                    <p style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginBottom:4 }}>{a.users?.delegation || a.users?.role || 'Unknown'}</p>
                    {a.original_text && (
                      <p style={{ fontSize:11, color:'var(--text-muted)', textDecoration:'line-through', marginBottom:2, wordBreak:'break-word' }}>{a.original_text}</p>
                    )}
                    {a.proposed_text && (
                      <p style={{ fontSize:11, color:'var(--text-primary)', wordBreak:'break-word' }}>{a.proposed_text}</p>
                    )}
                    {/* Chair review buttons */}
                    {isChair && a.status === 'pending' && (
                      <div style={{ display:'flex', gap:6, marginTop:8 }}>
                        <button onClick={() => handleReviewAmendment(a.id, 'approved')} style={{ flex:1, fontSize:11, padding:'5px', borderRadius:7, background:'rgba(34,197,94,0.12)', color:'#16A34A', border:'1px solid rgba(34,197,94,0.25)', cursor:'pointer', fontWeight:700, fontFamily:'Manrope,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}><IconCheck />Approve</button>
                        <button onClick={() => handleReviewAmendment(a.id, 'rejected')} style={{ flex:1, fontSize:11, padding:'5px', borderRadius:7, background:'rgba(220,38,38,0.08)', color:'#DC2626', border:'1px solid rgba(220,38,38,0.20)', cursor:'pointer', fontWeight:700, fontFamily:'Manrope,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}><IconX />Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <p style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'2px', color:'var(--accent)', marginBottom:6 }}>
            {profile?.committee} · Drafting
          </p>
          <h1 className="delegation-brand">{isChair ? 'Chair Overwatch' : 'Resolutions'}</h1>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {isChair && (
            <select className="dark-input" style={{ width:180, margin:0, minHeight:40, fontSize:12 }} value={blocFilter} onChange={e => setBlocFilter(e.target.value)}>
              <option value="all">All Blocs</option>
              {myBlocs.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
            </select>
          )}
          {!isChair && <button className="primary-btn" onClick={() => setIsResModal(true)}>New Resolution</button>}
        </div>
      </div>

      <div className="panel" style={{ gridColumn:'1 / -1' }}>
        <span className="label"><IconFile /> Documents Repository</span>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
          {filteredResolutions.map(r => (
            <div key={r.id} onClick={() => openResolution(r)}
              style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:14, padding:20, cursor:'pointer', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:8 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--accent-border)'; (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='var(--shadow-md)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--border)'; (e.currentTarget as HTMLElement).style.transform='translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow='none'; }}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ width:36, height:36, background:'var(--accent-soft)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)', flexShrink:0 }}><IconFile /></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <h3 style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</h3>
                  <span style={{ fontSize:11, color:'var(--accent)', fontWeight:600 }}>{r.blocs?.name || 'Independent'}</span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:99, background:`${statusColor(r.status||'draft')}18`, color:statusColor(r.status||'draft') }}>
                  {statusLabel(r.status||'draft')}
                </span>
                {r.updated_at && <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:500 }}>Edited {timeAgo(r.updated_at)}</span>}
              </div>
            </div>
          ))}
          {filteredResolutions.length === 0 && <p style={{ color:'var(--text-muted)', fontSize:13, gridColumn:'1/-1', padding:'20px 0' }}>No documents yet.</p>}
        </div>
      </div>

      {isResModal && (
        <div className="overlay">
          <div className="modal">
            <h2>New Resolution</h2>
            <input className="dark-input" style={{ minHeight:48 }} value={newResTitle} onChange={e => setNewResTitle(e.target.value)} placeholder="e.g. Working Paper 1.1" />
            <select className="dark-input" style={{ minHeight:48 }} value={selectedBlocId} onChange={e => setSelectedBlocId(e.target.value)}>
              <option value="">Select Bloc…</option>
              {myBlocs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div style={{ display:'flex', gap:10, marginTop:6 }}>
              <button className="primary-btn" style={{ flex:1, height:44 }} onClick={handleCreateResolution}>Create</button>
              <button className="logout-btn" style={{ flex:1, height:44, marginTop:0 }} onClick={() => setIsResModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}