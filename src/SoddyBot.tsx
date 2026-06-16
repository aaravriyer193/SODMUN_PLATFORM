import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';
import { callSoddy } from './committeeApi';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

const IconRobot = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>;
const IconUser  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const IconSend  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;

const LIMIT = 50;

export default function SoddyBot() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Greetings Delegate. I am Soddy, your SODMUN Intelligence AI. How may I assist you with your directives today?' }
  ]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uses, setUses]         = useState<number | null>(null);
  const [isChair, setIsChair]   = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authUser)
      supabase.from('users').select('role, delegation, committee, soddy_uses').eq('id', authUser.id).single()
        .then(({ data }) => {
          if (data) {
            setProfile(data);
            setIsChair(data.role !== 'Delegate');
            setUses(data.soddy_uses ?? 0);
          }
        });
  }, [authUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const limitReached = !isChair && uses !== null && uses >= LIMIT;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping || limitReached) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    try {
      const result = await callSoddy(newHistory.filter(m => m.role !== 'system'));
      setMessages([...newHistory, { role: 'assistant', content: result.reply }]);
      if (result.uses !== null) setUses(result.uses);
    } catch (error: any) {
      if (error?.status === 429) {
        setMessages([...newHistory, { role: 'assistant', content: `You have reached your ${LIMIT} query limit for Soddy AI. Please contact your Chair if you need assistance.` }]);
        setUses(LIMIT);
      } else {
        setMessages([...newHistory, { role: 'assistant', content: `System Error: ${error.message || 'Could not connect to Soddy servers.'}` }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const remaining = isChair ? null : Math.max(0, LIMIT - (uses ?? 0));
  const usePct    = uses !== null ? Math.min(1, uses / LIMIT) : 0;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', padding:'32px 32px 24px', gap:'20px', boxSizing:'border-box' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        @keyframes pulse-dot { 0%,80%,100%{transform:scale(0.6);opacity:0.4;}40%{transform:scale(1);opacity:1;} }
        .soddy-shell { flex:1; display:flex; flex-direction:column; max-width:840px; margin:0 auto; width:100%; background:var(--bg-surface); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:20px; overflow:hidden; box-shadow:var(--shadow-md); min-height:0; }
        .soddy-header { padding:20px 28px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:14px; background:var(--bg-elevated); flex-shrink:0; }
        .soddy-messages { flex:1; padding:24px; overflow-y:auto; display:flex; flex-direction:column; gap:16px; background:var(--bg-base); }
        .soddy-input-bar { padding:14px 18px; border-top:1px solid var(--border); display:flex; gap:10px; align-items:center; background:var(--bg-elevated); flex-shrink:0; }
        .soddy-input { flex:1; background:var(--bg-input); border:1px solid var(--border-strong); color:var(--text-primary); padding:12px 16px; border-radius:12px; font-size:14px; font-family:Manrope,sans-serif; outline:none; transition:border-color 0.15s,box-shadow 0.15s; margin-bottom:0; }
        .soddy-input:focus { border-color:var(--accent)!important; box-shadow:0 0 0 3px rgba(240,124,0,0.12); }
        .soddy-input::placeholder { color:var(--text-muted); }
        .msg-user { background:var(--accent); color:#fff; padding:12px 16px; border-radius:14px 14px 4px 14px; font-size:14px; line-height:1.6; word-break:break-word; box-shadow:0 2px 8px rgba(240,124,0,0.20); }
        .msg-bot { background:var(--bg-elevated); color:var(--text-primary); padding:12px 16px; border-radius:14px 14px 14px 4px; font-size:14px; line-height:1.6; border:1px solid var(--border); box-shadow:var(--shadow-sm); word-break:break-word; }
        .av-user { width:30px;height:30px;border-radius:8px;background:var(--bg-elevated);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-secondary);flex-shrink:0; }
        .av-bot  { width:30px;height:30px;border-radius:8px;background:var(--accent-soft);border:1px solid var(--accent-mid);display:flex;align-items:center;justify-content:center;color:var(--accent);flex-shrink:0; }
        @media(max-width:768px){.soddy-messages{padding:16px;}.soddy-header{padding:14px 16px;}.soddy-input-bar{padding:10px 12px;}}
      `}</style>

      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
        <div>
          <h1 className="delegation-brand">Soddy AI</h1>
          <p style={{ color:'var(--accent)', fontWeight:600, fontSize:'12px', marginTop:'4px' }}>MUN Intelligence Assistant</p>
        </div>
        {/* Usage counter for delegates */}
        {!isChair && uses !== null && (
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:11, fontWeight:700, color: uses >= LIMIT ? '#DC2626' : 'var(--text-muted)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:4 }}>
              {uses >= LIMIT ? 'Limit reached' : `${remaining} queries left`}
            </p>
            <div style={{ width:120, height:4, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${usePct * 100}%`, background: usePct >= 1 ? '#DC2626' : usePct > 0.7 ? '#F59E0B' : 'var(--accent)', borderRadius:99, transition:'width 0.4s ease, background 0.3s' }} />
            </div>
          </div>
        )}
      </div>

      <div className="soddy-shell">
        {/* Header */}
        <div className="soddy-header">
          <div style={{ width:38, height:38, background:'var(--accent-soft)', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent)' }}>
            <IconRobot />
          </div>
          <div>
            <h2 style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', margin:0 }}>Soddy Assistant</h2>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: limitReached ? '#DC2626' : '#22C55E' }} />
              <span style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:500 }}>
                {limitReached ? 'Query limit reached' : profile ? 'Connected' : 'Loading…'}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="soddy-messages">
          {messages.map((msg, idx) => {
            if (msg.role === 'system') return null;
            const isUser = msg.role === 'user';
            return (
              <div key={idx} style={{ display:'flex', gap:12, maxWidth:'82%', alignSelf:isUser?'flex-end':'flex-start', flexDirection:isUser?'row-reverse':'row' }}>
                <div className={isUser ? 'av-user' : 'av-bot'}>{isUser ? <IconUser /> : <IconRobot />}</div>
                <div className={isUser ? 'msg-user' : 'msg-bot'}>{msg.content}</div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display:'flex', gap:12, alignSelf:'flex-start', maxWidth:'80%' }}>
              <div className="av-bot"><IconRobot /></div>
              <div style={{ padding:'14px 18px', borderRadius:'14px 14px 14px 4px', background:'var(--bg-elevated)', border:'1px solid var(--border)', display:'flex', gap:4, alignItems:'center' }}>
                {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', animation:`pulse-dot 1.2s ease-in-out ${i*0.16}s infinite` }} />)}
              </div>
            </div>
          )}

          {limitReached && (
            <div style={{ alignSelf:'center', background:'rgba(220,38,38,0.07)', border:'1px solid rgba(220,38,38,0.20)', borderRadius:12, padding:'12px 20px', fontSize:12, fontWeight:600, color:'#DC2626', textAlign:'center', maxWidth:360 }}>
              You have used all {LIMIT} Soddy queries. Contact your Chair if you need assistance.
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="soddy-input-bar">
          <input
            className="soddy-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={limitReached ? 'Query limit reached' : 'Ask about Rules of Procedure, MUN strategy…'}
            disabled={isTyping || limitReached}
            autoComplete="off"
            style={{ opacity: isTyping || limitReached ? 0.5 : 1 }}
          />
          <button
            type="submit"
            disabled={isTyping || !input.trim() || limitReached}
            style={{ background:'var(--accent)', border:'none', color:'#fff', width:44, height:44, borderRadius:12, cursor: isTyping || limitReached ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 2px 8px rgba(240,124,0,0.25)', opacity: isTyping || !input.trim() || limitReached ? 0.45 : 1 }}
          >
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}