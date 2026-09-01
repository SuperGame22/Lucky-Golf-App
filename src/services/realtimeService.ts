/**
 * Realtime Service — Supabase Channels for Lucky Wagers
 * Interface matches Wagers.tsx exactly.
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface WagerPlayer {
  userId: string;
  displayName: string;
  avatar: string;
  scores: number[];
  totalScore: number;
  parsWon: number;
}

export interface WagerSessionState {
  mode: 'winner-takes-all' | 'king-of-pars';
  betAmount: number;
  currentHole: number;
  status: 'lobby' | 'active' | 'results';
  players: Record<string, WagerPlayer>;
  hostId: string;
}

interface WagerCallbacks {
  onStateSync?: (state: WagerSessionState) => void;
  onPlayerJoin?: (player: WagerPlayer) => void;
  onScoreUpdate?: (payload: { userId: string; hole: number; score: number }) => void;
  onGameStart?: (state: WagerSessionState) => void;
  onGameEnd?: (state: WagerSessionState) => void;
  onPresenceSync?: (userIds: string[]) => void;
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function subscribeToWager(code: string, callbacks: WagerCallbacks): RealtimeChannel {
  const channel = supabase.channel(`wager:${code}`, {
    config: {
      broadcast: { self: false },
      presence: { key: code },
    },
  });

  channel
    .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
      callbacks.onStateSync?.(payload as WagerSessionState);
    })
    .on('broadcast', { event: 'player-join' }, ({ payload }) => {
      callbacks.onPlayerJoin?.(payload as WagerPlayer);
    })
    .on('broadcast', { event: 'score-update' }, ({ payload }) => {
      callbacks.onScoreUpdate?.(payload as { userId: string; hole: number; score: number });
    })
    .on('broadcast', { event: 'game-start' }, ({ payload }) => {
      callbacks.onGameStart?.(payload as WagerSessionState);
    })
    .on('broadcast', { event: 'game-end' }, ({ payload }) => {
      callbacks.onGameEnd?.(payload as WagerSessionState);
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const ids = Object.keys(state);
      callbacks.onPresenceSync?.(ids);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });

  return channel;
}

export function broadcastStateSync(channel: RealtimeChannel, state: WagerSessionState) {
  channel.send({ type: 'broadcast', event: 'state-sync', payload: state });
}

export function broadcastPlayerJoin(channel: RealtimeChannel, player: WagerPlayer) {
  channel.send({ type: 'broadcast', event: 'player-join', payload: player });
}

export function broadcastScoreUpdate(channel: RealtimeChannel, payload: { userId: string; hole: number; score: number }) {
  channel.send({ type: 'broadcast', event: 'score-update', payload });
}

export function broadcastGameStart(channel: RealtimeChannel, state: WagerSessionState) {
  channel.send({ type: 'broadcast', event: 'game-start', payload: state });
}

export function broadcastGameEnd(channel: RealtimeChannel, state: WagerSessionState) {
  channel.send({ type: 'broadcast', event: 'game-end', payload: state });
}

export function leaveChannel(channel: RealtimeChannel) {
  supabase.removeChannel(channel);
}

// ── Foursome Finder ──────────────────────────────────────────────────
// Reads/writes public.foursome_posts. spots_needed is decremented on each
// join and doubles as the "how many more players" the UI shows; when it
// hits 0 the post is marked inactive. No per-user membership table yet,
// so this doesn't stop the same person joining twice — fine for launch.

export interface FoursomePost {
  id: string;
  user_id: string;
  title: string | null;
  course_name: string;
  tee_time: string | null;
  skill_level: string | null;
  max_players: number;
  spots_needed: number;
  spots_available: number;
  status: 'open' | 'full';
  invite_code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getOpenFoursomes(): Promise<{ data: FoursomePost[]; error: string | null }> {
  const { data, error } = await supabase
    .from('foursome_posts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return { data: [], error: error.message };

  const posts = (data || []).map((row: any) => ({
    ...row,
    spots_available: row.spots_needed,
    status: row.spots_needed > 0 ? 'open' : 'full',
  }));

  return { data: posts, error: null };
}

export async function createFoursomePost(post: {
  title: string;
  course_name: string;
  tee_time?: string;
  skill_level?: string;
  max_players?: number;
  description?: string;
}): Promise<{ data: FoursomePost | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { data: null, error: 'Not signed in' };

  const maxPlayers = post.max_players || 4;

  // invite_code has a unique constraint but no DB default here, so
  // generate one client-side and retry once on the rare collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('foursome_posts')
      .insert({
        user_id: userId,
        title: post.title,
        course_name: post.course_name,
        tee_time: post.tee_time || null,
        skill_level: post.skill_level || 'intermediate',
        max_players: maxPlayers,
        spots_needed: maxPlayers - 1,
        description: post.description || null,
        invite_code: generateInviteCode(),
      })
      .select()
      .single();

    if (!error) return { data: data as FoursomePost, error: null };
    if (!error.message.includes('duplicate key') || attempt === 1) {
      return { data: null, error: error.message };
    }
  }
  return { data: null, error: 'Could not create foursome, please try again' };
}

export async function joinFoursome(inviteCode: string): Promise<{ data: FoursomePost | null; error: string | null }> {
  const { data: post, error: findErr } = await supabase
    .from('foursome_posts')
    .select('*')
    .eq('invite_code', inviteCode.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();

  if (findErr) return { data: null, error: findErr.message };
  if (!post) return { data: null, error: 'Invalid or expired invite code' };
  if (post.spots_needed <= 0) return { data: null, error: 'This foursome is already full' };

  const remaining = post.spots_needed - 1;
  const { data: updated, error: updateErr } = await supabase
    .from('foursome_posts')
    .update({
      spots_needed: remaining,
      is_active: remaining > 0,
    })
    .eq('id', post.id)
    .select()
    .single();

  if (updateErr) return { data: null, error: updateErr.message };
  return { data: updated as FoursomePost, error: null };
}
