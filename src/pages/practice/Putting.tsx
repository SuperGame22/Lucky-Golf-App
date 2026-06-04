/**
 * PUTTING GRID — Physics putting simulator
 * 5 holes, drag-to-aim, slope system, clovers on completion
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';

// Physics constants
const BALL_R = 0.55, HOLE_R = 0.95, FRICTION = 0.9965, STOP_V = 0.025, MAX_DRAG = 50, POWER_K = 0.25;

interface Hole { id: number; label: string; hx: number; hy: number; sx: number; sy: number; pts: number; }

function makeHoles(): Hole[] {
  const r = (a: number, b: number) => a + Math.random() * (b - a);
  const rd = (n: number) => Math.round(n * 10) / 10;
  return Array.from({ length: 5 }, (_, i) => {
    const hx = Math.round(r(25, 75));
    const hy = Math.round(r(Math.max(15, 35 - i * 5), Math.min(38, 40 - i * 4)));
    const ms = Math.min(0.1 + i * 0.25, 1.0);
    return { id: i + 1, label: `${Math.round((90 - hy) * 0.45)} ft`, hx, hy, sx: rd(r(-ms, ms)), sy: rd(r(-ms * 0.6, ms * 0.6)), pts: i + 1 };
  });
}

// Putter cluck sound
function sndHit() {
  try {
    const ctx = new AudioContext(); const now = ctx.currentTime;
    const sz = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, sz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < sz; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sz * 0.08));
    const ns = ctx.createBufferSource(); ns.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.7, now); ng.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    ns.connect(bp); bp.connect(ng); ng.connect(ctx.destination); ns.start(now);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420, now); o.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.18);
    setTimeout(() => ctx.close(), 400);
  } catch { /* audio not available */ }
}

function sndSink() {
  try {
    const play = (f: number, d: number, delay: number) => {
      const c = new AudioContext(); const o = c.createOscillator(); const g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.4, c.currentTime + delay); g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + delay + d);
      o.connect(g); g.connect(c.destination); o.start(c.currentTime + delay); o.stop(c.currentTime + delay + d);
      setTimeout(() => c.close(), (delay + d) * 1000 + 100);
    };
    play(880, 0.12, 0); play(1100, 0.10, 0.06); play(1320, 0.15, 0.12);
  } catch { /* audio not available */ }
}

type GameState = 'aim' | 'rolling' | 'sunk' | 'miss';

export default function PuttingGame() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const greenRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  const [holes] = useState<Hole[]>(() => makeHoles());
  const [holeIdx, setHoleIdx] = useState(0);
  const [ballPos, setBallPos] = useState({ x: 50, y: 88 });
  const [ballVel, setBallVel] = useState({ x: 0, y: 0 });
  const [gameState, setGameState] = useState<GameState>('aim');
  const [score, setScore] = useState(0);
  const [putts, setPutts] = useState(0);
  const [sunk, setSunk] = useState(0);
  const [clovers, setClovers] = useState(0);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [done, setDone] = useState(false);

  const hole = holes[holeIdx];

  // Physics loop
  useEffect(() => {
    if (gameState !== 'rolling') return;
    const tick = () => {
      setBallPos(prev => {
        setBallVel(vel => {
          const slopedVx = vel.x + hole.sx * 0.015;
          const slopedVy = vel.y + hole.sy * 0.015;
          const fx = slopedVx * FRICTION, fy = slopedVy * FRICTION;
          const nx = prev.x + fx, ny = prev.y + fy;
          const dist = Math.hypot(nx - hole.hx, ny - hole.hy);
          const speed = Math.hypot(fx, fy);

          if (dist < HOLE_R && speed < 0.8) {
            sndSink();
            const earned = hole.pts;
            setScore(s => s + earned);
            setSunk(s => s + 1);
            setClovers(c => c + earned);
            setTimeout(() => {
              setGameState('sunk');
              setTimeout(() => {
                if (holeIdx < holes.length - 1) {
                  setHoleIdx(h => h + 1);
                  setBallPos({ x: 50, y: 88 });
                  setGameState('aim');
                } else {
                  setDone(true);
                }
              }, 1200);
            }, 100);
            return { x: 0, y: 0 };
          }
          if (nx < 5 || nx > 95) return { x: -fx * 0.6, y: fy };
          if (ny < 5 || ny > 95) return { x: fx, y: -fy * 0.6 };
          if (speed < STOP_V) {
            setGameState('miss');
            setTimeout(() => { setBallPos({ x: 50, y: 88 }); setGameState('aim'); }, 800);
            return { x: 0, y: 0 };
          }
          return { x: fx, y: fy };
        });
        return prev;
      });
      setBallPos(prev => ({ ...prev }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState, hole, holeIdx, holes.length]);

  // Proper ball position update in physics loop
  useEffect(() => {
    if (gameState !== 'rolling') return;
    let pos = { x: 50, y: 88 };
    let vel = { x: 0, y: 0 };
    setBallPos(p => { pos = p; return p; });
    setBallVel(v => { vel = v; return v; });

    const tick = () => {
      const slopedVx = vel.x + hole.sx * 0.015;
      const slopedVy = vel.y + hole.sy * 0.015;
      vel = { x: slopedVx * FRICTION, y: slopedVy * FRICTION };
      pos = { x: pos.x + vel.x, y: pos.y + vel.y };
      const dist = Math.hypot(pos.x - hole.hx, pos.y - hole.hy);
      const speed = Math.hypot(vel.x, vel.y);

      if (pos.x < 5) { pos.x = 5; vel.x = Math.abs(vel.x) * 0.6; }
      if (pos.x > 95) { pos.x = 95; vel.x = -Math.abs(vel.x) * 0.6; }
      if (pos.y < 5) { pos.y = 5; vel.y = Math.abs(vel.y) * 0.6; }
      if (pos.y > 95) { pos.y = 95; vel.y = -Math.abs(vel.y) * 0.6; }

      setBallPos({ ...pos });

      if (dist < HOLE_R && speed < 0.8) {
        sndSink();
        const earned = hole.pts;
        setScore(s => s + earned);
        setSunk(s => s + 1);
        setClovers(c => c + earned);
        setGameState('sunk');
        setTimeout(() => {
          if (holeIdx < holes.length - 1) {
            setHoleIdx(h => h + 1);
            setBallPos({ x: 50, y: 88 });
            setGameState('aim');
          } else {
            setDone(true);
          }
        }, 1200);
        return;
      }

      if (speed < STOP_V) {
        setGameState('miss');
        setTimeout(() => { setBallPos({ x: 50, y: 88 }); setGameState('aim'); }, 800);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    setBallVel(v => { vel = v; return v; });
    setBallPos(p => { pos = p; return p; });
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameState === 'rolling' ? gameState : null]);

  const shoot = useCallback(() => {
    if (!dragStart || !dragCurrent || gameState !== 'aim') return;
    const dx = dragStart.x - dragCurrent.x;
    const dy = dragStart.y - dragCurrent.y;
    const power = Math.min(Math.hypot(dx, dy), MAX_DRAG);
    if (power < 2) return;
    sndHit();
    setPutts(p => p + 1);
    setBallVel({ x: (dx / MAX_DRAG) * power * POWER_K, y: (dy / MAX_DRAG) * power * POWER_K });
    setDragStart(null);
    setDragCurrent(null);
    setGameState('rolling');
  }, [dragStart, dragCurrent, gameState]);

  const getXY = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = greenRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: ((clientX - rect.left) / rect.width) * 100, y: ((clientY - rect.top) / rect.height) * 100 };
  };

  const onPointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== 'aim') return;
    const pt = getXY(e);
    setDragStart(pt); setDragCurrent(pt);
  };
  const onPointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragStart) return;
    setDragCurrent(getXY(e));
  };
  const onPointerUp = () => shoot();

  // Log session on completion
  useEffect(() => {
    if (!done) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('practice_sessions').insert({ user_id: user.id, drill_type: 'putting', duration_seconds: 0, score: sunk, holes_completed: holes.length });
      supabase.rpc('award_clovers', { p_user_id: user.id, p_amount: clovers }).then(() => refreshProfile());
    });
  }, [done]);

  const aim = dragStart && dragCurrent ? { dx: dragStart.x - dragCurrent.x, dy: dragStart.y - dragCurrent.y } : null;

  if (done) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-6">
          <Trophy className="w-16 h-16 text-accent mx-auto" />
          <h1 className="text-3xl font-black uppercase tracking-tighter">Round Complete!</h1>
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card p-4"><p className="text-2xl font-black text-primary">{sunk}/{holes.length}</p><p className="text-xs text-muted-foreground uppercase">Sunk</p></div>
            <div className="glass-card p-4"><p className="text-2xl font-black">{putts}</p><p className="text-xs text-muted-foreground uppercase">Putts</p></div>
            <div className="glass-card p-4"><p className="text-2xl font-black text-accent">+{clovers}</p><p className="text-xs text-muted-foreground uppercase">Clovers</p></div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setHoleIdx(0); setSunk(0); setPutts(0); setScore(0); setClovers(0); setBallPos({ x: 50, y: 88 }); setGameState('aim'); setDone(false); }}>
              <RotateCcw className="w-4 h-4 mr-2" /> Play Again
            </Button>
            <Button className="flex-1" onClick={() => navigate('/practice')}>Done</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout hideHeader>
      <div className="flex flex-col h-[100dvh] bg-background select-none">
        {/* HUD */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-xl">
          <Button variant="ghost" size="icon" onClick={() => navigate('/practice')}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hole {holeIdx + 1}/5 &middot; {hole.label}</p>
            <p className="text-sm font-black">{gameState === 'sunk' ? 'SUNK!' : gameState === 'miss' ? 'MISS' : 'PRACTICE MODE'}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Putts</p>
            <p className="text-lg font-black">{putts}</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex-shrink-0 grid grid-cols-4 text-center border-b border-border/50 bg-background/80">
          {[['PTS', score], ['PUTTS', putts], ['IN', `${sunk}/${holes.length}`], ['EARN', `+${clovers}`]].map(([label, val]) => (
            <div key={label as string} className="py-2 border-r border-border/30 last:border-r-0">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">{label}</p>
              <p className="text-base font-black text-primary">{val}</p>
            </div>
          ))}
        </div>

        {/* Green */}
        <div className="flex-1 relative overflow-hidden bg-[#0a1a0a] flex items-center justify-center p-4">
          <div ref={greenRef} className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden cursor-crosshair"
            onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
            onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}>

            {/* Green surface */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              <defs><radialGradient id="gGrad" cx="50%" cy="30%" r="70%"><stop offset="0%" stopColor="#1a6b1a"/><stop offset="100%" stopColor="#063006"/></radialGradient></defs>
              <ellipse cx="50" cy="50" rx="48" ry="48" fill="url(#gGrad)" />
              {/* Bunkers */}
              {[[8,8,12,14],[82,8,10,12],[8,78,11,12],[82,76,10,12]].map(([cx,cy,rx,ry],i) => (
                <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill="#c8b060" opacity="0.7" />
              ))}
              {/* Slope indicator */}
              <line x1="50" y1="50" x2={50 + hole.sx * 15} y2={50 + hole.sy * 15} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="3,3" markerEnd="url(#arr)" />
              <defs><marker id="arr" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4Z" fill="rgba(255,255,255,0.3)"/></marker></defs>
            </svg>

            {/* Hole */}
            <div className="absolute rounded-full bg-black border-2 border-gray-800"
              style={{ width: '6%', height: '6%', left: `${hole.hx - 3}%`, top: `${hole.hy - 3}%`, boxShadow: 'inset 0 2px 8px rgba(0,0,0,1)' }} />

            {/* Flag */}
            <div className="absolute pointer-events-none" style={{ left: `${hole.hx}%`, top: `${hole.hy - 8}%`, transform: 'translateX(-50%)' }}>
              <div className="w-0.5 h-6 bg-gray-400 mx-auto" />
              <div className="w-3 h-2 bg-red-500 -mt-6 ml-0.5" />
            </div>

            {/* Aim line */}
            {aim && gameState === 'aim' && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                <line x1={ballPos.x} y1={ballPos.y} x2={ballPos.x + aim.dx * 0.5} y2={ballPos.y + aim.dy * 0.5}
                  stroke="rgba(74,222,128,0.6)" strokeWidth="0.8" strokeDasharray="2,2" />
                <circle cx={ballPos.x} cy={ballPos.y} r="3" fill="none" stroke="rgba(74,222,128,0.8)" strokeWidth="0.6" />
              </svg>
            )}

            {/* Ball */}
            <motion.div className="absolute rounded-full pointer-events-none"
              style={{ width: '3%', height: '3%', left: `${ballPos.x - 1.5}%`, top: `${ballPos.y - 1.5}%`,
                background: 'radial-gradient(circle at 36% 30%, #fff, #e0e0e0 30%, #bbb 60%, #888 100%)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
              animate={gameState === 'sunk' ? { scale: [1, 0.5, 0], opacity: [1, 1, 0] } : {}}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="flex-shrink-0 pb-24 pt-3 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            {gameState === 'aim' ? 'DRAG to aim and release to putt' : gameState === 'rolling' ? 'Rolling...' : gameState === 'sunk' ? 'Nice putt!' : 'MISS - resetting...'}
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
