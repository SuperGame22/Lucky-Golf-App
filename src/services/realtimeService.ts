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
