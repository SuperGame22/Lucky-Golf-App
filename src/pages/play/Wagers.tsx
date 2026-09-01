/**
 * LUCKY WAGERS — Real-Time Multiplayer Engine
 * Uses Supabase Realtime Channels for live scoring.
 * Sessions linked via invite codes.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  generateInviteCode,
  subscribeToWager,
  broadcastStateSync,
  broadcastPlayerJoin,
  broadcastScoreUpdate,
  broadcastGameStart,
  broadcastGameEnd,
  broadcastCollecting,
  broadcastPaymentConfirmed,
  broadcastPaymentFailed,
  leaveChannel,
  type WagerPlayer,
  type WagerSessionState,
} from '@/services/realtimeService';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  Trophy, Crown, Users, Plus, Minus, Zap, Flag, ChevronRight, Check, X,
  Swords, ArrowLeft, Copy, Hash, Loader2, AlertCircle, Wifi, WifiOff, DollarSign,
} from 'lucide-react';

type WagerMode = 'winner-takes-all' | 'king-of-pars';
type PageView = 'mode-select' | 'create-lobby' | 'join' | 'lobby' | 'active' | 'results';

const HOLE_PARS = [4, 3, 5, 4, 4, 3, 5, 4, 4];

export default function LuckyWagers() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const [view, setView] = useState<PageView>('mode-select');
  const [mode, setMode] = useState<WagerMode | null>(null);
  const [sessionCode, setSessionCode] = useState('');
  const [betAmount, setBetAmount] = useState(10);
  const [isHost, setIsHost] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Game state synced via realtime
  const [players, setPlayers] = useState<Record<string, WagerPlayer>>({});
  const [currentHole, setCurrentHole] = useState(1);
  const [gameStatus, setGameStatus] = useState<'lobby' | 'active' | 'results'>('lobby');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Local score entry for this hole
  const [myHoleScore, setMyHoleScore] = useState(HOLE_PARS[0]);

  // Real-money buy-in state. competitionId is set once create_competition()
  // has run for the host; 'collecting' is the brief window where guests are
  // paying into it before the game actually goes live.
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [paidUserIds, setPaidUserIds] = useState<Set<string>>(new Set());

  // Refs mirroring the state above so the realtime callbacks (created once
  // per connectToSession call) never act on stale values.
  const isHostRef = useRef(false);
  const competitionIdRef = useRef<string | null>(null);
  const hasPaidRef = useRef(false);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { competitionIdRef.current = competitionId; }, [competitionId]);
  useEffect(() => { hasPaidRef.current = hasPaid; }, [hasPaid]);

  const myId = user?.id || '';
  const myName = profile?.display_name || user?.email?.split('@')[0] || 'Guest';
  const playerList = Object.values(players);
  const totalPot = betAmount * playerList.length;

  // Host: rebroadcast state when players change so joiners stay synced.
  // Only while still in the free lobby (not once buy-ins are being collected
  // or the game is live) — otherwise this would stomp the 'collecting'/
  // 'active' status with a stale 'lobby' one.
  useEffect(() => {
    if (isHost && channelRef.current && gameStatus === 'lobby' && !collecting && playerList.length > 0) {
      const timer = setTimeout(() => {
        broadcastStateSync(channelRef.current!, {
          mode: mode || 'winner-takes-all',
          betAmount,
          currentHole,
          status: gameStatus,
          players,
          hostId: myId,
          competitionId: null,
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isHost, collecting, playerList.length, betAmount, mode]);

  // ── Cleanup channel on unmount ──
  useEffect(() => {
    return () => {
      if (channelRef.current) leaveChannel(channelRef.current);
    };
  }, []);

  // ── Connect to session ──
  const connectToSession = useCallback((code: string, hosting: boolean, selectedMode?: WagerMode) => {
    if (channelRef.current) leaveChannel(channelRef.current);

    const ch = subscribeToWager(code, {
      onStateSync: (state) => {
        setPlayers(state.players);
        setCurrentHole(state.currentHole);
        setGameStatus(state.status === 'collecting' ? 'lobby' : state.status);
        setBetAmount(state.betAmount);
        setMode(state.mode);
        setCompetitionId(state.competitionId ?? null);
        if (state.status === 'active') {
          setView('active');
          setMyHoleScore(HOLE_PARS[state.currentHole - 1]);
        } else if (state.status === 'results') {
          setView('results');
        } else if (state.status === 'collecting') {
          setCollecting(true);
        }
      },
      onPlayerJoin: (player) => {
        setPlayers(prev => ({ ...prev, [player.userId]: player }));
      },
      onScoreUpdate: ({ userId, hole, score }) => {
        setPlayers(prev => {
          const p = prev[userId];
          if (!p) return prev;
          const scores = [...p.scores];
          scores[hole - 1] = score;
          const totalScore = scores.reduce((a, b) => a + b, 0);
          const parsWon = scores.filter((s, i) => s <= HOLE_PARS[i]).length;
          return { ...prev, [userId]: { ...p, scores, totalScore, parsWon } };
        });
      },
      onGameStart: (state) => {
        setCollecting(false);
        setCompetitionId(state.competitionId ?? null);
        setPlayers(state.players);
        setCurrentHole(1);
        setGameStatus('active');
        setView('active');
        setMyHoleScore(HOLE_PARS[0]);
      },
      onGameEnd: (state) => {
        setPlayers(state.players);
        setGameStatus('results');
        setView('results');
      },
      onPresenceSync: (ids) => {
        setOnlineUsers(ids);
        setConnected(true);
      },
      // ── Buy-in collection (real money via Stripe-funded cash balance) ──
      onCollecting: (state) => {
        setPlayers(state.players);
        setMode(state.mode);
        setBetAmount(state.betAmount);
        setCompetitionId(state.competitionId ?? null);
        setCollecting(true);

        // The host already paid in via create_competition(); everyone else
        // pays their buy-in now by joining that same competition.
        if (!isHostRef.current && !hasPaidRef.current && state.competitionId) {
          const compId = state.competitionId;
          supabase.rpc('join_competition', { p_competition_id: compId, p_user_id: myId })
            .then(({ data, error: rpcErr }) => {
              if (rpcErr || !data) {
                const reason = rpcErr?.message || 'Payment failed';
                if (reason.includes('AGE_VERIFICATION_REQUIRED')) {
                  navigate('/wagers/verify', { state: { returnTo: '/play/wagers' } });
                } else {
                  setError(reason.includes('Insufficient funds')
                    ? `You need $${state.betAmount} to join this wager. Add cash and try again.`
                    : reason);
                }
                if (channelRef.current) broadcastPaymentFailed(channelRef.current, myId, reason);
              } else {
                setHasPaid(true);
                hasPaidRef.current = true;
                setError(null);
                if (channelRef.current) broadcastPaymentConfirmed(channelRef.current, myId);
              }
            });
        }
      },
      onPaymentConfirmed: (userId) => {
        if (!isHostRef.current) return;
        setPaidUserIds(prev => new Set(prev).add(userId));
      },
      onPaymentFailed: ({ userId, reason }) => {
        if (!isHostRef.current) return;
        setPlayers(prev => {
          if (!prev[userId]) return prev;
          setError(`${prev[userId].displayName} couldn't pay in (${reason}) — removed from the wager.`);
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      },
    });

    channelRef.current = ch;
    setSessionCode(code);
    setIsHost(hosting);
    setConnected(true);

    // Add self to players
    const me: WagerPlayer = {
      userId: myId,
      displayName: myName,
      avatar: '🏌️',
      scores: [],
      totalScore: 0,
      parsWon: 0,
    };
    setPlayers(prev => ({ ...prev, [myId]: me }));

    // Broadcast join after a short delay to ensure channel is ready
    setTimeout(() => {
      broadcastPlayerJoin(ch, me);
      // If hosting, also broadcast the full initial state so joiners get the mode
      if (hosting) {
        setTimeout(() => {
          broadcastStateSync(ch, {
            mode: selectedMode || 'winner-takes-all',
            betAmount,
            currentHole: 1,
            status: 'lobby',
            players: { [myId]: me },
            hostId: myId,
          });
        }, 300);
      }
    }, 500);
  }, [myId, myName]);

  // ── Host: Create Session ──
  const handleCreate = (selectedMode: WagerMode) => {
    if (!user) { navigate('/auth'); return; }
    if (!profile?.date_of_birth || !profile?.tos_accepted_at) {
      navigate('/wagers/verify', { state: { returnTo: '/play/wagers' } });
      return;
    }
    const code = generateInviteCode();
    setMode(selectedMode);
    setCompetitionId(null);
    setHasPaid(false);
    setCollecting(false);
    setPaidUserIds(new Set());
    setView('lobby');
    connectToSession(code, true, selectedMode);
  };

  // ── Guest: Join Session ──
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const handleJoin = () => {
    if (!user) { navigate('/auth'); return; }
    if (!profile?.date_of_birth || !profile?.tos_accepted_at) {
      navigate('/wagers/verify', { state: { returnTo: '/play/wagers' } });
      return;
    }
    if (joinCode.length < 6) { setError('Enter a 6-character code'); return; }
    setJoinLoading(true);
    setError(null);
    setCompetitionId(null);
    setHasPaid(false);
    setCollecting(false);
    setPaidUserIds(new Set());
    setView('lobby');
    connectToSession(joinCode.toUpperCase(), false);
    setJoinLoading(false);
  };

  // ── Host: Lock in the wager — this is where real money moves. ──
  // create_competition() deducts the host's buy-in from wallets.balance
  // right away; everyone else pays in during the brief 'collecting' phase
  // once they see it, and only once every current player has paid does the
  // game actually go live (see the effect below).
  const startGame = async () => {
    if (!channelRef.current || playerList.length < 2 || !mode) return;
    setStarting(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc('create_competition', {
      p_user_id: myId,
      p_buy_in: betAmount,
      p_course_name: 'Lucky Wagers',
    });
    setStarting(false);
    if (rpcErr || !data?.competition_id) {
      const reason = rpcErr?.message || 'Could not start the wager';
      if (reason.includes('AGE_VERIFICATION_REQUIRED')) {
        navigate('/wagers/verify', { state: { returnTo: '/play/wagers' } });
        return;
      }
      setError(reason.includes('Insufficient funds')
        ? `You need $${betAmount} to host this wager. Add cash and try again.`
        : reason);
      return;
    }
    const compId = data.competition_id as string;
    setCompetitionId(compId);
    setHasPaid(true);
    hasPaidRef.current = true;
    setCollecting(true);
    setPaidUserIds(new Set([myId]));
    broadcastCollecting(channelRef.current, {
      mode, betAmount, currentHole: 1, status: 'collecting',
      players, hostId: myId, competitionId: compId,
    });
  };

  // ── Host: once every current player has paid their buy-in, go live for
  // real. If someone couldn't pay and got dropped, carry on with whoever's
  // left (min 2); if that leaves only the host, refund them and cancel. ──
  useEffect(() => {
    if (!isHost || !collecting || !competitionId || !channelRef.current) return;
    const ids = Object.keys(players);
    if (ids.length === 0 || !ids.every(id => paidUserIds.has(id))) return;

    if (ids.length < 2) {
      (async () => {
        const { error: refundErr } = await supabase.rpc('settle_competition', {
          p_competition_id: competitionId,
          p_winner_user_id: myId,
        });
        if (refundErr) console.error('Refund on cancelled wager failed:', refundErr.message);
        setError('Not enough paid players — wager cancelled and your buy-in was refunded.');
        setCollecting(false);
        setCompetitionId(null);
        setHasPaid(false);
        setPaidUserIds(new Set());
        if (channelRef.current) leaveChannel(channelRef.current);
        setView('mode-select');
        setPlayers({});
      })();
      return;
    }

    const resetPlayers: Record<string, WagerPlayer> = {};
    ids.forEach(id => { resetPlayers[id] = { ...players[id], scores: [], totalScore: 0, parsWon: 0 }; });
    const state: WagerSessionState = {
      mode: mode!, betAmount, currentHole: 1, status: 'active',
      players: resetPlayers, hostId: myId, competitionId,
    };
    setCollecting(false);
    setPaidUserIds(new Set());
    broadcastGameStart(channelRef.current, state);
    // self:false means the host never receives its own broadcast — drive
    // its own transition to 'active' directly.
    setPlayers(resetPlayers);
    setCurrentHole(1);
    setGameStatus('active');
    setView('active');
    setMyHoleScore(HOLE_PARS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, collecting, competitionId, players, paidUserIds]);

  // ── Submit my score for current hole ──
  const submitMyScore = () => {
    if (!channelRef.current) return;
    broadcastScoreUpdate(channelRef.current, {
      userId: myId,
      hole: currentHole,
      score: myHoleScore,
    });
    // self:false means we don't get our own broadcast back — update
    // locally too, otherwise our own submission never registers and
    // allScoresIn/iSubmitted can never go true for whoever just scored.
    setPlayers(prev => {
      const p = prev[myId];
      if (!p) return prev;
      const scores = [...p.scores];
      scores[currentHole - 1] = myHoleScore;
      const totalScore = scores.reduce((a, b) => a + b, 0);
      const parsWon = scores.filter((s, i) => s <= HOLE_PARS[i]).length;
      return { ...prev, [myId]: { ...p, scores, totalScore, parsWon } };
    });
  };

  // ── Host: Advance to next hole ──
  const advanceHole = () => {
    if (!channelRef.current) return;
    const nextHole = currentHole + 1;
    if (nextHole > 9) {
      // Game over — pay the pot to the winner's cash balance before telling
      // everyone. settle_competition is idempotent (safe if this ever fires
      // twice) and only the host (a paid participant) is allowed to call it.
      if (competitionId) {
        const winner = getWinner();
        if (winner) {
          supabase.rpc('settle_competition', {
            p_competition_id: competitionId,
            p_winner_user_id: winner.userId,
          }).then(({ error: settleErr }) => {
            if (settleErr) {
              console.error('settle_competition failed:', settleErr.message);
              setError(`Payout failed to process automatically: ${settleErr.message}`);
            }
          });
        }
      }
      const endState: WagerSessionState = {
        mode: mode!, betAmount, currentHole, status: 'results',
        players, hostId: myId, competitionId,
      };
      broadcastGameEnd(channelRef.current, endState);
      // self:false — drive our own transition too.
      setGameStatus('results');
      setView('results');
    } else {
      setCurrentHole(nextHole);
      setMyHoleScore(HOLE_PARS[nextHole - 1]);
      const syncState: WagerSessionState = {
        mode: mode!, betAmount, currentHole: nextHole, status: 'active',
        players, hostId: myId, competitionId,
      };
      broadcastStateSync(channelRef.current, syncState);
    }
  };

  const allScoresIn = playerList.every(p => p.scores.length >= currentHole);

  const getScoreLabel = (score: number, par: number) => {
    const diff = score - par;
    if (diff <= -2) return { text: 'EAGLE', color: 'text-yellow-400' };
    if (diff === -1) return { text: 'BIRDIE', color: 'text-green-400' };
    if (diff === 0) return { text: 'PAR', color: 'text-white' };
    if (diff === 1) return { text: 'BOGEY', color: 'text-orange-400' };
    return { text: `+${diff}`, color: 'text-red-400' };
  };

  const getWinner = () => {
    if (mode === 'winner-takes-all') return [...playerList].sort((a, b) => a.totalScore - b.totalScore)[0];
    return [...playerList].sort((a, b) => b.parsWon - a.parsWon)[0];
  };

  const copyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setError(null);
  };

  const iSubmitted = players[myId]?.scores?.length >= currentHole;

  // ── MODE SELECT ──
  if (view === 'mode-select') {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/play')}><ArrowLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider">Lucky Wagers</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                {user ? 'Real-time multiplayer' : 'Sign in to play'}
              </p>
            </div>
          </div>

          {/* Create New */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Host a Wager</p>
            {[
              { id: 'winner-takes-all' as WagerMode, title: 'Winner Takes All', desc: 'Lowest total after 9 holes wins the pot.', icon: Trophy, tag: 'HIGH STAKES', tagColor: 'bg-yellow-500/20 text-yellow-500', gradient: 'from-yellow-500/20 to-orange-500/20' },
              { id: 'king-of-pars' as WagerMode, title: 'King of the Pars', desc: 'Most pars (or better) takes the crown.', icon: Crown, tag: 'STRATEGIC', tagColor: 'bg-primary/20 text-primary', gradient: 'from-primary/20 to-emerald-500/20' },
            ].map(m => {
              const Icon = m.icon;
              return (
                <motion.div key={m.id} whileTap={{ scale: 0.98 }}
                  onClick={() => handleCreate(m.id)}
                  data-testid={`mode-${m.id}`}
                  className="glass-card p-5 cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${m.gradient} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-7 h-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-base font-black uppercase tracking-wide">{m.title}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                      <span className={`inline-block mt-2 text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${m.tagColor}`}>{m.tag}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground mt-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Join Existing */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Join a Wager</p>
            <div className="glass-card p-5">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="INVITE CODE" value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    maxLength={6} data-testid="wager-join-code"
                    className="w-full h-11 pl-10 pr-4 bg-black/40 border border-border rounded-xl text-sm font-mono font-bold tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 uppercase"
                  />
                </div>
                <Button className="font-black uppercase tracking-wider text-xs px-5" disabled={joinCode.length < 6 || joinLoading}
                  onClick={handleJoin} data-testid="wager-join-btn">
                  {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ── LOBBY ──
  if (view === 'lobby') {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { if (channelRef.current) leaveChannel(channelRef.current); setView('mode-select'); setPlayers({}); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-black uppercase tracking-wider">
                {mode === 'winner-takes-all' ? 'Winner Takes All' : 'King of the Pars'}
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{isHost ? 'You are hosting' : 'Waiting for host'}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {connected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-400">Live</span>
            </div>
          </div>

          {/* Session Code */}
          <div className="glass-card p-5 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Session Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl font-mono font-black tracking-[0.3em] text-primary" data-testid="session-code">{sessionCode}</span>
              <button onClick={copyCode} className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors">
                <Copy className="w-5 h-5 text-primary" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Share this code with your opponents</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-red-400">{error}</p>
                {error.toLowerCase().includes('add cash') && (
                  <button
                    className="text-xs font-bold text-primary underline mt-1"
                    onClick={() => navigate('/wallet/add-cash')}
                  >
                    Add Cash Now
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Wager Amount (host only) — real cash, deducted from your $ balance */}
          {isHost && (
            <div className="glass-card p-5">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Wager Amount (Cash)</p>
              <div className="flex items-center justify-center gap-6">
                <Button variant="outline" size="icon" disabled={collecting || starting} onClick={() => setBetAmount(Math.max(5, betAmount - 5))}><Minus className="w-4 h-4" /></Button>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-7 h-7 text-emerald-400" />
                  <span className="text-3xl font-black">{betAmount}</span>
                </div>
                <Button variant="outline" size="icon" disabled={collecting || starting} onClick={() => setBetAmount(Math.min(300, betAmount + 5))}><Plus className="w-4 h-4" /></Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground mt-2">Per player · Pot: <span className="text-emerald-400 font-bold">${totalPot}</span></p>
              <p className="text-center text-[9px] text-muted-foreground mt-1">Charged to your cash balance when you lock in.</p>
            </div>
          )}

          {/* Players */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">
              Players ({playerList.length}/4)
              {onlineUsers.length > 0 && <span className="text-green-400 ml-2">{onlineUsers.length} online</span>}
            </p>
            <div className="space-y-2">
              {playerList.map(p => (
                <div key={p.userId} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.avatar}</span>
                    <span className="font-bold text-sm">{p.displayName}</span>
                    {p.userId === myId && <span className="text-[8px] uppercase tracking-widest bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">You</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {onlineUsers.includes(p.userId) ? (
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                </div>
              ))}
              {playerList.length < 2 && (
                <p className="text-xs text-muted-foreground text-center py-4">Waiting for opponents to join...</p>
              )}
            </div>
          </div>

          {isHost && (
            <Button className="w-full h-14 text-lg font-black uppercase tracking-wider" disabled={playerList.length < 2 || starting || collecting}
              onClick={startGame} data-testid="start-wager-btn">
              {starting || collecting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Swords className="w-5 h-5 mr-2" />}
              {collecting ? 'Collecting Buy-Ins…' : starting ? 'Starting…' : `Lock In Wager · $${betAmount}/player`}
            </Button>
          )}
          {!isHost && (
            <div className="text-center text-xs text-muted-foreground py-4">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              Waiting for host to start...
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // ── ACTIVE SCORING ──
  if (view === 'active') {
    const par = HOLE_PARS[currentHole - 1];
    const myScoreLabel = getScoreLabel(myHoleScore, par);

    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                {mode === 'winner-takes-all' ? 'WINNER TAKES ALL' : 'KING OF THE PARS'}
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-green-400">LIVE</span>
              </p>
              <h1 className="text-3xl font-black uppercase tracking-wide">Hole {currentHole}</h1>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Par</p>
              <p className="text-3xl font-black">{par}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="w-full bg-muted rounded-full h-2">
            <motion.div className="bg-primary h-2 rounded-full" animate={{ width: `${(currentHole / 9) * 100}%` }} />
          </div>

          {/* Pot */}
          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-400" /><span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Cash Pot</span></div>
            <span className="text-lg font-black text-emerald-400">${totalPot}</span>
          </div>

          {/* My Score Entry */}
          {!iSubmitted ? (
            <div className="glass-card p-5 border-primary/30">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Your Score</p>
              <div className="flex items-center justify-center gap-6 mb-3">
                <Button variant="outline" size="icon" onClick={() => setMyHoleScore(Math.max(1, myHoleScore - 1))}><Minus className="w-4 h-4" /></Button>
                <div className="text-center">
                  <span className="text-5xl font-black">{myHoleScore}</span>
                  <p className={`text-xs font-black uppercase tracking-wider mt-1 ${myScoreLabel.color}`}>{myScoreLabel.text}</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => setMyHoleScore(myHoleScore + 1)}><Plus className="w-4 h-4" /></Button>
              </div>
              <Button className="w-full h-12 font-black uppercase tracking-wider" onClick={submitMyScore} data-testid="submit-score-btn">
                <Check className="w-4 h-4 mr-2" /> Submit Score
              </Button>
            </div>
          ) : (
            <div className="glass-card p-4 text-center border-green-500/30 bg-green-500/5">
              <Check className="w-6 h-6 text-green-400 mx-auto mb-1" />
              <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Score Submitted: {players[myId]?.scores[currentHole - 1]}</p>
            </div>
          )}

          {/* Other Players Status */}
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">Scoreboard</p>
            <div className="space-y-2">
              {playerList.map(p => {
                const submitted = p.scores.length >= currentHole;
                const holeScore = p.scores[currentHole - 1];
                const label = submitted ? getScoreLabel(holeScore, par) : null;
                return (
                  <div key={p.userId} className={`flex items-center justify-between p-3 rounded-xl border ${submitted ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{p.avatar}</span>
                      <div>
                        <p className="font-bold text-sm">{p.displayName} {p.userId === myId && '(You)'}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                          Total: {p.totalScore} · Pars: {p.parsWon}
                        </p>
                      </div>
                    </div>
                    {submitted ? (
                      <div className="text-right">
                        <span className="text-xl font-black">{holeScore}</span>
                        <p className={`text-[9px] font-black uppercase ${label?.color}`}>{label?.text}</p>
                      </div>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Host: Advance */}
          {isHost && allScoresIn && (
            <Button className="w-full h-12 font-black uppercase tracking-wider" onClick={advanceHole} data-testid="advance-hole-btn">
              {currentHole >= 9 ? <><Flag className="w-4 h-4 mr-2" /> Finish & Settle</> : <><ChevronRight className="w-4 h-4 mr-2" /> Next Hole</>}
            </Button>
          )}
          {!isHost && allScoresIn && (
            <p className="text-center text-xs text-muted-foreground">Waiting for host to advance...</p>
          )}

          {/* Hole strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {Array.from({ length: 9 }, (_, i) => {
              const n = i + 1;
              return (
                <div key={i} className={`min-w-[2rem] h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  n === currentHole ? 'bg-primary text-primary-foreground' :
                  n < currentHole ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>{n}</div>
              );
            })}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── RESULTS ──
  if (view === 'results') {
    const winner = getWinner();
    const sorted = mode === 'winner-takes-all'
      ? [...playerList].sort((a, b) => a.totalScore - b.totalScore)
      : [...playerList].sort((a, b) => b.parsWon - a.parsWon);

    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
            <motion.div animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            </motion.div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
              {mode === 'winner-takes-all' ? 'WINNER TAKES ALL' : 'KING OF THE PARS'}
            </p>
            <h1 className="text-3xl font-black uppercase tracking-wide mb-1">{winner?.displayName} Wins!</h1>
            <p className="text-emerald-400 font-black text-xl">+${totalPot} Cash</p>
          </motion.div>

          <div className="space-y-2">
            {sorted.map((p, i) => {
              const isWinner = p.userId === winner?.userId;
              return (
                <motion.div key={p.userId} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={`glass-card p-4 flex items-center justify-between ${isWinner ? 'border-primary/50 bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-black w-8 ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-orange-600'}`}>#{i + 1}</span>
                    <span className="text-2xl">{p.avatar}</span>
                    <div>
                      <p className="font-bold flex items-center gap-2">
                        {p.displayName} {p.userId === myId && '(You)'}
                        {isWinner && <Crown className="w-4 h-4 text-yellow-500" />}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">
                        {mode === 'winner-takes-all' ? `Total: ${p.totalScore}` : `Pars: ${p.parsWon}/9`}
                      </p>
                    </div>
                  </div>
                  <span className={`font-black text-lg ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                    {isWinner ? `+$${totalPot}` : `-$${betAmount}`}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Hole breakdown */}
          <div className="glass-card p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-3">Hole-by-Hole</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 font-bold uppercase tracking-wider text-muted-foreground">Hole</th>
                    {sorted.map(p => (
                      <th key={p.userId} className="py-2 px-2 font-bold uppercase tracking-wider text-muted-foreground text-center">
                        {p.displayName.split(' ')[0]}
                      </th>
                    ))}
                    <th className="py-2 pl-2 font-bold uppercase tracking-wider text-muted-foreground text-center">Par</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 9 }, (_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-bold">{i + 1}</td>
                      {sorted.map(p => {
                        const s = p.scores[i] ?? '-';
                        const label = typeof s === 'number' ? getScoreLabel(s, HOLE_PARS[i]) : null;
                        return <td key={p.userId} className={`py-2 px-2 text-center font-bold ${label?.color || ''}`}>{s}</td>;
                      })}
                      <td className="py-2 pl-2 text-center text-muted-foreground">{HOLE_PARS[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 font-black uppercase tracking-wider"
              onClick={() => { if (channelRef.current) leaveChannel(channelRef.current); setView('mode-select'); setPlayers({}); }}>
              New Wager
            </Button>
            <Button className="flex-1 font-black uppercase tracking-wider" onClick={() => navigate('/play')}>
              Back to Play
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return null;
}
