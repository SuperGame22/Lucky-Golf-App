/**
 * Realtime Service — Supabase Channels for Lucky Wagers
 * Handles multiplayer session management via broadcast channels
 */

import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface WagerPlayer {
  id: string;
  name: string;
  scores: number[];
  isHost: boolean;
  isReady: boolean;
}

export interface WagerSessionState {
  players: WagerPlayer[];
  currentHole: number;
  status: 'waiting' | 'active' | 'finished';
  betAmount: number;
  mode: 'winner-takes-all' | 'king-of-pars';
}

interface WagerCallbacks {
  onStateSync?: (state: WagerSessionState) => void;
  onPlayerJoin?: (player: WagerPlayer) => void;
  onScoreUpdate?: (playerId: string, holeIndex: number, score: number) => void;
  onGameStart?: () => void;
  onGameEnd?: (winnerId: string) => void;
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function subscribeToWager(code: string, callbacks: WagerCallbacks): RealtimeChannel {
  const channel = supabase.channel(`wager:${code}`, {
    config: { broadcast: { self: false } },
  });

  channel
    .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
      callbacks.onStateSync?.(payload as WagerSessionState);
    })
    .on('broadcast', { event: 'player-join' }, ({ payload }) => {
      callbacks.onPlayerJoin?.(payload as WagerPlayer);
    })
    .on('broadcast', { event: 'score-update' }, ({ payload }) => {
      callbacks.onScoreUpdate?.(payload.playerId, payload.holeIndex, payload.score);
    })
    .on('broadcast', { event: 'game-start' }, () => {
      callbacks.onGameStart?.();
    })
    .on('broadcast', { event: 'game-end' }, ({ payload }) => {
      callbacks.onGameEnd?.(payload.winnerId);
    })
    .subscribe();

  return channel;
}

export function broadcastStateSync(channel: RealtimeChannel, state: WagerSessionState) {
  channel.send({ type: 'broadcast', event: 'state-sync', payload: state });
}

export function broadcastPlayerJoin(channel: RealtimeChannel, player: WagerPlayer) {
  channel.send({ type: 'broadcast', event: 'player-join', payload: player });
}

export function broadcastScoreUpdate(channel: RealtimeChannel, playerId: string, holeIndex: number, score: number) {
  channel.send({ type: 'broadcast', event: 'score-update', payload: { playerId, holeIndex, score } });
}

export function broadcastGameStart(channel: RealtimeChannel) {
  channel.send({ type: 'broadcast', event: 'game-start', payload: {} });
}

export function broadcastGameEnd(channel: RealtimeChannel, winnerId: string) {
  channel.send({ type: 'broadcast', event: 'game-end', payload: { winnerId } });
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
