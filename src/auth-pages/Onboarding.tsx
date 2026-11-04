// Onboarding.tsx — /welcome
// Shown automatically after first login (onboarded = false).
// Full-screen, 4 steps, cannot skip.
// On complete: sets onboarded = true, redirects to dashboard.

import React, { useState } from 'react';
import { supabase } from '../api';
import { useAuth } from '../AuthContext';
import AuthLayout from './AuthLayout';

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
    title: <>Welcome to <span style={{ color:'var(--accent)' }}>SODMUN</span></>,
    body:  'This is your committee platform. Everything you need — communications, blocs, resolutions — is right here. This will take about 60 seconds.',
    cta:   'Get started',
    visual: <PlatformVisual />,
  },
  {
    tag:   '02 — Communications',
    title: <>Chat with your <span style={{ color:'var(--accent)' }}>committee</span></>,
    body:  'The Communications tab is your main hub. You can message the global committee, join or create a private bloc group chat, and send direct messages to any delegate. Chairs can read everything.',
    cta:   'Got it',
    visual: <ChatVisual />,
  },
  {
    tag:   '03 — Blocs',
    title: <>Form a <span style={{ color:'var(--accent)' }}>bloc</span></>,
    body:  'Coordinate privately with allied delegations. Go to Chat → New Bloc Group Chat, name it, and add your allies. Draft your working paper together from there.',
    cta:   'Understood',
    visual: <BlocVisual />,
  },
  {
    tag:   '04 — Ready',
    title: <>You\'re all <span style={{ color:'var(--accent)' }}>set</span></>,
    body:  'If you ever forget your password, use "Forgot password?" on the sign-in page — you\'ll get a reset link by email. Good luck in committee.',
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

  const finish = async () => {
    setFinishing(true);
    if (user) {
      await supabase.from('users').update({ onboarded: true }).eq('id', user.id);
    }
    window.location.href = '/';
  };

  const advance = async () => {
    if (isLast) return finish();
    setLeaving(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setLeaving(false);
    }, 300);
  };

  const back = () => { if (step > 0 && !leaving) setStep(s => s - 1); };

  return (
    <AuthLayout photo="atrium">
      <style>{`
        @keyframes slideIn  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
        @keyframes slideOut { from { opacity:1; transform:none; } to { opacity:0; transform:translateY(-14px); } }
        .step-content { animation: slideIn .5s var(--ease-out) both; }
        .step-content.leaving { animation: slideOut .3s var(--ease) both; }
        .ob-skip { background:none; border:0; padding:0; font-size:13px; color:var(--text-muted); cursor:pointer; }
        .ob-skip:hover { color:var(--text-primary); }
      `}</style>

      {/* Progress */}
      <div style={styles.progressWrap} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            ...styles.progressDot,
            background: i <= step ? 'var(--accent)' : 'rgba(var(--tint),0.12)',
            width: i === step ? 28 : 8,
          }} />
        ))}
        <span style={styles.counter}>{step + 1} / {STEPS.length}</span>
      </div>

      <div className={`step-content${leaving?' leaving':''}`} key={step}>
        <div style={styles.tag}>{current.tag}</div>
        <h1 style={styles.title}>{current.title}</h1>
        <p style={styles.body}>{current.body}</p>
        <div style={styles.visual}>{current.visual}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:8 }}>
        {step > 0 && (
          <button type="button" onClick={back} style={styles.btnGhost}>Back</button>
        )}
        <button
          onClick={advance}
          disabled={finishing}
          style={{ ...styles.btn, opacity: finishing ? 0.6 : 1 }}
        >
          {finishing ? 'Loading…' : current.cta}
          {!isLast && <span style={{ marginLeft: 8 }}>→</span>}
        </button>
        {!isLast && (
          <button type="button" className="ob-skip" onClick={finish} disabled={finishing} style={{ marginLeft:'auto' }}>Skip intro</button>
        )}
      </div>
    </AuthLayout>
  );
}

// ── Mini visuals ─────────────────────────────────────────────────────────────

function PlatformVisual() {
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'center' }}>
      {['Dashboard','Chat','Resolutions','AI'].map(label => (
        <div key={label} style={{
          background:'rgba(34,164,87,0.08)', border:'1px solid rgba(34,164,87,0.20)',
          borderRadius:10, padding:'10px 16px',
          fontSize:12, fontWeight:500, color:'var(--accent)', letterSpacing:'0.3px',
        }}>{label}</div>
      ))}
    </div>
  );
}

function ChatVisual() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:320 }}>
      {[
        { label:'Global Committee', icon:'', active:true },
        { label:'Bloc Group Chats', icon:'', active:false },
        { label:'Direct Messages',  icon:'', active:false },
      ].map(r => (
        <div key={r.label} style={{
          display:'flex', alignItems:'center', gap:10,
          background: r.active ? 'rgba(34,164,87,0.10)' : 'rgba(var(--tint),0.04)',
          border: `1px solid ${r.active ? 'rgba(34,164,87,0.25)' : 'rgba(var(--tint),0.08)'}`,
          borderRadius:10, padding:'10px 14px',
          fontSize:13, fontWeight:500,
          color: r.active ? 'var(--accent-2)' : 'var(--text-muted)',
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
        background:'rgba(34,164,87,0.08)', border:'1.5px dashed rgba(34,164,87,0.30)',
        borderRadius:12, padding:'14px 18px', textAlign:'center',
      }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--accent)', letterSpacing:'0.5px', marginBottom:6 }}>+ New Bloc Group Chat</div>
        <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500 }}>Name it · Add allies · Start coordinating</div>
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
    background:'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
    display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    fontFamily:'var(--sans)', padding:'40px 20px',
    position:'relative',
  },
  progressWrap: {
    display:'flex', alignItems:'center', gap:6,
    marginBottom:40,
  },
  progressDot: {
    height:8, borderRadius:99,
    transition:'all 0.3s cubic-bezier(0.4,0,0.2,1)',
  },
  card: {
    background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:24,
    padding:'48px 44px', width:'100%', maxWidth:480,
    boxShadow:'var(--shadow-lg)',
    display:'flex', flexDirection:'column', alignItems:'center',
    textAlign:'center',
  },
  visual: {
    marginBottom:36,
    display:'flex', alignItems:'flex-start', justifyContent:'flex-start',
    width:'100%',
  },
  tag: {
    fontSize:11.5, fontWeight:400,
    letterSpacing:'0.08em', textTransform:'uppercase',
    color:'var(--green-mint)', marginBottom:16,
  },
  bar: {
    width:32, height:3, background:'var(--accent)',
    borderRadius:99, marginBottom:20,
  },
  title: {
    fontSize:52, fontWeight:400, color:'var(--text-primary)',
    letterSpacing:'-0.5px', lineHeight:1.2,
    marginBottom:14,
  },
  body: {
    fontSize:15, color:'var(--text-muted)',
    fontWeight:400, lineHeight:1.6,
    marginBottom:28, maxWidth:'40ch',
  },
  btn: {
    height:50, padding:'0 32px',
    background:'var(--accent)', color:'#fff',
    border:'none', borderRadius:99,
    fontSize:14, fontWeight:500,
    fontFamily:'var(--sans)',
    cursor:'pointer',
    transition:'all 0.15s',
    display:'flex', alignItems:'center',
  },
  counter: {
    fontFamily:'var(--mono)', fontSize:11, color:'var(--text-muted)',
    marginLeft:10,
  },
  btnGhost: {
    height:50, padding:'0 22px', borderRadius:99, border:0,
    background:'transparent', boxShadow:'inset 0 0 0 1px var(--border-strong)',
    color:'var(--text-primary)', fontSize:14, fontWeight:500, cursor:'pointer',
  },
};