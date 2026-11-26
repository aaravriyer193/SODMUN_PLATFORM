// ResolutionUploads.tsx — upload a resolution file; chairs see the committee's.
// Files go to the private "resolutions" bucket at <committee>/<user id>/<file>.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

const BUCKET = 'resolutions';
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const OK_EXT = /\.(pdf|docx?)$/i;

const fmtSize = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const fmtWhen = (ts: string) => new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const titleFrom = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

export default function ResolutionUploads() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isChair = !!profile && profile.role !== 'Delegate';

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data));
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!profile?.committee) return;
    const { data } = await supabase.from('resolution_uploads')
      .select('*, uploader:users!resolution_uploads_uploaded_by_fkey(delegation, role)')
      .eq('committee', profile.committee).order('created_at', { ascending: false });
    setRows(data || []);
    setLoaded(true);
  }, [profile?.committee]);

  useEffect(() => { load(); }, [load]);

  const flash = (text: string, error = false) => { setNotice({ text, error }); setTimeout(() => setNotice(null), 4000); };

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!OK_EXT.test(f.name)) return flash('Upload a PDF or Word document (.pdf, .doc, .docx).', true);
    if (f.size > MAX_BYTES) return flash('That file is over 10 MB. Export a smaller PDF and try again.', true);
    setFile(f);
    if (!title.trim()) setTitle(titleFrom(f.name));
  };

  const upload = async () => {
    if (!file || !title.trim() || !profile) return;
    setBusy(true);
    const safe = file.name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-');
    const path = `${profile.committee}/${profile.id}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) { setBusy(false); return flash('Upload failed. Check your connection and try again.', true); }
    const { error } = await supabase.from('resolution_uploads').insert([{
      committee: profile.committee, uploaded_by: profile.id, title: title.trim(),
      file_path: path, file_name: file.name, file_size: file.size,
    }]);
    setBusy(false);
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return flash('Upload failed. Try again.', true);
    }
    setFile(null); setTitle('');
    if (inputRef.current) inputRef.current.value = '';
    flash(isChair ? 'Uploaded.' : 'Uploaded. Your chair can now see it.');
    load();
  };

  const download = async (r: any) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(r.file_path, 60, { download: r.file_name });
    if (error || !data?.signedUrl) return flash('Could not open that file.', true);
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const remove = async (r: any) => {
    if (!window.confirm(`Delete “${r.title}”? This cannot be undone.`)) return;
    setRows(prev => prev.filter(x => x.id !== r.id));
    await supabase.storage.from(BUCKET).remove([r.file_path]);
    await supabase.from('resolution_uploads').delete().eq('id', r.id);
    load();
  };

  return (
    <div className="container ru">
      <style>{CSS}</style>
      <header className="page-head">
        <div>
          <p className="page-head__eyebrow">{profile?.committee || '…'} · Resolutions</p>
          <h1 className="page-head__title">Resolutions</h1>
          <p className="page-head__sub">
            {isChair ? 'Every resolution uploaded in your committee, newest first.' : 'Upload your bloc’s resolution as a PDF or Word file. Your chair sees it straight away.'}
          </p>
        </div>
      </header>

      {notice && <div className={`poi-notice ru-notice${notice.error ? ' is-error' : ''}`} role="status">{notice.text}</div>}

      <div className="ru-grid">
        <section className="ru-card ru-upload">
          <div
            className={`ru-drop${drag ? ' is-drag' : ''}${file ? ' has-file' : ''}`}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
            aria-label="Choose a resolution file"
          >
            <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={e => pick(e.target.files?.[0])} />
            <span className="ru-drop__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </span>
            {file
              ? <><strong>{file.name}</strong><span>{fmtSize(file.size)} · click to choose another</span></>
              : <><strong>Drop your resolution here</strong><span>or click to choose · PDF or Word · up to 10 MB</span></>}
          </div>

          <label className="poi-field">
            <span>Title</span>
            <input className="dark-input" value={title} maxLength={200} placeholder="e.g. Resolution on vaccine equity" onChange={e => setTitle(e.target.value)} />
          </label>
          <button className="primary-btn ru-submit" disabled={!file || !title.trim() || busy} onClick={upload}>
            {busy ? 'Uploading…' : 'Upload resolution'}
          </button>
        </section>

        <section className="ru-card ru-list">
          <div className="ru-list__head">
            <h2 className="ru-list__title">{isChair ? 'Committee resolutions' : 'Your uploads'}</h2>
            <span className="ru-count">{rows.length}</span>
          </div>
          {!loaded && <p className="poi-empty">Loading…</p>}
          {loaded && rows.length === 0 && (
            <div className="poi-empty"><strong>Nothing uploaded yet</strong>{isChair ? 'Resolutions appear here as delegates upload them.' : 'Your uploaded resolutions will appear here.'}</div>
          )}
          <ul className="ru-rows">
            {rows.map(r => (
              <li key={r.id} className="ru-row">
                <span className="ru-row__icon" aria-hidden="true">{/\.pdf$/i.test(r.file_name) ? 'PDF' : 'DOC'}</span>
                <span className="ru-row__main">
                  <strong>{r.title}</strong>
                  <span>{isChair && `${r.uploader?.delegation || r.uploader?.role || 'Delegate'} · `}{fmtWhen(r.created_at)} · {fmtSize(r.file_size)}</span>
                </span>
                <span className="ru-row__actions">
                  <button className="poi-ghost ru-btn" onClick={() => download(r)}>Download</button>
                  {r.uploaded_by === profile?.id && <button className="poi-ghost ru-btn" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}>Delete</button>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

const CSS = `
  .ru-grid { display:grid; grid-template-columns:minmax(300px, 380px) minmax(0, 1fr); gap:20px; align-items:start; }
  .ru-card { border:1px solid var(--border); background:var(--bg-surface); border-radius:16px; min-width:0; }
  .ru-upload { padding:22px; display:flex; flex-direction:column; gap:16px; position:sticky; top:24px; }
  .ru-drop { display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; padding:32px 18px; border-radius:14px; border:1.5px dashed var(--border-strong); cursor:pointer; transition:border-color .2s, background .2s; }
  .ru-drop:hover, .ru-drop.is-drag { border-color:var(--green); background:var(--accent-soft); }
  .ru-drop.has-file { border-style:solid; border-color:var(--accent-border); }
  .ru-drop strong { font-size:14.5px; font-weight:500; color:var(--text-primary); word-break:break-all; }
  .ru-drop span:last-child { font-size:12.5px; color:var(--text-muted); }
  .ru-drop__icon { width:48px; height:48px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--green-2); margin-bottom:6px; }
  .ru-upload .poi-field { margin:0; }
  .ru-submit { justify-content:center; width:100%; }

  .ru-list__head { display:flex; justify-content:space-between; align-items:center; padding:18px 22px; border-bottom:1px solid var(--border); }
  .ru-list__title { font-family:var(--sans) !important; font-size:15px; font-weight:500 !important; letter-spacing:0 !important; color:var(--text-primary); }
  .ru-count { font-family:var(--mono); font-size:11px; color:var(--text-muted); padding:2px 8px; border-radius:99px; background:rgba(var(--tint),0.05); }
  .ru-rows { list-style:none; margin:0; padding:0; }
  .ru-row { display:flex; align-items:center; gap:14px; padding:14px 22px; border-bottom:1px solid var(--border); }
  .ru-row:last-child { border-bottom:0; }
  .ru-row__icon { flex-shrink:0; width:40px; height:48px; border-radius:6px; display:flex; align-items:flex-end; justify-content:center; padding-bottom:7px; font-family:var(--mono); font-size:10px; font-weight:500; color:var(--green-2); background:var(--accent-soft); }
  .ru-row__main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
  .ru-row__main strong { font-size:14px; font-weight:500; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ru-row__main span { font-size:12.5px; color:var(--text-muted); }
  .ru-row__actions { display:flex; gap:8px; flex-shrink:0; }
  .ru-btn { height:34px; padding:0 14px; font-size:12.5px; }
  .ru-btn:first-child:hover { background:var(--ink); color:var(--bg); box-shadow:none; }

  @media (max-width: 1100px) {
    .ru-grid { grid-template-columns:1fr; }
    .ru-upload { position:static; }
  }
  @media (max-width: 600px) {
    .ru-row { padding:14px 16px; flex-wrap:wrap; }
    .ru-row__actions { width:100%; padding-left:54px; }
  }
`;
