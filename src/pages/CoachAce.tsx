import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Send, GraduationCap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const COACH_AVATAR = 'coaching';

interface Message { id: string; role: 'user' | 'coach'; text: string; timestamp: Date; }

const QUICK_TAPS = [
  { label: 'Fix my slice', query: 'How do I fix my slice?' },
  { label: 'First tee nerves', query: 'Tips for first tee nerves?' },
  { label: 'Club selection', query: 'How do I choose the right club?' },
  { label: 'Basic rules', query: 'What are the basic golf rules?' },
  { label: 'Grip basics', query: 'How should I grip the club?' },
];

export default function CoachAce() {
  const { profile, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'coach',
    text: `Hey${profile?.display_name ? ` ${profile.display_name}` : ''}! I'm Coach Ace. Ask me anything about golf — swing fixes, club selection, rules, or mental game. Fire away.`,
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (query: string) => {
    if (!query.trim() || isLoading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: query.trim(), timestamp: new Date() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setIsLoading(true);
    const coachId = `c-${Date.now()}`;
    setMessages(prev => [...prev, { id: coachId, role: 'coach', text: '', timestamp: new Date() }]);
    try {
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_KEY}`;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/coach-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader, apikey: SUPABASE_KEY },
        body: JSON.stringify({ messages: history.map(m => ({ role: m.role === 'coach' ? 'assistant' : 'user', content: m.text })) }),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let accumulated = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
              if (delta) { accumulated += delta; setMessages(prev => prev.map(m => m.id === coachId ? { ...m, text: accumulated } : m)); }
            } catch { /* partial */ }
          }
        }
      }
      if (!accumulated) { setMessages(prev => prev.filter(m => m.id !== coachId)); throw new Error('No response'); }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== coachId));
      toast.error(err.message || 'Coach unavailable right now');
    } finally { setIsLoading(false); }
  };

  return (
    <AppLayout hideHeader>
      <div className="flex flex-col h-[100dvh] bg-background">
        <div className="flex-shrink-0 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-black text-primary">ACE</div>
            <div className="flex-1">
              <h1 className="font-black text-sm uppercase tracking-wider">Coach Ace</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{isLoading ? 'Typing...' : 'AI Golf Pro'}</p>
            </div>
            <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-full">
              <GraduationCap className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">AI</span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
          <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto pb-1">
            {QUICK_TAPS.map(tap => (
              <button key={tap.label} onClick={() => handleSend(tap.query)} disabled={isLoading}
                className="flex-shrink-0 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-bold text-primary uppercase tracking-wider hover:bg-primary/15 transition-colors whitespace-nowrap disabled:opacity-40">
                {tap.label}
              </button>
            ))}
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-lg mx-auto space-y-4">
            {messages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'coach' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary mt-1">ACE</div>}
                <div className="max-w-[85%]">
                  <div className={`rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}>
                    {msg.text ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      : <div className="flex gap-1">
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>}
                  </div>
                  <p className="text-[9px] text-muted-foreground/50 mt-1 ml-1">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="flex-shrink-0 border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3 pb-24">
          <form onSubmit={e => { e.preventDefault(); handleSend(input); }} className="max-w-lg mx-auto flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Coach Ace anything..."
              disabled={isLoading}
              className="flex-1 h-11 bg-muted/50 border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50" />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-11 w-11 rounded-xl">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
