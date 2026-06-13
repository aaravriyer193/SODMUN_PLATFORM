import React, { useState, useRef, useEffect } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

const IconRobot = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>;
const IconUser = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const IconSend = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;

export default function SoddyBot() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Greetings Delegate. I am Soddy, your SODMUN Intelligence AI. How may I assist you with your directives today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authUser) supabase.from('users').select('*').eq('id', authUser.id).single().then(({ data }) => { if (data) setProfile(data); });
  }, [authUser]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const callOpenRouter = async (chatHistory: Message[]) => {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('API Key missing.');
    const systemPrompt: Message = {
      role: 'system',
      content: `You are Soddy, the official AI intelligence assistant for SODMUN (Model United Nations) in Dubai, UAE on June 19-21. You are speaking to the ${profile?.role || 'Delegate'} of ${profile?.delegation || 'an unknown delegation'} in the ${profile?.committee || 'Global'} committee. Assist with Rules of Procedure, MUN strategy, and drafting clauses. Keep answers concise, professional, and formal. No emojis or markdown. Very short answers to conserve tokens. DO NOT help formulate POIs, resolutions, or position papers — only clarify Rules of Procedure.`
    };
    const payloadMessages = [systemPrompt, ...chatHistory.filter(m => m.role !== 'system')];
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.origin, 'X-Title': 'SODMUN Platform' },
      body: JSON.stringify({ model: 'xiaomi/mimo-v2-flash', messages: payloadMessages })
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    const userMessage: Message = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);
    try {
      const botReply = await callOpenRouter(newHistory);
      setMessages([...newHistory, { role: 'assistant', content: botReply }]);
    } catch (error: any) {
      setMessages([...newHistory, { role: 'assistant', content: `System Error: ${error.message || 'Could not connect to Soddy servers.'}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: '32px 32px 24px', gap: '20px', boxSizing: 'border-box' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        @keyframes pulse-dot { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 className="delegation-brand">Soddy AI</h1>
          <p style={{ color: '#F07C00', fontWeight: 600, fontSize: '12px', marginTop: '4px' }}>MUN Intelligence Assistant</p>
        </div>
      </div>

      {/* Chat shell */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '840px', margin: '0 auto', width: '100%', background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.07)', minHeight: 0 }}>

        {/* Chat header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.85)', flexShrink: 0 }}>
          <div style={{ width: '38px', height: '38px', background: 'rgba(240,124,0,0.10)', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F07C00' }}>
            <IconRobot />
          </div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#18181B', margin: 0 }}>Soddy Assistant</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: '12px', color: '#71717A', fontWeight: 500 }}>
                {profile ? `Connected` : 'Loading…'}
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: '28px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {messages.map((msg, idx) => {
            if (msg.role === 'system') return null;
            const isUser = msg.role === 'user';
            return (
              <div key={idx} style={{ display: 'flex', gap: '12px', maxWidth: '80%', alignSelf: isUser ? 'flex-end' : 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: isUser ? '#fff' : 'rgba(240,124,0,0.10)', border: isUser ? '1px solid rgba(0,0,0,0.09)' : '1px solid rgba(240,124,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isUser ? '#71717A' : '#F07C00', flexShrink: 0 }}>
                  {isUser ? <IconUser /> : <IconRobot />}
                </div>
                <div style={{ padding: '12px 16px', borderRadius: '14px', fontSize: '14px', lineHeight: 1.6, fontFamily: 'Manrope, sans-serif', background: isUser ? '#F07C00' : '#fff', color: isUser ? '#fff' : '#27272A', borderBottomRightRadius: isUser ? '4px' : '14px', borderBottomLeftRadius: isUser ? '14px' : '4px', border: isUser ? 'none' : '1px solid rgba(0,0,0,0.08)', boxShadow: isUser ? '0 2px 8px rgba(240,124,0,0.20)' : '0 1px 4px rgba(0,0,0,0.04)' }}>
                  {msg.content}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start', maxWidth: '80%' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(240,124,0,0.10)', border: '1px solid rgba(240,124,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F07C00', flexShrink: 0 }}>
                <IconRobot />
              </div>
              <div style={{ padding: '14px 18px', borderRadius: '14px', borderBottomLeftRadius: '4px', background: '#fff', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F07C00', animation: `pulse-dot 1.2s ease-in-out ${i * 0.16}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} style={{ padding: '16px 20px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.85)', flexShrink: 0 }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about Rules of Procedure, MUN strategy…"
            disabled={isTyping}
            autoComplete="off"
            style={{ flex: 1, background: '#F8F7F5', border: '1px solid rgba(0,0,0,0.09)', color: '#18181B', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontFamily: 'Manrope, sans-serif', outline: 'none', transition: 'border-color 0.15s', marginBottom: 0, opacity: isTyping ? 0.6 : 1 }}
            onFocus={e => e.currentTarget.style.borderColor = '#F07C00'}
            onBlur={e => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'}
          />
          <button type="submit" disabled={isTyping || !input.trim()} style={{ background: '#F07C00', border: 'none', color: '#fff', width: '44px', height: '44px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s', boxShadow: '0 2px 8px rgba(240,124,0,0.25)', opacity: isTyping || !input.trim() ? 0.45 : 1 }}>
            <IconSend />
          </button>
        </form>
      </div>
    </div>
  );
}