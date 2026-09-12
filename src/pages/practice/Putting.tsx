import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useClovers } from '@/contexts/CloverContext';
import { ArrowLeft, RotateCcw, Trophy } from 'lucide-react';

// Physics
const BR=0.55,HR=0.95,CAP_R=0.35,CAP_S=0.9,LIP=HR+BR,LIPI=HR*0.6;
const FRIC=0.997025,STOP=0.014,SLK=0.0115,MXD=50,PWK=0.133875; // PWK: -30%,-10%,-15% launch power; FRIC: -15% rolling friction; SLK: -36% break force (no more reversing uphill); STOP lowered so the finish crawls out further before it's called

interface Hole{id:number;label:string;hx:number;hy:number;sx:number;sy:number;rw:number}
function mk():Hole[]{
  const r=(a:number,b:number)=>a+Math.random()*(b-a),rd=(n:number)=>Math.round(n*10)/10;
  return Array.from({length:5},(_,i)=>{
    const hx=Math.round(r(25,75)),hy=Math.round(r(Math.max(15,35-i*5),Math.min(38,40-i*4)));
    const ms=Math.min(0.1+i*0.25,0.595); // capped -30% then another -15% off the old 1.0 max so no slope is unmakeable
    return{id:i+1,label:`${Math.round((90-hy)*0.45)} ft`,hx,hy,sx:rd(r(-ms,ms)),sy:rd(r(-ms*0.6,ms*0.6)),rw:i+1};
  });
}

// Organic green path + bunkers (SVG coords in 0-100 viewBox)
const GREEN_PATH="M 12,50 C 10,30 18,12 35,8 C 50,5 65,6 78,12 C 90,18 93,35 92,50 C 91,65 88,78 75,85 C 62,92 45,94 30,90 C 18,86 14,70 12,50 Z";
const BUNKERS=[
  "M 2,30 C -3,18 4,6 16,4 C 24,2 32,10 28,20 C 24,28 8,38 2,30 Z",
  "M 82,62 C 88,54 98,58 96,70 C 94,80 86,84 80,78 C 76,72 78,68 82,62 Z",
  "M 18,92 C 14,86 20,78 30,80 C 38,82 40,92 32,96 C 24,99 22,97 18,92 Z",
  "M 74,2 C 80,-2 90,2 92,10 C 94,18 88,22 82,18 C 76,14 70,6 74,2 Z",
];

// Putter hit — try real MP3, fall back to synthesis
function sndHit(){
  try {
    const a = new Audio('/sounds/putter-hit.mp3');
    a.volume = 0.8;
    a.play().catch(() => {});
  } catch {}
}
function sndHitSynth(){
  try {
    const ctx=new AudioContext();const now=ctx.currentTime;
    const sz=Math.floor(ctx.sampleRate*0.04);
    const buf=ctx.createBuffer(1,sz,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<sz;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(sz*0.08));
    const ns=ctx.createBufferSource();ns.buffer=buf;
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1800;bp.Q.value=0.8;
    const ng=ctx.createGain();ng.gain.setValueAtTime(0.7,now);ng.gain.exponentialRampToValueAtTime(0.001,now+0.04);
    ns.connect(bp);bp.connect(ng);ng.connect(ctx.destination);ns.start(now);
    const o=ctx.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(420,now);o.frequency.exponentialRampToValueAtTime(180,now+0.12);
    const g=ctx.createGain();g.gain.setValueAtTime(0.35,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.18);
    o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+0.18);
    setTimeout(()=>ctx.close(),400);
  } catch {}
}
// Sink sound — one of three real recordings, picked at random each time
// (never repeating the previous pick, so across sinks they cycle/alternate).
const SINK_SOUNDS=['/sounds/hole-sink-1.m4a','/sounds/hole-sink-2.m4a','/sounds/hole-sink-3.m4a'];
let lastSink=-1;
function sndSink(){
  try {
    let i=Math.floor(Math.random()*SINK_SOUNDS.length);
    if(SINK_SOUNDS.length>1&&i===lastSink) i=(i+1)%SINK_SOUNDS.length;
    lastSink=i;
    const a=new Audio(SINK_SOUNDS[i]);
    a.volume=0.85;
    a.play().catch(()=>{});
  } catch {}
}

// ---- Putter (visual only) — sits behind the ball, pulls back on aim, ----
// ---- swings forward through the ball on release. ----
// Real photoreal Lucky Mallet Putter (transparent PNG, bird's-eye — same
// perspective as the reference photo). The whole sprite translates + rotates
// as one rigid piece so the baked-in photo lighting/perspective stays intact.
// ANCHOR is the front-of-head point (closest to the ball at address); THETA0
// is that same sprite's baked-in front->grip angle, used to re-aim it.
const MALLET_IMG = '/putting/mallet-putter.png';
// Anchor = the flat face's centerline (the sight-bead, mid-width of the
// head, on the leading/top edge) — this is where the ball addresses, not a
// corner of the head, so rotation pivots naturally around the ball.
const MALLET_ANCHOR_X_PCT = 68.4, MALLET_ANCHOR_Y_PCT = 24.13; // sight-bead, precisely located
// In the source photo (rotate: 0) the face's outward normal — the direction
// a struck ball leaves the face — points straight up (-90deg): the flat
// top edge runs left-right with the solid head body below it. So facing
// the sprite at any target angle is just: rotate = targetAngle + 90.
const MALLET_FACE_NORMAL0 = -90; // degrees
const CLUB_IMG_W = 6.375; // sprite width, % of course width (-25% club head size)
const REST_GAP = 0.525, MAX_PULL = 9, STANCE_SKEW = 0, CONTACT_DIP = 0.15; // REST_GAP: -50% gap (smaller sliver); MAX_PULL: +50% travel per pull; CONTACT_DIP: club lands slightly closer than REST_GAP at impact, for a touch of depth on contact; degrees — 0 = face points exactly at the hole

// Point-in-SVG-path test (ray casting)
function parsePath(d:string):{x:number;y:number}[][]{
  const segs:any[]=[];let cur:{x:number;y:number}[]=[];
  d.replace(/([MCLZ])\s*([^MCLZ]*)/gi,(_, cmd, args)=>{
    const nums=(args.match(/-?[\d.]+/g)||[]).map(Number);
    if(cmd==='M'||cmd==='m'){if(cur.length)segs.push(cur);cur=[{x:nums[0],y:nums[1]}];}
    else if(cmd==='C'||cmd==='c'){for(let i=0;i<nums.length;i+=6){cur.push({x:nums[i],y:nums[i+1]},{x:nums[i+2],y:nums[i+3]},{x:nums[i+4],y:nums[i+5]});}}
    else if(cmd==='L'||cmd==='l'){for(let i=0;i<nums.length;i+=2)cur.push({x:nums[i],y:nums[i+1]});}
    else if(cmd==='Z'||cmd==='z'){if(cur.length>0)cur.push(cur[0]);}
    return '';
  });
  if(cur.length)segs.push(cur);return segs;
}
const greenPts=parsePath(GREEN_PATH)[0]||[];
function inGreen(px:number,py:number):boolean{
  let inside=false;
  for(let i=0,j=greenPts.length-1;i<greenPts.length;j=i++){
    const{x:xi,y:yi}=greenPts[i],{x:xj,y:yj}=greenPts[j];
    if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
const bunkerPts=BUNKERS.map(b=>parsePath(b)[0]||[]);
function inBunker(px:number,py:number):boolean{
  return bunkerPts.some(pts=>{
    let ins=false;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++){
      const{x:xi,y:yi}=pts[i],{x:xj,y:yj}=pts[j];
      if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)ins=!ins;
    }
    return ins;
  });
}

type GS='aim'|'roll'|'sunk'|'lip'|'miss'|'sand'|'practice';

export default function PuttingGame(){
  const nav=useNavigate();const{refreshProfile}=useAuth();const{addClovers}=useClovers();
  const gRef=useRef<HTMLDivElement>(null);const raf=useRef(0);
  const[course]=useState<Hole[]>(()=>mk());
  const[nc,setNc]=useState<Hole[]|null>(null);
  const cc=nc||course;
  const[hi,setHi]=useState(0);const[bp,setBp]=useState({x:50,y:88});
  const[gs,setGs]=useState<GS>('aim');
  const[sc,setSc]=useState(0);const[pt,setPt]=useState(0);const[sk,setSk]=useState(0);const[cl,setCl]=useState(0);
  const[d0,setD0]=useState<{x:number;y:number}|null>(null);
  const[dc,setDc]=useState<{x:number;y:number}|null>(null);
  const[swing,setSwing]=useState<{angle:number;pw:number}|null>(null); // frozen release pose for the forward-swing animation
  const[msg,setMsg]=useState<string|null>(null);const[sub,setSub]=useState<string|null>(null);
  const[prac,setPrac]=useState(true);
  const h=cc[Math.min(hi,cc.length-1)];

  const pct=useCallback((cx:number,cy:number)=>{
    if(!gRef.current)return{x:50,y:88};const r=gRef.current.getBoundingClientRect();
    return{x:((cx-r.left)/r.width)*100,y:((cy-r.top)/r.height)*100};
  },[]);

  const down=(e:React.TouchEvent|React.MouseEvent)=>{if(gs!=='aim')return;const p='touches' in e?e.touches[0]:e;const v=pct(p.clientX,p.clientY);setD0(v);setDc(v);};
  const move=(e:React.TouchEvent|React.MouseEvent)=>{if(!d0||gs!=='aim')return;const p='touches' in e?e.touches[0]:e;setDc(pct(p.clientX,p.clientY));};
  const up=()=>{
    if(!d0||!dc||gs!=='aim')return;
    const dx=d0.x-dc.x,dy=d0.y-dc.y,pw=Math.min(Math.sqrt(dx*dx+dy*dy),MXD);
    setD0(null);setDc(null);if(pw<0.3)return;
    const a=Math.atan2(dy,dx);if(!prac)setPt(n=>n+1);
    // Freeze the pulled-back club pose, then let it swing forward — the hit
    // sound and ball simulation fire together, timed to when the club face
    // reaches the ball at the end of that swing.
    setSwing({angle:a,pw});
    const _vx=Math.cos(a)*pw*PWK,_vy=Math.sin(a)*pw*PWK;
    setTimeout(()=>{sndHit();setSwing(null);sim(_vx,_vy);},220);
  };

  const endPrac=(label:string,detail:string)=>{
    setMsg(label);setSub(detail);
    setTimeout(()=>{setMsg(null);setSub(null);setBp({x:50,y:88});setPrac(false);setGs('aim');},1600);
  };

  const sim=(ivx:number,ivy:number)=>{
    setGs(prac?'practice':'roll');
    let x=bp.x,y=bp.y,vx=ivx,vy=ivy,lipCD=0;
    const tick=()=>{
      vx+=h.sx*SLK;vy+=h.sy*SLK;
      const spd=Math.sqrt(vx*vx+vy*vy);
      // Single smooth curve (no speed branch) — the old version jumped to a
      // different, harsher formula below a speed threshold that actually
      // increased friction as the ball slowed, which is why it snapped to a
      // stop instead of gently coasting out. This eases toward FRIC as speed
      // drops, so the last bit of roll tapers off instead of cutting short.
      const f=FRIC-spd*0.00006;
      vx*=f;vy*=f;x+=vx;y+=vy;

      // Boundary: bunker or off-green
      if(!inGreen(x,y)){
        cancelAnimationFrame(raf.current);
        setBp({x:Math.max(2,Math.min(98,x)),y:Math.max(2,Math.min(98,y))});
        if(prac){endPrac('Practice Over','Now for the real putt');return;}
        if(inBunker(x,y)){setGs('sand');setMsg('Trapped in Sand');setSub('Ball hit the bunker');}
        else{setGs('miss');setMsg('Off the Green');setSub('Into the rough');}
        setTimeout(()=>{setMsg(null);setSub(null);setBp({x:50,y:88});setGs('aim');},1800);
        return;
      }

      if(lipCD>0)lipCD--;const cs=Math.sqrt(vx*vx+vy*vy);
      const hdx=x-h.hx,hdy=y-h.hy,dist=Math.sqrt(hdx*hdx+hdy*hdy);
      if(dist<LIP){
        const nx=hdx/(dist||0.001),ny=hdy/(dist||0.001);
        if(dist<CAP_R&&cs<CAP_S){
          cancelAnimationFrame(raf.current);setBp({x:h.hx,y:h.hy});
          if(prac){endPrac('Nice Read!','Now the real putt');return;}
          sndSink();doSunk();return;
        }
        if(dist>LIPI&&lipCD===0){
          if(cs>CAP_S*3){lipCD=15;const tx=-ny,ty=nx,dot=vx*tx+vy*ty;const rv=vx-dot*tx,rvy2=vy-dot*ty;vx=dot*tx*0.8-rv*0.3;vy=dot*ty*0.8-rvy2*0.3;x=h.hx+nx*(LIP+0.3);y=h.hy+ny*(LIP+0.3);if(!prac){setGs('lip');setMsg('Lip Out');setSub('Too much pace');setTimeout(()=>{setMsg(null);setSub(null);setGs('roll');},900);}}
          else if(cs>CAP_S){const pull=0.08+(1-dist/LIP)*0.12;vx-=nx*pull;vy-=ny*pull;vx*=0.965;vy*=0.965;}
        }
        if(dist<LIP*1.5&&cs<CAP_S*2){const gv=0.02*(1-dist/(LIP*1.5));vx-=nx*gv;vy-=ny*gv;}
      }
      setBp({x,y});
      if(cs<STOP){
        cancelAnimationFrame(raf.current);
        const fd=Math.sqrt((x-h.hx)**2+(y-h.hy)**2);
        if(fd<CAP_R+0.2){setBp({x:h.hx,y:h.hy});if(prac){endPrac('Nice Read!','Real putt next');return;}sndSink();doSunk();}
        else if(prac){endPrac('Practice Over','Now the real putt');}
        else{setGs('miss');setMsg(fd<LIP*1.5?'Close':'Missed');setSub(fd<LIP*1.5?'Almost':'Read the line');setTimeout(()=>{setMsg(null);setSub(null);setGs('aim');},1500);}
        return;
      }
      raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
  };

  const doSunk=async()=>{
    setGs('sunk');setSk(n=>n+1);setSc(n=>n+h.rw*10);setCl(n=>n+h.rw);
    setMsg('Sunk!');setSub(`+${h.rw} Clover${h.rw>1?'s':''}`);
    await addClovers(h.rw,`Putting: Hole ${h.id}`);await refreshProfile();
    setTimeout(()=>{setMsg(null);setSub(null);if(hi<cc.length-1){setHi(n=>n+1);setBp({x:50,y:88});setPrac(true);setGs('aim');}},2200);
  };
  const resetG=()=>{cancelAnimationFrame(raf.current);setNc(mk());setHi(0);setBp({x:50,y:88});setGs('aim');setSc(0);setPt(0);setSk(0);setCl(0);setMsg(null);setSub(null);setPrac(true);};
  const retry=()=>{cancelAnimationFrame(raf.current);setBp({x:50,y:88});setGs('aim');setMsg(null);setSub(null);};

  const aim=d0&&dc?{dx:d0.x-dc.x,dy:d0.y-dc.y}:null;
  const pw=aim?Math.min(Math.sqrt(aim.dx**2+aim.dy**2),MXD):0;
  const done=hi>=cc.length-1&&gs==='sunk';

  // Putter pose: aims at the hole by default, tracks the pull instantly
  // while dragging, then eases back to rest (transition duration below)
  // while `swing` plays out the forward stroke.
  // Square to the target by default (real address position), tracks the
  // drag while aiming, and freezes at the release angle during the swing.
  const idleAngle=Math.atan2(h.hy-bp.y,h.hx-bp.x);
  // Ignore the very first pixels of a drag for aiming — right at mousedown
  // pw is ~0 and atan2(0,0) would snap the club to a bogus angle before
  // snapping back once real movement starts. Below this threshold it just
  // keeps facing the hole, same as idle.
  const AIM_DEADZONE=1.2;
  const shotAngle=swing?swing.angle:(aim&&pw>AIM_DEADZONE?Math.atan2(aim.dy,aim.dx):idleAngle);
  // Pull sensitivity: +30% — the club reaches full pull-back with 30% less
  // drag distance than before (paired with the -30% PWK above, so a full
  // pull now looks bigger but hits softer — less twitchy overall).
  const PULL_SENS=1/0.7;
  const pullDist=swing?REST_GAP-CONTACT_DIP:aim?REST_GAP+Math.min((pw/MXD)*PULL_SENS,1)*MAX_PULL:REST_GAP;
  const stanceRad=shotAngle+Math.PI+STANCE_SKEW*Math.PI/180;
  const clubRotDeg=shotAngle*180/Math.PI-MALLET_FACE_NORMAL0;
  const clubHeadX=bp.x+Math.cos(stanceRad)*pullDist;
  const clubHeadY=bp.y+Math.sin(stanceRad)*pullDist;
  const showClub=gs==='aim'||!!swing;
  const clubDur=swing?0.22:0;

  // Log completed session to DB
  useEffect(() => {
    if (!done) return;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('practice_sessions').insert({
        user_id: user.id,
        drill_type: 'putting',
        duration_seconds: 0,
        score: sk,
        holes_completed: cc.length,
      });
    });
  }, [done]);

  const sm=Math.sqrt(h.sx*h.sx+h.sy*h.sy),hs=sm>0.1;
  // Real direction always (not just above the "Break" badge threshold), so even a
  // near-flat hole gets a faint, honest tint instead of a hard on/off cutoff.
  const la=Math.atan2(-h.sy,-h.sx)*(180/Math.PI),sa=la+180;
  // Concave curve (exponent < 1): boosts low-severity holes so they're not
  // invisible, and compresses high-severity holes toward the same ceiling so the
  // dark/light spread doesn't keep growing more extreme the steeper it gets.
  const it=Math.pow(Math.min(sm/0.7,1),0.55);
  const bPx=BR*2,HR_VIS=HR*1.12,hPx=HR_VIS*2,A=0.75; // HR_VIS: hole rendered ~12% larger than its physics radius (visual only)

  return(
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>nav('/practice')}><ArrowLeft className="w-5 h-5"/></Button>
          <div className="flex-1">
            <h1 className="text-xl font-black uppercase tracking-wider">Putting Pro</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Hole {hi+1}/{cc.length} · {h.label}{hs?' · Break':''}</p>
          </div>
          {prac&&gs==='aim'&&<span className="bg-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-yellow-500/30 animate-pulse" data-testid="practice-badge">Practice Mode</span>}
        </div>

        <div className="flex items-center justify-between glass-card p-2.5 text-center">
          <div><p className="text-[8px] text-muted-foreground uppercase tracking-widest">PTS</p><p className="text-lg font-black text-primary">{sc}</p></div>
          <div><p className="text-[8px] text-muted-foreground uppercase tracking-widest">PUTTS</p><p className="text-lg font-black">{pt}</p></div>
          <div><p className="text-[8px] text-muted-foreground uppercase tracking-widest">IN</p><p className="text-lg font-black text-green-400">{sk}/{cc.length}</p></div>
          <div><p className="text-[8px] text-muted-foreground uppercase tracking-widest">EARN</p><p className="text-lg font-black text-primary">+{cl}</p></div>
        </div>

        {/* Course view */}
        <div ref={gRef} className="relative select-none touch-none cursor-crosshair" style={{aspectRatio:'3/4'}}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up} data-testid="putting-green">

          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {/* Rough background */}
            <rect x="0" y="0" width="100" height="100" fill="#1B5E20" rx="4"/>
            {/* Bunkers */}
            {BUNKERS.map((b,i)=><path key={i} d={b} fill="#f5f0dc" stroke="#d4c9a8" strokeWidth="0.3" opacity="0.9"/>)}
            {/* Green */}
            <path d={GREEN_PATH} fill="#0b560b"/>
            <path d={GREEN_PATH} fill="url(#gGrad)" opacity="0.6"/>
            {/* Green inner glow */}
            <path d={GREEN_PATH} fill="none" stroke="rgba(74,222,128,0.08)" strokeWidth="0.5"/>
            <defs>
              <radialGradient id="gGrad" cx="50%" cy="25%" r="70%">
                <stop offset="0%" stopColor="#0f6b0f"/><stop offset="50%" stopColor="#084808"/><stop offset="100%" stopColor="#032d03"/>
              </radialGradient>
            </defs>
          </svg>

          {/* Topography overlays (clipped to green) */}
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            <defs><clipPath id="gc"><path d={GREEN_PATH}/></clipPath></defs>
            <g clipPath="url(#gc)">
              {/* Elevation shade: one continuous gradient along the slope axis — the
                  high (uphill) end reads lighter green, the low (downhill) end reads
                  darker/black, exactly like a contour map, instead of two separate
                  overlapping tints that were easy to lose against the turf. */}
              <rect x="0" y="0" width="100" height="100" fill="url(#tSlope)" opacity={0.16+0.44*it}/>
              {/* Bent grid — kept only as a faint texture cue now that the elevation
                  shade carries the actual break information (dimmed ~80%). */}
              {Array.from({length:7},(_,i)=>{const y=(i/6)*100;const cx=50+h.sx*12;const cy=y+h.sy*8;return<path key={`h${i}`} d={`M 0 ${y} Q ${cx} ${cy} 100 ${y}`} fill="none" stroke="#eab308" strokeWidth="0.3" opacity={0.02+0.07*it}/>;})}{Array.from({length:6},(_,i)=>{const x=(i/5)*100;const cx=x+h.sx*8;const cy=50+h.sy*12;return<path key={`v${i}`} d={`M ${x} 0 Q ${cx} ${cy} ${x} 100`} fill="none" stroke="#eab308" strokeWidth="0.3" opacity={0.02+0.07*it}/>;})}</g>
            <defs>
              {/* Single gradient along the downhill axis (rotated around the box CENTER,
                  0.5 0.5 — rotating around the default origin corner was the earlier bug:
                  it swung the visible band almost entirely outside the green). 0% is the
                  uphill/high end (lighter green), 100% is the downhill/low end (near-black),
                  with a transparent middle band so flat ground in between stays true green. */}
              <linearGradient id="tSlope" gradientTransform={`rotate(${sa} 0.5 0.5)`}>
                <stop offset="0%" stopColor="rgb(214,255,178)" stopOpacity="0.6"/>
                <stop offset="42%" stopColor="rgb(214,255,178)" stopOpacity="0"/>
                <stop offset="58%" stopColor="rgb(0,0,0)" stopOpacity="0"/>
                <stop offset="100%" stopColor="rgb(0,0,0)" stopOpacity="0.85"/>
              </linearGradient>
            </defs>
          </svg>

          {/* Break badge — larger */}
          {hs&&<div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 z-10 flex items-center gap-2">
            <span className="text-[10px] text-green-400 font-black uppercase tracking-widest">Break</span>
            <svg width="22" height="22" viewBox="0 0 22 22"><line x1="11" y1="11" x2={11+h.sx*5} y2={11+h.sy*5} stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#bk)"/><defs><marker id="bk" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6Z" fill="#4ade80"/></marker></defs></svg>
          </div>}

          {/* Hole — rendered at HR_VIS (~12% larger than HR); HR itself still drives
              physics (lip/capture) so this is a pure visual bump, not an easier hole. */}
          <div className="absolute rounded-full pointer-events-none" style={{width:`${(HR_VIS+2)*2}%`,aspectRatio:'1',left:`${h.hx-HR_VIS-2}%`,top:`${h.hy-(HR_VIS+2)*A}%`,background:'radial-gradient(circle,rgba(0,0,0,0.3) 20%,transparent 65%)'}}/>
          <div className="absolute rounded-full pointer-events-none" style={{width:`${(HR_VIS+0.5)*2}%`,aspectRatio:'1',left:`${h.hx-HR_VIS-0.5}%`,top:`${h.hy-(HR_VIS+0.5)*A}%`,background:'radial-gradient(circle at 42% 35%,#0c520c,#053005)',boxShadow:'inset 0 0.5px 1.5px rgba(255,255,255,0.07)'}}/>
          <div className="absolute rounded-full pointer-events-none" data-testid="putting-hole" style={{width:`${hPx}%`,aspectRatio:'1',left:`${h.hx-HR_VIS}%`,top:`${h.hy-HR_VIS*A}%`,background:'radial-gradient(circle at 50% 38%,#0a0a0a,#000)',boxShadow:'inset 0 3px 8px rgba(0,0,0,1)'}}/>
          <div className="absolute rounded-full pointer-events-none" style={{width:`${hPx*0.4}%`,aspectRatio:'1',left:`${h.hx-HR_VIS*0.4}%`,top:`${h.hy-HR_VIS*0.4*A+0.2}%`,background:'radial-gradient(circle,#000,rgba(0,0,0,0.6))'}}/>

          {/* Ball */}
          <div className="absolute rounded-full pointer-events-none z-[18]" style={{width:`${BR*3}%`,height:`${BR*1.5*A}%`,left:`${bp.x-BR*1.5}%`,top:`${bp.y+BR*A*0.3}%`,background:'radial-gradient(ellipse,rgba(0,0,0,0.35),transparent 65%)'}}/>
          <img src="/putting/golf-ball.png" alt="" className="absolute z-20 pointer-events-none" data-testid="putting-ball"
            style={{width:`${bPx}%`,height:'auto',aspectRatio:'1',left:`${bp.x}%`,top:`${bp.y}%`,transform:'translate(-50%,-50%)',filter:'drop-shadow(0 0.5px 1.5px rgba(0,0,0,0.45))'}}/>

          {/* Putter — addresses the ball, pulls back on aim, swings through on release.
              Real transparent-PNG head; x/y hold the anchor at its own origin so
              `rotate` spins the sprite around the front-of-head point, not its corner. */}
          {showClub&&<motion.img
            src={MALLET_IMG}
            alt=""
            className="absolute pointer-events-none z-[17]"
            style={{width:`${CLUB_IMG_W}%`,height:'auto',transformOrigin:`${MALLET_ANCHOR_X_PCT}% ${MALLET_ANCHOR_Y_PCT}%`}}
            animate={{left:`${clubHeadX}%`,top:`${clubHeadY}%`,x:`-${MALLET_ANCHOR_X_PCT}%`,y:`-${MALLET_ANCHOR_Y_PCT}%`,rotate:clubRotDeg}}
            transition={{duration:clubDur,ease:'easeIn'}}
            initial={false}
          />}

          {/* Aim */}
          {aim&&gs==='aim'&&<svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
            <line x1={bp.x} y1={bp.y} x2={bp.x+aim.dx*1.6} y2={bp.y+aim.dy*1.6} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="1.5,1.5"/>
            {Array.from({length:Math.min(Math.floor(pw/4),10)},(_,i)=>{const t=(i+1)/10;return<circle key={i} cx={bp.x+aim.dx*1.6*t} cy={bp.y+aim.dy*1.6*t} r={0.5+t*0.3} fill="white" opacity={0.15+t*0.5}/>;})}</svg>}

          {/* Power bar */}
          {aim&&gs==='aim'&&<div className="absolute bottom-2 left-3 right-3 z-10"><div className="bg-black/40 backdrop-blur-sm rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${pw<18?'bg-green-500':pw<35?'bg-yellow-500':'bg-red-500'}`} style={{width:`${(pw/MXD)*100}%`}}/></div></div>}

          {/* Practice instruction */}
          {prac&&gs==='aim'&&!d0&&<motion.div initial={{opacity:0}} animate={{opacity:[0,0.9,0]}} transition={{duration:3,repeat:Infinity}} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><div className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 rounded-lg px-3 py-1.5"><p className="text-[9px] text-yellow-300 font-bold uppercase tracking-widest">Practice shot — read the break</p></div></motion.div>}

          {/* Result */}
          <AnimatePresence>{msg&&<motion.div initial={{opacity:0,scale:0.5}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.5}} className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"><div className={`rounded-xl px-5 py-3 text-center backdrop-blur-md shadow-xl ${gs==='sunk'?'bg-primary/90':gs==='sand'?'bg-yellow-800/85':gs==='lip'?'bg-orange-600/85':'bg-black/65'}`}>
            {gs==='sunk'&&<Trophy className="w-7 h-7 text-yellow-400 mx-auto mb-1"/>}
            <p className="text-base font-black text-white uppercase tracking-wider">{msg}</p>
            {sub&&<p className="text-[10px] text-white/70 mt-0.5">{sub}</p>}
          </div></motion.div>}</AnimatePresence>
        </div>

        {done&&<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="glass-card p-5 text-center border-primary/50">
          <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-2"/><h2 className="text-lg font-black uppercase tracking-wider mb-1">Round Complete</h2>
          <p className="text-muted-foreground text-sm">{sk}/{cc.length} sunk · {pt} putts</p><p className="text-primary font-black text-lg mt-1">+{cl} Clovers</p>
        </motion.div>}

        <div className="flex gap-3">
          {(gs==='miss'||gs==='sand')&&<Button className="flex-1 font-bold uppercase tracking-wider text-xs" onClick={retry} data-testid="retry-btn"><RotateCcw className="w-4 h-4 mr-1"/> Retry</Button>}
          <Button variant="outline" className="flex-1 font-bold uppercase tracking-wider text-xs" onClick={resetG} data-testid="reset-game-btn"><RotateCcw className="w-4 h-4 mr-1"/> New Round</Button>
        </div>
      </div>
    </AppLayout>
  );
}
