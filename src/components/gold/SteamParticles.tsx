import { motion } from "framer-motion";

interface SteamParticlesProps {
  count?: number;
  className?: string;
}

export const SteamParticles = ({ count = 5, className = "" }: SteamParticlesProps) => {
  return (
    <div className={`absolute pointer-events-none ${className}`}>
      {[...Array(count)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            y: 0, 
            x: (i - count/2) * 4,
            opacity: 0,
            scale: 0.3 
          }}
          animate={{
            y: [-5, -30, -50],
            x: [(i - count/2) * 4, (i - count/2) * 8 + Math.sin(i) * 10, (i - count/2) * 12],
            opacity: [0, 0.6, 0],
            scale: [0.3, 0.8, 1.2],
          }}
          transition={{
            duration: 2 + i * 0.3,
            delay: i * 0.4,
            repeat: Infinity,
            ease: "easeOut",
          }}
          className="absolute w-3 h-3 bg-muted-foreground/30 rounded-full blur-sm"
        />
      ))}
    </div>
  );
};
