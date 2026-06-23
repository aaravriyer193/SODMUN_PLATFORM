import React from 'react';
import scheduleImg from './assets/schedule.png';

export default function Schedule() {
  return (
    <div style={{ padding: '48px 40px', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '36px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--accent)', marginBottom: '6px' }}>
          SODMUN · June 26–28
        </p>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-1px', color: 'var(--text-primary)', lineHeight: 1 }}>
          Conference Schedule
        </h1>
      </div>

      <div style={{ maxWidth: '860px' }}>
        <div style={{ background: 'var(--bg-surface)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: 'var(--glass-border)', borderRadius: '20px', padding: '24px', boxShadow: 'var(--shadow-md)' }}>
          <img
            src={scheduleImg}
            alt="SODMUN Conference Schedule"
            style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block', boxShadow: 'var(--shadow-sm)' }}
          />
        </div>

        <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'center' }}>
          All times are Dubai Standard Time.
        </p>
      </div>
    </div>
  );
}