import { motion } from "framer-motion";
import { GoldFlake } from "./GoldFlake";

interface GoldMachineVisualProps {
  machineLevel: number;
  isCollecting?: boolean;
}

export const GoldMachineVisual = ({ machineLevel, isCollecting }: GoldMachineVisualProps) => {
  const flakeTypes: Array<"flake" | "dust" | "sparkle"> = ["flake", "dust", "sparkle", "flake", "dust", "flake", "sparkle"];
  
  return (
    <div className="relative mx-auto w-72 h-80 mb-6">
      {/* Background magical aura */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute inset-0 bg-gradient-radial from-amber-500/20 via-transparent to-transparent rounded-full blur-2xl"
      />
      
      {/* Machine Container with pumping animation */}
      <motion.div
        animate={{ 
          y: [0, -2, 0],
          scale: [1, 1.01, 1]
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-52 h-52"
      >
        {/* Main Machine Body - Steampunk Gold Style */}
        <div className="relative w-full h-full">
          {/* Machine Base */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-40 bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 rounded-lg shadow-2xl border-2 border-yellow-400 overflow-hidden">
            {/* Metal texture overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3)_0%,transparent_50%)]" />
            
            {/* Viewing window */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-12 bg-gradient-to-b from-amber-900/80 to-amber-800/60 rounded-lg border-2 border-yellow-300/60 overflow-hidden">
              {/* Swirling gold inside */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-300/80 rounded-full blur-sm" />
                <div className="absolute top-1 left-2 w-1.5 h-1.5 bg-yellow-200/70 rounded-full blur-[1px]" />
                <div className="absolute bottom-1 right-2 w-1.5 h-1.5 bg-amber-300/70 rounded-full blur-[1px]" />
              </motion.div>
              {/* Glass reflection */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
            </div>

            {/* Pressure Gauge */}
            <div className="absolute top-4 right-4 w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full border-2 border-yellow-600 shadow-inner">
              <div className="absolute inset-1 rounded-full border border-amber-400/50" />
              {/* Gauge markings */}
              <div className="absolute top-1 left-1/2 w-0.5 h-1 bg-amber-700 -translate-x-1/2" />
              <div className="absolute bottom-1 left-1/2 w-0.5 h-1 bg-amber-700 -translate-x-1/2" />
              <div className="absolute left-1 top-1/2 w-1 h-0.5 bg-amber-700 -translate-y-1/2" />
              <div className="absolute right-1 top-1/2 w-1 h-0.5 bg-amber-700 -translate-y-1/2" />
              {/* Needle */}
              <motion.div
                animate={{ rotate: [-20, 40, -20] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 w-0.5 h-3 bg-red-600 origin-bottom -translate-x-1/2 -translate-y-full rounded-full"
              />
              <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-amber-600 rounded-full -translate-x-1/2 -translate-y-1/2" />
            </div>

            {/* Rotating Gear */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-4 right-4"
            >
              <svg width="32" height="32" viewBox="0 0 32 32">
                <defs>
                  <linearGradient id="gearGold" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="50%" stopColor="#FBBF24" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>
                </defs>
                <path
                  d="M16 4l2 3h3l1 3 3 1v3l3 2-3 2v3l-3 1-1 3h-3l-2 3-2-3h-3l-1-3-3-1v-3l-3-2 3-2v-3l3-1 1-3h3l2-3z"
                  fill="url(#gearGold)"
                  stroke="#92400E"
                  strokeWidth="0.5"
                />
                <circle cx="16" cy="16" r="4" fill="#78350F" />
                <circle cx="16" cy="16" r="2" fill="#451A03" />
              </svg>
            </motion.div>

            {/* Secondary smaller gear */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-8 right-10"
            >
              <svg width="20" height="20" viewBox="0 0 32 32">
                <path
                  d="M16 4l2 3h3l1 3 3 1v3l3 2-3 2v3l-3 1-1 3h-3l-2 3-2-3h-3l-1-3-3-1v-3l-3-2 3-2v-3l3-1 1-3h3l2-3z"
                  fill="url(#gearGold)"
                  stroke="#92400E"
                  strokeWidth="0.5"
                />
                <circle cx="16" cy="16" r="3" fill="#78350F" />
              </svg>
            </motion.div>

            {/* Pipes on left side */}
            <div className="absolute left-2 top-8 w-3 h-20 bg-gradient-to-r from-amber-600 to-amber-500 rounded-full border border-yellow-400" />
            <div className="absolute left-1 top-6 w-5 h-3 bg-gradient-to-b from-amber-500 to-amber-600 rounded-t-full border border-yellow-400" />
            
            {/* Status lights */}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2.5 h-2.5 bg-green-400 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"
              />
              <motion.div
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                className="w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.6)]"
              />
            </div>

            {/* Rivets */}
            {[
              { top: 2, left: 2 },
              { top: 2, right: 2 },
              { bottom: 2, left: 2 },
              { bottom: 2, right: 2 },
            ].map((pos, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full shadow-inner"
                style={pos as any}
              />
            ))}

            {/* Shimmer effect */}
            <motion.div
              animate={{ x: [-80, 120] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-10 bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12"
            />
          </div>

          {/* Top domes/tanks */}
          <div className="absolute top-0 left-6 w-10 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-t-full border-2 border-yellow-400">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4)_0%,transparent_50%)] rounded-t-full" />
          </div>
          <div className="absolute top-2 right-6 w-8 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-t-full border-2 border-yellow-400">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4)_0%,transparent_50%)] rounded-t-full" />
          </div>

          {/* Connecting pipe on top */}
          <div className="absolute top-4 left-14 w-10 h-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full border border-yellow-400" />
        </div>

        {/* Level badge */}
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-1 -right-1 bg-gradient-to-br from-primary to-lucky-emerald text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full z-10 shadow-lg border border-primary/50"
        >
          Lv.{machineLevel}
        </motion.div>
      </motion.div>

      {/* Output Spout - centered and pointing toward pot */}
      <div className="absolute top-[175px] left-1/2 -translate-x-1/2 z-20">
        {/* Spout body */}
        <div className="relative">
          <div className="w-6 h-12 bg-gradient-to-b from-amber-500 to-amber-700 rounded-b-lg border-2 border-yellow-400 shadow-lg">
            {/* Spout opening */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-2 bg-amber-900/80 rounded-b" />
            {/* Flow effect inside spout */}
            <motion.div
              animate={{ y: [-10, 16] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-x-1 h-4 bg-gradient-to-b from-transparent via-yellow-300/50 to-transparent rounded"
            />
          </div>
          
          {/* Spout attachment flange */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-3 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 rounded-full border border-yellow-400 shadow-md" />
        </div>
      </div>

      {/* Gold pot at bottom - centered */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-0">
        <motion.div
          animate={isCollecting ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: isCollecting ? Infinity : 0 }}
          className="relative"
        >
          {/* Pot body - slightly smaller */}
          <div className="w-20 h-12 bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 rounded-b-full rounded-t-lg border-2 border-yellow-400 shadow-lg overflow-hidden">
            {/* Gold fill inside */}
            <div className="absolute bottom-0 left-0 right-0 h-7 bg-gradient-to-t from-yellow-400 via-yellow-300 to-yellow-400/80 rounded-b-full">
              {/* Glittering gold bits */}
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute bottom-1 left-2 w-1.5 h-1.5 bg-yellow-200 rounded-full"
              />
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                className="absolute bottom-2 right-3 w-2 h-2 bg-amber-300 rounded-full"
              />
              <motion.div
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
                className="absolute bottom-1 left-1/2 w-2 h-2 bg-yellow-300 rounded-full"
              />
            </div>
            {/* Shimmer */}
            <motion.div
              animate={{ x: [-25, 35] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-5 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
            />
          </div>
          {/* Pot rim */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-24 h-2.5 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 rounded-full border border-yellow-400" />
        </motion.div>
      </div>

      {/* Falling gold flakes from spout - positioned to fall from spout tip into pot */}
      <div className="absolute top-[235px] left-1/2 -translate-x-1/2 z-10">
        {flakeTypes.map((type, i) => (
          <GoldFlake 
            key={i} 
            type={type} 
            delay={i * 0.8} 
            startX={(i % 3 - 1) * 3}
          />
        ))}
      </div>

      {/* Ambient sparkles */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={`sparkle-${i}`}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2.5,
            delay: i * 0.6,
            repeat: Infinity,
          }}
          className="absolute"
          style={{
            top: `${20 + i * 15}%`,
            left: i % 2 === 0 ? '8%' : '85%',
          }}
        >
          <div className="w-2 h-2 bg-yellow-300 rounded-full blur-[1px]" />
        </motion.div>
      ))}
    </div>
  );
};