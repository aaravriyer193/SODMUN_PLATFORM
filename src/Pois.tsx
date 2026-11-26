// Pois.tsx — Points of Information, moderated by the chair.
// Delegate asks → chair approves → recipient answers → chair approves → asker sees it.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

type Status = 'pending' | 'approved' | 'rejected';
interface Poi {
  id: number;
  committee: string;
  from_user: string;
  to_user: string;
  question: string;
  question_status: Status;
  answer: string | null;
  answer_status: Status | null;
  created_at: string;
  updated_at: string;
  asker?: { delegation: string | null; role: string } | null;
  recipient?: { delegation: string | null; role: string } | null;
}

const POLL_MS = 5000;

const toPoi = (r: any): Poi => ({
  ...r,
  asker: { delegation: r.asker_delegation, role: r.asker_role },
  recipient: { delegation: r.recipient_delegation, role: r.recipient_role },
});
const nameOf = (u?: { delegation: string | null; role: string } | null) => u?.delegation || u?.role || 'Delegate';
const timeAgo = (ts: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

/** One line describing where a POI is, from the viewer's point of view. */
function stageOf(p: Poi, viewer: 'asker' | 'recipient' | 'chair'): { label: string; tone: 'wait' | 'ok' | 'no' | 'act' } {
  if (p.question_status === 'pending') return { label: viewer === 'chair' ? 'Question to review' : 'Waiting for chair', tone: viewer === 'chair' ? 'act' : 'wait' };
  if (p.question_status === 'rejected') return { label: 'Question declined', tone: 'no' };
  if (!p.answer_status) return { label: viewer === 'recipient' ? 'Your answer needed' : 'Awaiting answer', tone: viewer === 'recipient' ? 'act' : 'wait' };
  if (p.answer_status === 'pending') return { label: viewer === 'chair' ? 'Answer to review' : 'Answer with chair', tone: viewer === 'chair' ? 'act' : 'wait' };
  if (p.answer_status === 'rejected') return { label: viewer === 'recipient' ? 'Answer declined, try again' : 'Answer declined', tone: viewer === 'recipient' ? 'act' : 'no' };
  return { label: 'Answered', tone: 'ok' };
}

export default function Pois() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [delegates, setDelegates] = useState<any[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'inbox' | 'sent' | 'review' | 'all'>('inbox');

  const [to, setTo] = useState('');
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const isChair = !!profile && profile.role !== 'Delegate';

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('*').eq('id', user.id).single().then(({ data }) => {
      setProfile(data);
      if (data && data.role !== 'Delegate') setTab('review');
    });
  }, [user?.id]);

  useEffect(() => {
    if (!profile?.committee || isChair) return;
    supabase.from('users').select('id, delegation, role')
      .eq('committee', profile.committee).eq('role', 'Delegate').neq('id', profile.id)
      .order('delegation', { ascending: true })
      .then(({ data }) => setDelegates(data || []));
  }, [profile?.committee, isChair]);

  const load = useCallback(async () => {
    if (!profile?.committee) return;
    // poi_feed() applies the visibility rules server-side and hides answers
    // from the asker until the chair approves them.
    const { data, error } = await supabase.rpc('poi_feed');
    if (!error) setPois(((data as any[]) || []).map(toPoi));
    setLoaded(true);
  }, [profile?.committee]);

  // Poll while the tab is visible; Supabase RLS decides what each person gets.
  useEffect(() => {
    if (!profile?.committee) return;
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [profile?.committee, load]);

  const flash = (text: string, error = false) => { setNotice({ text, error }); setTimeout(() => setNotice(null), 3500); };

  const send = async () => {
    if (!to || !question.trim() || !profile) return;
    setSending(true);
    const { error } = await supabase.from('pois').insert([{ committee: profile.committee, from_user: profile.id, to_user: to, question: question.trim() }]);
    setSending(false);
    if (error) return flash('Could not send your POI. Try again.', true);
    setQuestion(''); setTo('');
    flash('Sent. Your chair will review it before it reaches the delegate.');
    setTab('sent');
    load();
  };

  const answer = async (id: number, text: string) => {
    const { error } = await supabase.rpc('poi_answer', { p_id: id, p_answer: text.trim() });
    if (error) return flash('Could not send your answer.', true);
    flash('Answer sent to the chair for approval.');
    load();
  };

  const review = async (id: number, stage: 'question' | 'answer', approve: boolean) => {
    setPois(prev => prev.map(p => p.id !== id ? p : stage === 'question'
      ? { ...p, question_status: approve ? 'approved' : 'rejected' }
      : { ...p, answer_status: approve ? 'approved' : 'rejected' }));
    const { error } = await supabase.rpc('poi_review', { p_id: id, p_stage: stage, p_approve: approve });
    if (error) flash('That POI changed before your review landed. Refreshed.', true);
    load();
  };

  const me = profile?.id;
  const inbox  = useMemo(() => pois.filter(p => p.to_user === me && p.question_status === 'approved'), [pois, me]);
  const sent   = useMemo(() => pois.filter(p => p.from_user === me), [pois, me]);
  const queue  = useMemo(() => pois.filter(p => p.question_status === 'pending' || p.answer_status === 'pending')
                                   .sort((a, b) => +new Date(a.updated_at) - +new Date(b.updated_at)), [pois]);
  const needsAnswer = inbox.filter(p => !p.answer_status || p.answer_status === 'rejected').length;

  const tabs = isChair
    ? [{ id: 'review', label: 'To review', count: queue.length }, { id: 'all', label: 'All POIs', count: pois.length }]
    : [{ id: 'inbox', label: 'Received', count: needsAnswer }, { id: 'sent', label: 'Sent', count: 0 }];

  const list = isChair ? (tab === 'review' ? queue : pois) : (tab === 'inbox' ? inbox : sent);

  return (
    <div className="container poi">
      <style>{CSS}</style>

      <header className="page-head">
        <div>
          <p className="page-head__eyebrow">{profile?.committee || '…'} · Points of Information</p>
          <h1 className="page-head__title">POIs</h1>
          <p className="page-head__sub">
            {isChair
              ? 'Approve or decline questions and answers before delegates see them.'
              : 'Ask another delegate a question. Your chair approves it, and approves their answer.'}
          </p>
        </div>
      </header>

      {notice && <div className={`poi-notice${notice.error ? ' is-error' : ''}`} role="status">{notice.text}</div>}

      <div className={isChair ? 'poi-grid poi-grid--chair' : 'poi-grid'}>
        {!isChair && (
          <section className="poi-card poi-compose" aria-label="New POI">
            <label className="poi-to">
              <span>To</span>
              <select value={to} onChange={e => setTo(e.target.value)} aria-label="Delegation">
                <option value="">Choose a delegation</option>
                {delegates.map(d => <option key={d.id} value={d.id}>{d.delegation || 'Delegate'}</option>)}
              </select>
            </label>
            <textarea className="poi-body" rows={6} maxLength={1000} value={question}
              placeholder="Write your point of information…"
              aria-label="Question"
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }} />
            <div className="poi-compose__foot">
              <span>Your chair approves it before it’s delivered · {question.length}/1000</span>
              <button className="primary-btn" disabled={!to || !question.trim() || sending} onClick={send}>
                {sending ? 'Sending…' : 'Send to chair'}
              </button>
            </div>
          </section>
        )}

        <section className="poi-card poi-list">
          <div className="poi-tabs" role="tablist">
            {tabs.map(t => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className="poi-tab" onClick={() => setTab(t.id as any)}>
                {t.label}{t.count > 0 && <span className="poi-tab__count">{t.count}</span>}
              </button>
            ))}
          </div>

          {!loaded && <p className="poi-empty">Loading…</p>}
          {loaded && list.length === 0 && (
            <div className="poi-empty">
              <strong>{isChair ? (tab === 'review' ? 'All caught up' : 'No POIs yet') : tab === 'inbox' ? 'No questions for you' : 'Nothing sent yet'}</strong>
              {isChair ? 'New questions and answers appear here as delegates send them.' : tab === 'inbox' ? 'Approved questions to your delegation appear here.' : 'POIs you send appear here with their progress.'}
            </div>
          )}

          <ul className="poi-items">
            {list.map(p => (
              <PoiItem key={p.id} p={p}
                viewer={isChair ? 'chair' : p.to_user === me ? 'recipient' : 'asker'}
                onAnswer={answer} onReview={review} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function PoiItem({ p, viewer, onAnswer, onReview }: {
  p: Poi; viewer: 'asker' | 'recipient' | 'chair';
  onAnswer: (id: number, text: string) => void;
  onReview: (id: number, stage: 'question' | 'answer', approve: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const stage = stageOf(p, viewer);
  const canAnswer = viewer === 'recipient' && p.question_status === 'approved' && (!p.answer_status || p.answer_status === 'rejected');
  const showAnswer = p.answer && (viewer !== 'asker' || p.answer_status === 'approved');

  return (
    <li className="poi-item">
      <div className="poi-item__head">
        <span className="poi-item__route">
          <strong>{nameOf(p.asker)}</strong>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="to"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          <strong>{nameOf(p.recipient)}</strong>
        </span>
        <span className={`poi-chip poi-chip--${stage.tone}`}>{stage.label}</span>
      </div>

      <p className="poi-item__q">{p.question}</p>

      {showAnswer && (
        <div className="poi-item__a">
          <span>{nameOf(p.recipient)} answered</span>
          <p>{p.answer}</p>
        </div>
      )}

      {viewer === 'chair' && p.question_status === 'pending' && (
        <div className="poi-actions">
          <button className="primary-btn" onClick={() => onReview(p.id, 'question', true)}>Approve question</button>
          <button className="poi-ghost" onClick={() => onReview(p.id, 'question', false)}>Decline</button>
        </div>
      )}
      {viewer === 'chair' && p.answer_status === 'pending' && (
        <div className="poi-actions">
          <button className="primary-btn" onClick={() => onReview(p.id, 'answer', true)}>Approve answer</button>
          <button className="poi-ghost" onClick={() => onReview(p.id, 'answer', false)}>Decline</button>
        </div>
      )}

      {canAnswer && (
        <div className="poi-answer">
          <textarea className="dark-input" rows={3} maxLength={1000} value={draft}
            placeholder="Your answer…" onChange={e => setDraft(e.target.value)} />
          <button className="primary-btn" disabled={!draft.trim()} onClick={() => { onAnswer(p.id, draft); setDraft(''); }}>Send answer</button>
        </div>
      )}

      <span className="poi-item__time">{timeAgo(p.created_at)}</span>
    </li>
  );
}

const CSS = `
  .poi-grid { display:flex; flex-direction:column; gap:20px; }
  .poi-card { border:1px solid var(--border); background:var(--bg-surface); border-radius:16px; min-width:0; }
  .poi-compose { display:flex; flex-direction:column; overflow:hidden; }
  .poi-to { display:flex; align-items:center; gap:12px; padding:4px 20px; border-bottom:1px solid var(--border); }
  .poi-to > span { font-size:14px; color:var(--text-muted); flex-shrink:0; }
  .poi-to select { flex:1; margin:0; min-height:48px; border:0 !important; background-color:transparent !important; padding:0 32px 0 0; font-size:15px; box-shadow:none !important; appearance:none; cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23858d88' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 4px center; }
  .poi-body { margin:0; border:0 !important; background:transparent !important; box-shadow:none !important; padding:16px 20px; min-height:180px; font-size:15.5px; line-height:1.6; resize:vertical; }
  .poi-to select:focus-visible, .poi-body:focus-visible { outline:none; }
  .poi-compose:focus-within { border-color:var(--accent-border); }
  .poi-field textarea { resize:vertical; min-height:120px; line-height:1.5; }
  .poi-compose__foot { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px 12px 20px; border-top:1px solid var(--border); }
  .poi-compose__foot > span { font-size:12.5px; color:var(--text-muted); }

  .poi-tabs { display:flex; gap:4px; padding:10px 10px 0; border-bottom:1px solid var(--border); }
  .poi-tab { display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border:0; background:none; font-size:13.5px; color:var(--text-muted); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
  .poi-tab[aria-selected="true"] { color:var(--text-primary); border-bottom-color:var(--green); }
  .poi-tab__count { font-family:var(--mono); font-size:10.5px; padding:1px 7px; border-radius:99px; background:var(--green); color:#fff; }

  .poi-items { list-style:none; margin:0; padding:0; }
  .poi-item { position:relative; padding:18px 22px; border-bottom:1px solid var(--border); }
  .poi-item:last-child { border-bottom:0; }
  .poi-item__head { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
  .poi-item__route { display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--text-muted); }
  .poi-item__route strong { color:var(--text-primary); font-weight:500; }
  .poi-item__q { font-size:15px; line-height:1.55; color:var(--text-primary); white-space:pre-wrap; word-break:break-word; }
  .poi-item__a { margin-top:12px; padding:12px 14px; border-radius:10px; background:rgba(var(--tint),0.04); border-left:2px solid var(--green); }
  .poi-item__a span { display:block; font-size:11.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted); margin-bottom:4px; }
  .poi-item__a p { font-size:14px; line-height:1.55; color:var(--text-secondary); white-space:pre-wrap; word-break:break-word; }
  .poi-item__time { display:block; margin-top:10px; font-family:var(--mono); font-size:11px; color:var(--text-muted); }

  .poi-chip { font-size:11px; font-weight:500; padding:3px 10px; border-radius:99px; white-space:nowrap; }
  .poi-chip--wait { background:rgba(var(--tint),0.06); color:var(--text-muted); }
  .poi-chip--act  { background:var(--green); color:#fff; }
  .poi-chip--ok   { background:var(--accent-soft); color:var(--green-2); }
  .poi-chip--no   { background:rgba(239,68,68,0.12); color:#EF4444; }

  .poi-actions, .poi-answer { display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; align-items:flex-start; }
  .poi-answer textarea { flex:1 1 260px; margin:0; resize:vertical; }
  .poi-actions .primary-btn, .poi-answer .primary-btn { height:40px; font-size:13.5px; }


  @media (max-width: 1100px) {
    .poi-compose__foot > span { font-size:11.5px; }
    .poi-item { padding:16px; }
  }
`;
