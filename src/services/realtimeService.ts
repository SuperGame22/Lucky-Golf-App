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

// ── Foursome Finder ──────────────────────────────────────────────
export interface FoursomePost {
  id: string;
  title: string;
  course_name: string;
  tee_time: string | null;
  skill_level: string;
  max_players: number;
  description: string | null;
  invite_code: string;
  host_id: string;
  status: string;
  created_at: string;
}

export async function getOpenFoursomes(): Promise<{ data: FoursomePost[]; error: string | null }> {
  const { data, error } = await supabase
    .from('foursome_posts')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getOpenFoursomes error:', error.message);
    return { data: [], error: error.message };
  }
  return { data: (data as FoursomePost[]) ?? [], error: null };
}

export async function createFoursomePost(post: {
  title: string;
  course_name: string;
  tee_time: string;
  skill_level: string;
  max_players: number;
  description: string;
}): Promise<{ data: FoursomePost | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'You must be signed in to create a foursome.' };
  const invite_code = generateInviteCode();
  const { data, error } = await supabase
    .from('foursome_posts')
    .insert({
      title: post.title,
      course_name: post.course_name,
      tee_time: post.tee_time || null,
      skill_level: post.skill_level,
      max_players: post.max_players,
      description: post.description || null,
      host_id: user.id,
      invite_code,
      status: 'open',
    })
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as FoursomePost, error: null };
}

export async function joinFoursome(code: string): Promise<{ data: FoursomePost | null; error: string | null }> {
  const { data, error } = await supabase
    .from('foursome_posts')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'No open foursome found with that code.' };
  return { data: data as FoursomePost, error: null };
}
