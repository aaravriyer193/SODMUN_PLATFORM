import React from 'react';
import scheduleImg from './assets/schedule.png';

export default function Schedule() {
  return (
    <div style={{ padding: '48px 40px', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '36px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#F07C00', marginBottom: '6px' }}>
          SODMUN · June 19–21
        </p>
        <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-1px', color: '#18181B', lineHeight: 1 }}>
          Conference Schedule
        </h1>
      </div>

      <div style={{ maxWidth: '860px' }}>
        <div style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.70)', borderRadius: '20px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.07)' }}>
          <img
            src={scheduleImg}
            alt="SODMUN Conference Schedule"
            style={{ width: '100%', height: 'auto', borderRadius: '12px', display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}
          />
        </div>

        <p style={{ marginTop: '16px', fontSize: '12px', color: '#A1A1AA', fontWeight: 500, textAlign: 'center' }}>
          All times are Dubai Standard Time (GMT+4). Schedule subject to change at Chair's discretion.
        </p>
      </div>
    </div>
  );
}