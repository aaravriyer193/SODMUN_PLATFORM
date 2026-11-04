// AuthLayout.tsx — split screen for sign-in / invite / password pages.
// Left: the form. Right: a conference photo from sodmun.com.

import React from 'react';
import committeeRoom from '../assets/photos/committee-room.jpg';
import atrium from '../assets/photos/atrium.jpg';

const PHOTOS = { committee: committeeRoom, atrium } as const;

export default function AuthLayout({ children, photo = 'committee' }: { children: React.ReactNode; photo?: keyof typeof PHOTOS }) {
  return (
    <div className="al">
      <style>{`
        .al { min-height:100vh; width:100%; display:grid; grid-template-columns:minmax(380px, 1fr) 1.15fr; background:var(--bg); }
        .al-form { display:flex; flex-direction:column; padding:32px clamp(24px, 5vw, 72px); }
        .al-form__body { flex:1; display:flex; flex-direction:column; justify-content:center; width:100%; max-width:400px; margin:0 auto; padding:48px 0; text-align:left; align-items:stretch; }
        .al-form__foot { display:flex; justify-content:space-between; gap:16px; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted); }
        .al-form__foot a { color:inherit; text-decoration:none; }
        .al-form__foot a:hover { color:var(--text-primary); }

        .al-photo { position:relative; margin:12px 12px 12px 0; border-radius:20px; overflow:hidden; background:var(--bg-2); }
        .al-photo img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:grayscale(1) contrast(1.05); transform:scale(1.04); animation:al-photo 1.6s var(--ease-out) forwards; }
        .al-photo::after { content:''; position:absolute; inset:0; background:
            linear-gradient(180deg, rgba(5,6,5,0) 55%, rgba(5,6,5,0.55) 100%),
            linear-gradient(120deg, rgba(13,74,40,0.35), rgba(5,6,5,0) 60%); }
        @keyframes al-photo { to { transform:none; } }

        @media (max-width: 920px) {
          .al { grid-template-columns:1fr; }
          .al-photo { display:none; }
        }
      `}</style>

      <section className="al-form">
        <a href="https://sodmun.com" className="brand" aria-label="SODMUN website"><span className="brand__mark" aria-hidden="true" />SODMUN</a>
        <div className="al-form__body">{children}</div>
        <div className="al-form__foot">
          <span>© {new Date().getFullYear()} SODMUN · Dubai</span>
          <a href="mailto:sg.sodmun@gmail.com">Need help?</a>
        </div>
      </section>

      <div className="al-photo" aria-hidden="true">
        <img src={PHOTOS[photo]} alt="" />
      </div>
    </div>
  );
}
