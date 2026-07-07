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
