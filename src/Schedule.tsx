// Schedule.tsx — SODMUN V programme. Edit DAYS below to publish timings;
// a day with no sessions shows "Timings coming soon".

export const VENUE = 'Ambassador International Academy, Mankhool';

export type Session = { time: string; title: string; place?: string };
export const DAYS: { date: string; label: string; sessions: Session[] }[] = [
  { date: '2026-12-11', label: 'Day 1', sessions: [] },
  { date: '2026-12-12', label: 'Day 2', sessions: [] },
  { date: '2026-12-13', label: 'Day 3', sessions: [] },
];

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00+04:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });
const todayDubai = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });

export default function Schedule() {
  return (
    <div className="container sch">
      <style>{CSS}</style>
      <header className="page-head">
        <div>
          <p className="page-head__eyebrow">SODMUN V · 11–13 December 2026</p>
          <h1 className="page-head__title">Schedule</h1>
          <p className="page-head__sub">{VENUE}, Dubai. All times are Gulf Standard Time.</p>
        </div>
      </header>

      <div className="sch-days">
        {DAYS.map(d => (
          <section key={d.date} className={`sch-day${d.date === todayDubai ? ' is-today' : ''}`}>
            <div className="sch-day__head">
              <span className="sch-day__label">{d.label}{d.date === todayDubai && <em>Today</em>}</span>
              <h2 className="sch-day__date">{fmtDay(d.date)}</h2>
            </div>
            {d.sessions.length === 0 ? (
              <p className="sch-empty">Timings coming soon.</p>
            ) : (
              <ol className="sch-list">
                {d.sessions.map((s, i) => (
                  <li key={i}>
                    <span className="sch-time">{s.time}</span>
                    <span className="sch-what"><strong>{s.title}</strong>{s.place && <span>{s.place}</span>}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

const CSS = `
  .sch-days { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
  .sch-day { border:1px solid var(--border); background:var(--bg-surface); border-radius:16px; overflow:hidden; }
  .sch-day.is-today { border-color:var(--accent-border); }
  .sch-day__head { padding:20px 22px; border-bottom:1px solid var(--border); }
  .sch-day__label { display:flex; align-items:center; gap:8px; font-size:11.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--green-mint); }
  .sch-day__label em { font-style:normal; font-size:10.5px; padding:2px 8px; border-radius:99px; background:var(--green); color:#fff; letter-spacing:.04em; }
  .sch-day__date { font-size:30px; margin-top:10px; color:var(--text-primary); }
  .sch-empty { padding:24px 22px; color:var(--text-muted); font-size:14px; }
  .sch-list { list-style:none; margin:0; padding:6px 0; }
  .sch-list li { display:grid; grid-template-columns:72px 1fr; gap:14px; padding:12px 22px; }
  .sch-list li + li { border-top:1px solid var(--border); }
  .sch-time { font-family:var(--mono); font-size:12.5px; color:var(--text-muted); padding-top:1px; }
  .sch-what { display:flex; flex-direction:column; gap:2px; }
  .sch-what strong { font-size:14px; font-weight:500; color:var(--text-primary); }
  .sch-what span { font-size:12.5px; color:var(--text-muted); }
`;
