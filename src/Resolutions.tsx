import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

// --- ICONS ---
const IconBold = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>;
const IconItalic = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>;
const IconUnderline = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>;
const IconHighlight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>;
const IconFile = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
const IconBack = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const IconCheck = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>;

// --- FLOATING TOOLBAR ---
const FloatingToolbar = ({ position, onAction }: any) => {
  if (!position) return null;
  return (
    <div style={{
      position: 'fixed',
      top: position.top,
      left: position.left,
      transform: 'translateY(-110%)',
      display: 'flex',
      gap: '2px',
      background: '#fff',
      border: '1px solid rgba(0,0,0,0.10)',
      borderRadius: '10px',
      padding: '6px',
      zIndex: 1000,
      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
    }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {[
        { icon: <IconBold />, action: 'bold', title: 'Bold' },
        { icon: <IconItalic />, action: 'italic', title: 'Italic' },
        { icon: <IconUnderline />, action: 'underline', title: 'Underline' },
        { icon: <IconHighlight />, action: 'hilite', title: 'Highlight' },
      ].map(({ icon, action, title }) => (
        <button key={action} title={title} onClick={() => onAction(action)} style={{ background: 'transparent', border: '1px solid transparent', color: '#52525B', width: '30px', height: '30px', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(240,124,0,0.08)'; (e.currentTarget as HTMLElement).style.color = '#F07C00'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#52525B'; }}
        >{icon}</button>
      ))}
    </div>
  );
};

// --- EDITABLE BLOCK ---
const EditableBlock = ({ block, index, commitBlocks, blocks, handleKeyDown, getPrefix, isChair }: any) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<any>(null);

  useEffect(() => {
    if (editorRef.current && document.activeElement !== editorRef.current) {
      if (editorRef.current.innerHTML !== block.html) editorRef.current.innerHTML = block.html || '';
    }
  }, [block.html]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const updated = blocks.map((b: any) => b.id === block.id ? { ...b, html: e.currentTarget.innerHTML, text: e.currentTarget.textContent || '' } : b);
    commitBlocks(updated);
  };

  const handleMouseUp = () => {
    if (!isChair) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode)) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setToolbarPos({ top: rect.top, left: rect.left + (rect.width / 2) - 66 });
    } else setToolbarPos(null);
  };

  const applyFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current) commitBlocks(blocks.map((b: any) => b.id === block.id ? { ...b, html: editorRef.current!.innerHTML, text: editorRef.current!.textContent || '' } : b));
    setToolbarPos(null);
  };

  const handleFormatAction = (action: string) => {
    if (action === 'hilite') {
      const isHighlighted = document.queryCommandValue('backColor') === 'rgba(240, 124, 0, 0.2)';
      document.execCommand('backColor', false, isHighlighted ? 'transparent' : 'rgba(240, 124, 0, 0.2)');
    } else applyFormat(action);
  };

  const handleLocalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isChair && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); handleFormatAction('hilite'); }
    handleKeyDown(e, index, block.id, editorRef.current);
  };

  const indentMap: Record<string, string> = { heading: '0', paragraph: '0', point: `${block.indent * 32}px` };

  const fontSizes: Record<string, string> = { heading: '22px', paragraph: '15px', point: '15px' };
  const fontWeights: Record<string, string> = { heading: '800', paragraph: '400', point: '400' };
  const fontColors: Record<string, string> = { heading: '#F07C00', paragraph: '#27272A', point: '#27272A' };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginLeft: indentMap[block.type] || '0', marginBottom: '4px', position: 'relative', cursor: 'text' }}
      onClick={() => editorRef.current?.focus()}>
      <FloatingToolbar position={toolbarPos} onAction={handleFormatAction} />
      {block.type === 'point' && (
        <div style={{ width: '36px', paddingTop: '3px', color: '#F07C00', fontWeight: 800, fontSize: '14px', flexShrink: 0, textAlign: 'right', paddingRight: '12px', userSelect: 'none' }}>
          {getPrefix(index)}
        </div>
      )}
      {block.type === 'heading' && (
        <div style={{ width: '20px', paddingTop: '6px', marginRight: '8px', flexShrink: 0 }}>
          <div style={{ width: '4px', height: '20px', background: '#F07C00', borderRadius: '2px', opacity: 0.6 }} />
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        style={{
          flex: 1, minHeight: '1.6em', padding: '3px 0', fontFamily: 'Manrope, sans-serif',
          fontSize: fontSizes[block.type] || '15px',
          fontWeight: fontWeights[block.type] || '400',
          color: fontColors[block.type] || '#27272A',
          lineHeight: block.type === 'heading' ? 1.3 : 1.7,
          outline: 'none', whiteSpace: 'pre-wrap',
          marginBottom: block.type === 'heading' ? '16px' : '0',
          letterSpacing: block.type === 'heading' ? '-0.5px' : '0',
          textTransform: block.type === 'heading' ? 'uppercase' : 'none',
        }}
        spellCheck={false}
        data-placeholder={block.type === 'heading' ? 'Resolution heading…' : block.type === 'point' ? 'Clause…' : 'Write here…'}
        onInput={handleInput}
        onMouseUp={handleMouseUp}
        onKeyDown={handleLocalKeyDown}
      />
    </div>
  );
};

// --- MAIN ---
export default function Resolutions() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [resolutions, setResolutions] = useState<any[]>([]);
  const [activeRes, setActiveRes] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving'>('saved');
  const [isResModal, setIsResModal] = useState(false);
  const [myBlocs, setMyBlocs] = useState<any[]>([]);
  const [newResTitle, setNewResTitle] = useState('');
  const [selectedBlocId, setSelectedBlocId] = useState('');
  const [presentationMode, setPresentationMode] = useState(false);
  const [blocFilter, setBlocFilter] = useState('all');

  const pendingBlocks = useRef(blocks);
  const activeResRef = useRef(activeRes);
  const lastSaveTime = useRef(Date.now());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isChair = profile?.role !== 'Delegate' && profile?.role !== null;

  useEffect(() => { pendingBlocks.current = blocks; }, [blocks]);
  useEffect(() => { activeResRef.current = activeRes; }, [activeRes]);
  useEffect(() => { if (authUser) fetchCoreData(); }, [authUser]);

  useEffect(() => {
    const handleUnload = () => {
      if (activeResRef.current && pendingBlocks.current.length > 0)
        supabase.from('resolutions').update({ content: JSON.stringify(pendingBlocks.current) }).eq('id', activeResRef.current.id);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => { window.removeEventListener('beforeunload', handleUnload); handleUnload(); };
  }, []);

  useEffect(() => {
    if (!activeRes) return;
    const channel = supabase.channel(`res_${activeRes.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'resolutions', filter: `id=eq.${activeRes.id}` }, (payload) => {
        try {
          if (payload.new.title !== activeRes.title) { setActiveRes((p: any) => ({ ...p, title: payload.new.title })); setResolutions(prev => prev.map(r => r.id === activeRes.id ? { ...r, title: payload.new.title } : r)); }
          const inc = typeof payload.new.content === 'string' ? JSON.parse(payload.new.content) : payload.new.content;
          if (Array.isArray(inc) && JSON.stringify(inc) !== JSON.stringify(blocks)) setBlocks(inc);
        } catch (e) { }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeRes, blocks]);

  const fetchCoreData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (userData) {
      setProfile(userData);
      const { data: allBlocs } = await supabase.from('blocs').select('*').eq('committee', userData.committee);
      if (userData.role !== 'Delegate') {
        setMyBlocs(allBlocs || []);
        const { data: res } = await supabase.from('resolutions').select('*, blocs(name)').eq('committee', userData.committee);
        if (res) setResolutions(res);
      } else {
        const { data: memberOf } = await supabase.from('bloc_members').select('bloc_id').eq('user_id', authUser?.id);
        const myIds = memberOf?.map(b => b.bloc_id) || [];
        setMyBlocs(allBlocs?.filter(b => myIds.includes(b.id)) || []);
        if (myIds.length > 0) { const { data: res } = await supabase.from('resolutions').select('*, blocs(name)').in('bloc_id', myIds); if (res) setResolutions(res); }
      }
    }
  };

  const handleCreateResolution = async () => {
    if (!newResTitle.trim() || !selectedBlocId) return;
    const initialContent = JSON.stringify([{ id: Date.now().toString(), type: 'heading', html: '', text: '', indent: 0 }]);
    const { data: res } = await supabase.from('resolutions').insert([{ title: newResTitle, bloc_id: parseInt(selectedBlocId), committee: profile?.committee, content: initialContent }]).select().single();
    if (res) { setResolutions([res, ...resolutions]); openResolution(res); setIsResModal(false); setNewResTitle(''); }
  };

  const openResolution = (res: any) => {
    setActiveRes(res);
    setSyncStatus('saved');
    try {
      let parsed = typeof res.content === 'string' ? JSON.parse(res.content) : res.content;
      setBlocks(Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: Date.now().toString(), type: 'heading', html: '', text: '', indent: 0 }]);
    } catch { setBlocks([{ id: Date.now().toString(), type: 'heading', html: '', text: '', indent: 0 }]); }
  };

  const executeDbSave = async (dataToSave: any[]) => {
    lastSaveTime.current = Date.now();
    if (activeResRef.current) { await supabase.from('resolutions').update({ content: JSON.stringify(dataToSave) }).eq('id', activeResRef.current.id); setSyncStatus('saved'); }
  };

  const commitBlocks = (updated: any[]) => {
    setBlocks(updated);
    setSyncStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    const since = Date.now() - lastSaveTime.current;
    if (since > 1500) executeDbSave(updated);
    else saveTimeoutRef.current = setTimeout(() => executeDbSave(updated), 400);
  };

  const handleTitleChange = (newTitle: string) => {
    setActiveRes({ ...activeRes, title: newTitle });
    setSyncStatus('saving');
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => { await supabase.from('resolutions').update({ title: newTitle }).eq('id', activeRes.id); setSyncStatus('saved'); }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, id: string, el: HTMLDivElement | null) => {
    const block = blocks[index];
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const u = [...blocks];
      if (u[index].type === 'paragraph') { u[index].type = 'point'; u[index].indent = 0; } else if (u[index].type === 'point' && u[index].indent < 2) u[index].indent += 1;
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
      const newBlock = { id: Date.now().toString(), type: block.type === 'point' ? 'point' : 'paragraph', html: '', text: '', indent: block.type === 'point' ? block.indent : 0 };
      const u = [...blocks]; u.splice(index + 1, 0, newBlock); commitBlocks(u);
      setTimeout(() => { const nodes = document.querySelectorAll('[contenteditable]'); if (nodes[index + 1]) (nodes[index + 1] as HTMLElement).focus(); }, 10);
    } else if (e.key === 'Backspace' && (el?.textContent === '' || el?.innerHTML === '<br>')) {
      e.preventDefault();
      if (block.type === 'point' && block.indent > 0) { const u = [...blocks]; u[index].indent -= 1; commitBlocks(u); }
      else if (block.type === 'point' && block.indent === 0) { const u = [...blocks]; u[index].type = 'paragraph'; commitBlocks(u); }
      else if (blocks.length > 1 && index > 0) {
        commitBlocks(blocks.filter((b: any) => b.id !== id));
        setTimeout(() => { const nodes = document.querySelectorAll('[contenteditable]'); if (nodes[index - 1]) { const n = nodes[index - 1] as HTMLElement; n.focus(); const r = document.createRange(); r.selectNodeContents(n); r.collapse(false); window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(r); } }, 10);
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
    const rom = (n: number) => ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'][n] || n.toString();
    if (ind === 0) return `${count}.`;
    if (ind === 1) return `${String.fromCharCode(96 + count)}.`;
    return `${rom(count)}.`;
  };

  const filteredResolutions = blocFilter === 'all' ? resolutions : resolutions.filter(r => r.bloc_id?.toString() === blocFilter);

  // ---- EDITOR VIEW ----
  if (activeRes) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: presentationMode ? '#fff' : '#F0EDE8' }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
          [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: #C4C4C4;
            pointer-events: none;
          }
          [contenteditable]:focus { outline: none; }
        `}</style>

        {/* Toolbar — Google Docs style */}
        {!presentationMode && (
          <div style={{ padding: '0 32px', height: '52px', background: 'rgba(255,255,255,0.92)', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(8px)', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => setActiveRes(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#71717A', fontSize: '13px', fontWeight: 600, fontFamily: 'Manrope, sans-serif', padding: '6px 10px', borderRadius: '8px', transition: 'all 0.12s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <IconBack /> Resolutions
              </button>
              <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.10)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: syncStatus === 'saved' ? '#22C55E' : '#F07C00', transition: 'background 0.3s' }} />
                <span style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: 500 }}>{syncStatus === 'saved' ? 'All changes saved' : 'Saving…'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isChair && <button className="primary-btn" style={{ fontSize: '11px', padding: '8px 16px' }} onClick={() => setPresentationMode(true)}>Present</button>}
            </div>
          </div>
        )}

        {presentationMode && (
          <button onClick={() => setPresentationMode(false)} style={{ position: 'fixed', top: '20px', right: '20px', padding: '8px 16px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', color: '#fff', borderRadius: '8px', zIndex: 100, border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
            Exit
          </button>
        )}

        {/* Document canvas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: presentationMode ? '60px 40px' : '48px 60px', display: 'flex', justifyContent: 'center' }}>
          {/* Paper */}
          <div style={{
            background: '#fff',
            width: '100%',
            maxWidth: '816px',
            minHeight: presentationMode ? '100%' : '1120px',
            borderRadius: presentationMode ? 0 : '4px',
            padding: presentationMode ? '80px 100px' : '72px 96px',
            boxShadow: presentationMode ? 'none' : '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
            border: presentationMode ? 'none' : '1px solid rgba(0,0,0,0.07)',
          }}>
            {/* Title */}
            <input
              value={activeRes.title}
              onChange={e => handleTitleChange(e.target.value)}
              spellCheck={false}
              placeholder="Untitled Resolution"
              style={{
                width: '100%', textAlign: 'center', background: 'transparent', border: 'none',
                color: presentationMode ? '#111' : '#18181B',
                fontSize: presentationMode ? '40px' : '26px',
                fontWeight: 800, fontFamily: 'Manrope, sans-serif',
                textTransform: 'uppercase', outline: 'none', padding: 0, marginBottom: '8px',
                letterSpacing: '-0.5px',
              }}
            />
            {/* Subtitle line */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px', gap: '8px', alignItems: 'center' }}>
              <div style={{ height: '1px', flex: 1, background: 'rgba(0,0,0,0.08)' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '1.5px', whiteSpace: 'nowrap' }}>{profile?.committee} · {new Date().getFullYear()}</span>
              <div style={{ height: '1px', flex: 1, background: 'rgba(0,0,0,0.08)' }} />
            </div>
            {/* Blocks */}
            {blocks.map((block, index) => (
              <EditableBlock key={block.id} block={block} index={index} commitBlocks={commitBlocks} blocks={blocks} handleKeyDown={handleKeyDown} getPrefix={getPrefix} isChair={isChair} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="container">
      <div className="top-bar">
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#F07C00', marginBottom: '6px' }}>
            {profile?.committee} · Drafting
          </p>
          <h1 className="delegation-brand">{isChair ? 'Chair Overwatch' : 'Resolutions'}</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isChair && (
            <select className="dark-input" style={{ width: '200px', margin: 0, minHeight: '40px', fontSize: '12px' }} value={blocFilter} onChange={e => setBlocFilter(e.target.value)}>
              <option value="all">All Alliances</option>
              {myBlocs.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
            </select>
          )}
          {!isChair && <button className="primary-btn" onClick={() => setIsResModal(true)}>New Resolution</button>}
        </div>
      </div>

      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <span className="label"><IconFile /> Documents Repository</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filteredResolutions.map(r => (
            <div key={r.id} onClick={() => openResolution(r)} style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', padding: '20px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '8px' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(240,124,0,0.30)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', background: 'rgba(240,124,0,0.08)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F07C00', flexShrink: 0 }}>
                  <IconFile />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#18181B', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</h3>
                  <span style={{ fontSize: '11px', color: '#F07C00', fontWeight: 600 }}>{r.blocs?.name || 'Independent'}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredResolutions.length === 0 && <p style={{ color: '#A1A1AA', fontSize: '13px', gridColumn: '1/-1', padding: '20px 0' }}>No documents yet.</p>}
        </div>
      </div>

      {isResModal && (
        <div className="overlay">
          <div className="modal">
            <h2>New Resolution</h2>
            <input className="dark-input" style={{ minHeight: '48px' }} value={newResTitle} onChange={e => setNewResTitle(e.target.value)} placeholder="e.g. Working Paper 1.1" />
            <select className="dark-input" style={{ minHeight: '48px' }} value={selectedBlocId} onChange={e => setSelectedBlocId(e.target.value)}>
              <option value="">Select Alliance…</option>
              {myBlocs.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button className="primary-btn" style={{ flex: 1, height: '44px' }} onClick={handleCreateResolution}>Create</button>
              <button className="logout-btn" style={{ flex: 1, height: '44px', marginTop: 0 }} onClick={() => setIsResModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}