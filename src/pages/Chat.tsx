/**
 * In-App Chat — Real Supabase messaging with real-time updates
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Send, ArrowLeft, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  text: string;
  read_at: string | null;
  created_at: string;
}

interface Conversation {
  user_id: string;
  display_name: string;
  last_message: string;
  last_time: string;
  unread: number;
}

export default function Chat() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<'list' | 'conversation' | 'search'>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    loadConversations();

    // Real-time subscription for new messages
    const channel = supabase
      .channel(`chat:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_user_id=eq.${user.id}`,
      }, () => {
        loadConversations();
        if (activeConv) loadMessages(activeConv.user_id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get all messages involving this user
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (!data) return;

      // Group into conversations by other user
      const convMap = new Map<string, Conversation>();
      for (const msg of data) {
        const otherId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id;
        if (!convMap.has(otherId)) {
          // Fetch other user's profile
          const { data: prof } = await supabase
            .from('golfer_profiles')
            .select('display_name')
            .eq('user_id', otherId)
            .maybeSingle();

          convMap.set(otherId, {
            user_id: otherId,
            display_name: prof?.display_name || 'Golfer',
            last_message: msg.text,
            last_time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unread: (!msg.read_at && msg.to_user_id === user.id) ? 1 : 0,
          });
        }
      }
      setConversations(Array.from(convMap.values()));
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (otherUserId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${user.id},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    setMessages(data || []);

    // Mark incoming as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('from_user_id', otherUserId)
      .eq('to_user_id', user.id)
      .is('read_at', null);
  };

  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setView('conversation');
    await loadMessages(conv.user_id);

    // Subscribe to new messages in this conversation
    const channel = supabase
      .channel(`conv:${user?.id}:${conv.user_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadMessages(conv.user_id);
      })
      .subscribe();
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || !activeConv) return;
    const text = input.trim();
    setInput('');

    const { error } = await supabase.from('messages').insert({
      from_user_id: user.id,
      to_user_id: activeConv.user_id,
      text,
    });

    if (error) { toast.error('Failed to send'); return; }
    await loadMessages(activeConv.user_id);
  };

  const searchUsers = async () => {
    if (!searchQuery.trim() || !user) return;
    const { data } = await supabase
      .from('golfer_profiles')
      .select('user_id, display_name, username')
      .ilike('display_name', `%${searchQuery}%`)
      .neq('user_id', user.id)
      .limit(10);
    setSearchResults(data || []);
  };

  const startConversation = (result: any) => {
    const conv: Conversation = {
      user_id: result.user_id,
      display_name: result.display_name || result.username || 'Golfer',
      last_message: '',
      last_time: '',
      unread: 0,
    };
    setActiveConv(conv);
    setView('conversation');
    setMessages([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ── CONVERSATION VIEW ──
  if (view === 'conversation' && activeConv) {
    return (
      <AppLayout hideHeader>
        <div className="flex flex-col h-[100dvh] bg-background">
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-xl">
            <Button variant="ghost" size="icon" onClick={() => { setView('list'); loadConversations(); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
              {activeConv.display_name[0].toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm">{activeConv.display_name}</p>
              <p className="text-[10px] text-muted-foreground">Lucky Golf Member</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Send the first message!</p>
              </div>
            )}
            {messages.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.from_user_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.from_user_id === user?.id
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card border border-border rounded-bl-md'
                }`}>
                  <p>{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.from_user_id === user?.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="flex-shrink-0 px-4 py-3 pb-6 border-t border-border bg-background/95 backdrop-blur-xl">
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Message..."
                className="flex-1 h-11 bg-muted/50 border border-border rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim()} className="h-11 w-11 rounded-xl">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── LIST / SEARCH VIEW ──
  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Messages</h1>
            <p className="text-sm text-muted-foreground">Chat with fellow golfers</p>
          </div>
          <Button size="icon" variant="outline" onClick={() => setView(view === 'search' ? 'list' : 'search')}>
            {view === 'search' ? <MessageCircle className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          </Button>
        </div>

        {/* Search */}
        {view === 'search' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchUsers()}
                placeholder="Search by name..."
                className="flex-1 h-11 bg-muted/50 border border-border rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <Button onClick={searchUsers} className="h-11 rounded-xl"><Search className="w-4 h-4" /></Button>
            </div>
            {searchResults.map(r => (
              <div key={r.user_id} onClick={() => startConversation(r)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {(r.display_name || 'G')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{r.display_name || r.username}</p>
                  <p className="text-xs text-muted-foreground">Lucky Golf Member</p>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && searchQuery && (
              <p className="text-center text-sm text-muted-foreground py-4">No results found</p>
            )}
          </div>
        )}

        {/* Conversations */}
        {view === 'list' && (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <MessageCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-semibold text-muted-foreground">No conversations yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Find other golfers to chat with</p>
                <Button size="sm" onClick={() => setView('search')}>
                  <UserPlus className="w-4 h-4 mr-2" /> Find Golfers
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv, i) => (
                  <motion.div key={conv.user_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }} onClick={() => openConversation(conv)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                      {conv.display_name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{conv.display_name}</p>
                        <p className="text-xs text-muted-foreground">{conv.last_time}</p>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{conv.last_message}</p>
                    </div>
                    {conv.unread > 0 && (
                      <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {conv.unread}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
