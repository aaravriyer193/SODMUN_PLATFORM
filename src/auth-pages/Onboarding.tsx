// Onboarding.tsx — /welcome
// Shown automatically after first login (onboarded = false).
// Full-screen, 4 steps, cannot skip.
// On complete: sets onboarded = true, redirects to dashboard.

import React, { useState } from 'react';
import { supabase } from '../api';
import { useAuth } from '../AuthContext';

interface Step {
  tag:   string;
  title: React.ReactNode;
  body:  string;
  cta:   string;
  visual: React.ReactNode;
}

const STEPS: Step[] = [
  {
    tag:   '01 — Welcome',
    title: <>Welcome to <span style={{ color:'#F07C00' }}>SODMUN</span></>,
    body:  'This is your committee platform. Everything you need — communications, blocs, resolutions — is right here. This will take about 60 seconds.',
    cta:   'Get started',
    visual: <PlatformVisual />,
  },
  {
    tag:   '02 — Communications',
    title: <>Chat with your <span style={{ color:'#F07C00' }}>committee</span></>,
    body:  'The Communications tab is your main hub. You can message the global committee, join or create a private bloc group chat, and send direct messages to any delegate. Chairs can read everything.',
    cta:   'Got it',
    visual: <ChatVisual />,
  },
  {
    tag:   '03 — Blocs',
    title: <>Form a <span style={{ color:'#F07C00' }}>bloc</span></>,
    body:  'Coordinate privately with allied delegations. Go to Chat → New Bloc Group Chat, name it, and add your allies. Draft your working paper together from there.',
    cta:   'Understood',
    visual: <BlocVisual />,
  },
  {
    tag:   '04 — Ready',
    title: <>You\'re all <span style={{ color:'#F07C00' }}>set</span></>,
    body:  'If you ever forget your password, go to app.sodmun.com/forgot — you\'ll get a reset link by email. Good luck in committee.',
    cta:   'Enter the platform',
    visual: <ReadyVisual />,
  },
];

export default function Onboarding() {
  const { user } = useAuth();
  const [step, setStep]       = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const advance = async () => {
    if (isLast) {
      setFinishing(true);
      if (user) {
        await supabase.from('users').update({ onboarded: true }).eq('id', user.id);
      }
      window.location.href = '/';
      return;
    }
    setLeaving(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setLeaving(false);
    }, 300);
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=JetBrains+Mono:wght@700&display=swap');
        @keyframes slideIn  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideOut { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-20px); } }
        .step-content { animation: slideIn 0.35s cubic-bezier(0.4,0,0.2,1) both; }
        .step-content.leaving { animation: slideOut 0.3s cubic-bezier(0.4,0,0.2,1) both; }
      `}</style>

      {/* Progress bar */}
      <div style={styles.progressWrap}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            ...styles.progressDot,
            background: i <= step ? '#F07C00' : 'rgba(0,0,0,0.10)',
            width: i === step ? 24 : 8,
          }} />
        ))}
      </div>

      <div className={`step-content${leaving?' leaving':''}`} style={styles.card}>
        {/* Visual */}
        <div style={styles.visual}>{current.visual}</div>

        {/* Text */}
        <div style={styles.tag}>{current.tag}</div>
        <div style={styles.bar} />
        <h1 style={styles.title}>{current.title}</h1>
        <p style={styles.body}>{current.body}</p>

        {/* CTA */}
        <button
          onClick={advance}
          disabled={finishing}
          style={{ ...styles.btn, opacity: finishing ? 0.6 : 1 }}
        >
          {finishing ? 'Loading…' : current.cta}
          {!isLast && <span style={{ marginLeft: 8 }}>→</span>}
        </button>

        {/* Step counter */}
        <p style={styles.counter}>{step + 1} of {STEPS.length}</p>
      </div>
    </div>
  );
}

// ── Mini visuals ─────────────────────────────────────────────────────────────

function PlatformVisual() {
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'center' }}>
      {['Dashboard','Chat','Resolutions','AI'].map(label => (
        <div key={label} style={{
          background:'rgba(240,124,0,0.08)', border:'1px solid rgba(240,124,0,0.20)',
          borderRadius:10, padding:'10px 16px',
          fontSize:12, fontWeight:700, color:'#F07C00', letterSpacing:'0.3px',
        }}>{label}</div>
      ))}
    </div>
  );
}

function ChatVisual() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:320 }}>
      {[
        { label:'Global Committee', icon:'🌐', active:true },
        { label:'Bloc Group Chats', icon:'🔒', active:false },
        { label:'Direct Messages',  icon:'💬', active:false },
      ].map(r => (
        <div key={r.label} style={{
          display:'flex', alignItems:'center', gap:10,
          background: r.active ? 'rgba(240,124,0,0.10)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${r.active ? 'rgba(240,124,0,0.25)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius:10, padding:'10px 14px',
          fontSize:13, fontWeight:600,
          color: r.active ? '#E07000' : '#71717A',
        }}>
          <span style={{ fontSize:14 }}>{r.icon}</span>
          {r.label}
        </div>
      ))}
    </div>
  );
}

function BlocVisual() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:300 }}>
      <div style={{
        background:'rgba(240,124,0,0.08)', border:'1.5px dashed rgba(240,124,0,0.30)',
        borderRadius:12, padding:'14px 18px', textAlign:'center',
      }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#F07C00', letterSpacing:'0.5px', marginBottom:6 }}>+ New Bloc Group Chat</div>
        <div style={{ fontSize:11, color:'#A1A1AA', fontWeight:500 }}>Name it · Add allies · Start coordinating</div>
      </div>
    </div>
  );
}

function ReadyVisual() {
  return (
    <div style={{
      width:64, height:64, borderRadius:'50%',
      background:'rgba(34,197,94,0.10)',
      border:'2px solid rgba(34,197,94,0.30)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:28,
    }}>✓</div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:'100vh', width:'100vw',
    background:'linear-gradient(135deg, #F5F3EF 0%, #FEF3E6 100%)',
    display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    fontFamily:"'Manrope', sans-serif", padding:'40px 20px',
    position:'relative',
  },
  progressWrap: {
    display:'flex', alignItems:'center', gap:6,
    marginBottom:32, position:'relative', zIndex:10,
  },
  progressDot: {
    height:8, borderRadius:99,
    transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',
  },
  card: {
    background:'#fff', borderRadius:24,
    padding:'48px 44px', width:'100%', maxWidth:480,
    boxShadow:'0 12px 48px rgba(0,0,0,0.10)',
    display:'flex', flexDirection:'column', alignItems:'center',
    textAlign:'center',
  },
  visual: {
    marginBottom:32,
    display:'flex', alignItems:'center', justifyContent:'center',
    width:'100%',
  },
  tag: {
    fontSize:11, fontWeight:700,
    letterSpacing:'3px', textTransform:'uppercase',
    color:'#F07C00', marginBottom:12,
  },
  bar: {
    width:32, height:3, background:'#F07C00',
    borderRadius:99, marginBottom:20,
  },
  title: {
    fontSize:26, fontWeight:800, color:'#18181B',
    letterSpacing:'-0.5px', lineHeight:1.2,
    marginBottom:14,
  },
  body: {
    fontSize:14, color:'#71717A',
    fontWeight:400, lineHeight:1.7,
    marginBottom:32, maxWidth:380,
  },
  btn: {
    height:50, padding:'0 32px',
    background:'#F07C00', color:'#fff',
    border:'none', borderRadius:14,
    fontSize:14, fontWeight:700,
    fontFamily:"'Manrope', sans-serif",
    cursor:'pointer',
    boxShadow:'0 4px 16px rgba(240,124,0,0.30)',
    transition:'all 0.15s',
    display:'flex', alignItems:'center',
  },
  counter: {
    fontSize:11, color:'#C4C4C4',
    fontWeight:600, marginTop:20,
    letterSpacing:'0.5px',
  },
};