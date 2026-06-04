import { motion } from "framer-motion";
import { GoldCoinIcon } from "@/components/icons/GoldCoinIcon";

interface GoldPotProps {
  isCollecting?: boolean;
}

export const GoldPot = ({ isCollecting }: GoldPotProps) => {
  return (
    <motion.div
      animate={isCollecting ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.5, repeat: isCollecting ? Infinity : 0 }}
      className="relative"
    >
      {/* Celtic knot decoration behind pot */}
      <svg className="absolute -top-2 left-1/2 -translate-x-1/2 w-28 h-8 opacity-40" viewBox="0 0 100 30">
        <path
          d="M10 15 Q25 5 40 15 Q55 25 70 15 Q85 5 95 15"
          fill="none"
          stroke="hsl(var(--lucky-gold))"
          strokeWidth="2"
        />
        <path
          d="M10 15 Q25 25 40 15 Q55 5 70 15 Q85 25 95 15"
          fill="none"
          stroke="hsl(var(--lucky-gold))"
          strokeWidth="2"
        />
      </svg>

      {/* Main pot */}
      <div className="relative w-32 h-24">
        {/* Pot rim with Celtic pattern */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gradient-to-b from-amber-500 to-amber-700 rounded-t-lg overflow-hidden border-2 border-amber-400">
          {/* Celtic knot on rim */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-18 h-2 border border-amber-900/50 rounded-full" />
          </div>
        </div>
        
        {/* Pot body - fuller and larger */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-20 bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-600 rounded-b-[50%] shadow-lg overflow-hidden animate-pulse-glow border-2 border-amber-400">
          {/* Celtic knot pattern on pot */}
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 70">
            <path
              d="M20 35 Q30 20 50 35 Q70 50 80 35"
              fill="none"
              stroke="hsl(var(--background))"
              strokeWidth="3"
            />
            <circle cx="30" cy="45" r="8" fill="none" stroke="hsl(var(--background))" strokeWidth="2" />
            <circle cx="70" cy="45" r="8" fill="none" stroke="hsl(var(--background))" strokeWidth="2" />
          </svg>
          
          {/* Gold filled inside pot - more gold visible */}
          <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-yellow-300 via-yellow-400 to-amber-400" />
          
          {/* Shimmer effect */}
          <motion.div
            animate={{ x: [-50, 80] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 w-10 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
          />
          
          {/* Rainbow reflection */}
          <motion.div
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gradient-to-br from-red-400/30 via-yellow-400/30 to-green-400/30 blur-md"
          />
        </div>
        
        {/* Overflowing coins - more coins for fuller look */}
        <motion.div
          animate={{ y: [0, -3, 0], rotate: [-5, 5, -5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-1 left-3"
        >
          <GoldCoinIcon className="w-6 h-6 text-amber-300" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -2, 0], rotate: [5, -5, 5] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
          className="absolute -top-3 left-1/2 -translate-x-1/2"
        >
          <GoldCoinIcon className="w-7 h-7 text-yellow-400" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -3, 0], rotate: [-3, 3, -3] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: 0.5 }}
          className="absolute -top-1 right-3"
        >
          <GoldCoinIcon className="w-6 h-6 text-amber-300" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -2, 0], rotate: [3, -3, 3] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 0.7 }}
          className="absolute -top-2 left-8"
        >
          <GoldCoinIcon className="w-5 h-5 text-yellow-300" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -2, 0], rotate: [-4, 4, -4] }}
          transition={{ duration: 1.9, repeat: Infinity, delay: 0.4 }}
          className="absolute -top-2 right-8"
        >
          <GoldCoinIcon className="w-5 h-5 text-yellow-300" />
        </motion.div>
      </div>

      {/* Glow effect under pot */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-accent/40 rounded-full blur-xl" />
    </motion.div>
  );
};
