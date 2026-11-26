// Dashboard.tsx — one glance at the portal: what needs you, latest news,
// recent committee chat, your resolutions and the conference schedule.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { DAYS, VENUE } from './Schedule';
import DelegateAccess from './DelegateAccess';

const ANNOUNCEMENTS_ROOM = '__announcements__';
const START = new Date('2026-12-11T08:00:00+04:00');

const strip = (html: string) => (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const ago = (ts?: string) => {
  if (!ts) return '';
  const d = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z');
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
const who = (u: any) => u?.role === 'Delegate' ? (u?.delegation || 'Delegate') : (u?.role || 'Someone');

const Arrow = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [pois, setPois] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [chat, setChat] = useState<any[]>([]);
  const [uploads, setUploads] = useState<number | null>(null);

  const isChair = !!profile && profile.role !== 'Delegate';

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data));
  }, [user?.id]);

  useEffect(() => {
    if (!profile?.committee) return;
    const load = async () => {
      const [poiRes, newsRes, chatRes, upRes] = await Promise.all([
        supabase.rpc('poi_feed'),
        supabase.from('messages').select('id, content, timestamp, users(delegation, role)')
          .eq('recipient_group', ANNOUNCEMENTS_ROOM).order('timestamp', { ascending: false }).limit(3),
        supabase.from('messages').select('id, content, timestamp, sender_id, users(delegation, role)')
          .eq('recipient_group', profile.committee).order('timestamp', { ascending: false }).limit(5),
        supabase.from('resolution_uploads').select('id', { count: 'exact', head: true }).eq('committee', profile.committee),
      ]);
      setPois((poiRes.data as any[]) || []);
      setNews(newsRes.data || []);
      setChat((chatRes.data || []).slice().reverse());
      setUploads(upRes.count ?? 0);
    };
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 20000);
    return () => clearInterval(t);
  }, [profile?.committee]);

  // What needs this person
  const me = profile?.id;
  const toReview = pois.filter(p => p.question_status === 'pending' || p.answer_status === 'pending').length;
  const toAnswer = pois.filter(p => p.to_user === me && p.question_status === 'approved' && (!p.answer_status || p.answer_status === 'rejected')).length;
  const answered = pois.filter(p => p.from_user === me && p.answer_status === 'approved').length;
  const waiting  = pois.filter(p => p.from_user === me && (p.question_status === 'pending' || p.answer_status === 'pending')).length;

  const hour = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Dubai' }));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const today = DAYS.find(d => d.date === todayIso);
  const daysLeft = Math.ceil((START.getTime() - Date.now()) / 86400000);

  const tiles = isChair
    ? [
        { label: 'To review', value: toReview, hint: toReview ? 'POIs waiting for you' : 'All caught up', to: '/pois', hot: toReview > 0 },
        { label: 'Resolutions', value: uploads ?? '–', hint: 'Uploaded in committee', to: '/resolutions' },
        { label: 'POIs today', value: pois.filter(p => new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }) === todayIso).length, hint: 'Sent in your committee', to: '/pois' },
      ]
    : [
        { label: 'To answer', value: toAnswer, hint: toAnswer ? 'POIs addressed to you' : 'Nothing waiting', to: '/pois', hot: toAnswer > 0 },
        { label: 'Answered', value: answered, hint: waiting ? `${waiting} still with the chair` : 'Your POIs with replies', to: '/pois' },
        { label: 'Your uploads', value: uploads ?? '–', hint: 'Resolutions sent to the chair', to: '/resolutions' },
      ];

  return (
    <div className="container db">
      <style>{CSS}</style>

      <header className="db-hero">
        <div>
          <p className="page-head__eyebrow">{greeting} · {profile?.role || '…'}{profile?.committee ? ` · ${profile.committee}` : ''}</p>
          <h1 className="db-title">{profile?.delegation || profile?.role || ' '}</h1>
          <p className="page-head__sub">
            {daysLeft > 0 ? `SODMUN V starts in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${VENUE}` : today ? `${today.label} of SODMUN V · ${VENUE}` : `SODMUN V · ${VENUE}`}
          </p>
        </div>
        <div className="db-actions">
          <button className="primary-btn" onClick={() => navigate('/chat')}>Open chat <Arrow /></button>
          <button className="db-ghost" onClick={() => navigate('/pois')}>{isChair ? 'Review POIs' : 'Send a POI'}</button>
        </div>
      </header>

      <section className="db-tiles">
        {tiles.map(t => (
          <button key={t.label} className={`db-tile${t.hot ? ' is-hot' : ''}`} onClick={() => navigate(t.to)}>
            <span className="db-tile__label">{t.label}<Arrow /></span>
            <span className="db-tile__value">{t.value}</span>
            <span className="db-tile__hint">{t.hint}</span>
          </button>
        ))}
      </section>

      <section className="db-grid">
        <div className="db-card">
          <div className="db-card__head">
            <h2>Committee chat</h2>
            <button className="db-link" onClick={() => navigate('/chat')}>Open <Arrow /></button>
          </div>
          {chat.length === 0 && <p className="db-empty">No messages yet.</p>}
          <ul className="db-chat">
            {chat.map(m => (
              <li key={m.id} className={m.sender_id === me ? 'me' : ''} onClick={() => navigate('/chat')}>
                {m.sender_id !== me && <strong>{who(m.users)}</strong>}
                <span>{m.content}</span>
                <time>{ago(m.timestamp)}</time>
              </li>
            ))}
          </ul>
        </div>

        <div className="db-side">
          {isChair && profile?.committee && <DelegateAccess committee={profile.committee} />}
          <div className="db-card">
            <div className="db-card__head">
              <h2>Announcements</h2>
              <button className="db-link" onClick={() => navigate('/announcements')}>All <Arrow /></button>
            </div>
            {news.length === 0 && <p className="db-empty">No announcements yet.</p>}
            {news.map(n => (
              <button key={n.id} className="db-news" onClick={() => navigate('/announcements')}>
                <span className="db-news__meta">{who(n.users)} · {ago(n.timestamp)}</span>
                <span className="db-news__text">{strip(n.content) || 'Photo announcement'}</span>
              </button>
            ))}
          </div>

          <div className="db-card">
            <div className="db-card__head">
              <h2>{today ? `Today · ${today.label}` : 'Schedule'}</h2>
              <button className="db-link" onClick={() => navigate('/schedule')}>Full <Arrow /></button>
            </div>
            {today && today.sessions.length > 0 ? (
              <ul className="db-sched">
                {today.sessions.slice(0, 4).map((s, i) => <li key={i}><time>{s.time}</time><span>{s.title}</span></li>)}
              </ul>
            ) : (
              <p className="db-empty">{daysLeft > 0 ? `11–13 December. Timings are published closer to the conference.` : 'Timings coming soon.'}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const CSS = `
  .db { display:flex; flex-direction:column; gap:24px; }
  .db-hero { display:flex; justify-content:space-between; align-items:flex-end; gap:20px; flex-wrap:wrap; padding-bottom:24px; border-bottom:1px solid var(--border); }
  .db-title { font-size:clamp(46px, 7vw, 96px); line-height:.92; margin:12px 0 10px; color:var(--text-primary); }
  .db-actions { display:flex; gap:10px; flex-wrap:wrap; }
  .db-ghost { height:44px; padding:0 20px; border-radius:99px; border:0; background:transparent; box-shadow:inset 0 0 0 1px var(--border-strong); color:var(--text-primary); font-size:14px; font-weight:500; cursor:pointer; }
  .db-ghost:hover { background:var(--ink); color:var(--bg); box-shadow:none; }

  .db-tiles { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
  .db-tile { text-align:left; padding:18px 20px 20px; border-radius:16px; border:1px solid var(--border); background:var(--bg-surface); cursor:pointer; display:flex; flex-direction:column; transition:border-color .3s, transform .4s var(--ease-out); }
  .db-tile:hover { border-color:var(--accent-border); transform:translateY(-2px); }
  .db-tile.is-hot { border-color:var(--accent-border); background:linear-gradient(135deg, var(--accent-soft), transparent 70%), var(--bg-surface); }
  .db-tile__label { display:flex; justify-content:space-between; align-items:center; font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-muted); }
  .db-tile__label svg { opacity:0; transition:opacity .3s; color:var(--green-2); }
  .db-tile:hover .db-tile__label svg { opacity:1; }
  .db-tile__value { font-family:var(--display); font-size:56px; line-height:1; margin:16px 0 6px; color:var(--text-primary); }
  .db-tile.is-hot .db-tile__value { color:var(--green-2); }
  .db-tile__hint { font-size:13px; color:var(--text-muted); }

  .db-grid { display:grid; grid-template-columns:minmax(0, 1.4fr) minmax(0, 1fr); gap:16px; align-items:start; }
  .db-side { display:flex; flex-direction:column; gap:16px; min-width:0; }
  .db-card { border:1px solid var(--border); background:var(--bg-surface); border-radius:16px; overflow:hidden; min-width:0; }
  .db-card__head { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--border); }
  .db-card__head h2 { font-family:var(--sans) !important; font-size:14.5px; font-weight:500 !important; letter-spacing:0 !important; color:var(--text-primary); }
  .db-link { display:inline-flex; align-items:center; gap:6px; border:0; background:none; padding:0; font-size:12.5px; color:var(--text-muted); cursor:pointer; }
  .db-link:hover { color:var(--text-primary); }
  .db-empty { padding:22px 20px; font-size:13.5px; color:var(--text-muted); }

  .db-chat { list-style:none; margin:0; padding:14px 16px; display:flex; flex-direction:column; gap:6px; background-image:radial-gradient(rgba(var(--tint),0.05) 1px, transparent 1px); background-size:18px 18px; }
  .db-chat li { align-self:flex-start; max-width:85%; padding:7px 10px; border-radius:10px; background:var(--bg-2); box-shadow:0 1px 0.5px rgba(0,0,0,0.13); font-size:13.5px; line-height:1.4; cursor:pointer; display:flex; flex-direction:column; }
  .db-chat li.me { align-self:flex-end; background:color-mix(in srgb, var(--green) 30%, var(--bg-2)); }
  .db-chat strong { font-size:12px; font-weight:600; color:var(--green-2); }
  .db-chat span { color:var(--text-primary); word-break:break-word; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .db-chat time { align-self:flex-end; font-size:10.5px; color:var(--text-muted); margin-top:2px; }

  .db-news { display:flex; flex-direction:column; gap:4px; width:100%; text-align:left; padding:14px 20px; border:0; border-bottom:1px solid var(--border); background:transparent; cursor:pointer; color:var(--text-primary); }
  .db-news:last-child { border-bottom:0; }
  .db-news:hover { background:rgba(var(--tint),0.03); }
  .db-news__meta { font-size:11.5px; color:var(--text-muted); }
  .db-news__text { font-size:14px; line-height:1.45; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .db-sched { list-style:none; margin:0; padding:6px 0; }
  .db-sched li { display:grid; grid-template-columns:64px 1fr; gap:12px; padding:10px 20px; font-size:13.5px; }
  .db-sched time { font-family:var(--mono); font-size:12px; color:var(--text-muted); }

  @media (max-width: 1000px) { .db-grid { grid-template-columns:1fr; } }
  @media (max-width: 768px) {
    .db-tiles { grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
    .db-tile:last-child { grid-column:span 2; }
    .db-tile { padding:14px 16px 16px; }
    .db-tile__value { font-size:42px; margin:10px 0 4px; }
    .db-actions { width:100%; }
    .db-actions > button { flex:1; justify-content:center; }
  }
`;
