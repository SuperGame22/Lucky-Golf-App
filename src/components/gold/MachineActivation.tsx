import { motion } from "framer-motion";
import { GoldCoinIcon } from "@/components/icons/GoldCoinIcon";
import { Sparkles } from "lucide-react";
import mascotImage from "@/assets/leprechaun-mascot-transparent.png";

interface MachineActivationProps {
  onComplete: () => void;
}

export const MachineActivation = ({ onComplete }: MachineActivationProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onComplete}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="relative p-8 text-center"
      >
        {/* Magical burst */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: [0, 3, 4],
            opacity: [0, 0.8, 0],
          }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary rounded-full blur-xl"
        />

        {/* Rainbow explosion */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0, rotate: i * 30 }}
            animate={{ 
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
              x: [0, Math.cos(i * 30 * Math.PI / 180) * 150],
              y: [0, Math.sin(i * 30 * Math.PI / 180) * 150],
            }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full"
            style={{
              background: `hsl(${i * 30}, 70%, 50%)`,
            }}
          />
        ))}

        {/* Gold coins bursting */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={`coin-${i}`}
            initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
            animate={{ 
              scale: [0, 1.5, 1],
              opacity: [0, 1, 0],
              x: [0, (Math.random() - 0.5) * 200],
              y: [0, (Math.random() - 0.5) * 200],
              rotate: [0, 360],
            }}
            transition={{ duration: 1.5, delay: 0.5 + i * 0.1 }}
            className="absolute left-1/2 top-1/2"
          >
            <GoldCoinIcon className="w-8 h-8 text-accent" />
          </motion.div>
        ))}

        {/* Mascot dancing */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ 
            y: 0, 
            opacity: 1,
            rotate: [0, -5, 5, 0],
          }}
          transition={{ 
            y: { duration: 0.5, delay: 0.2 },
            rotate: { duration: 0.5, delay: 0.7, repeat: 2 }
          }}
          className="relative z-10 mb-4"
        >
          <img 
            src={mascotImage} 
            alt="Lucky Leprechaun" 
            className="w-40 h-40 object-contain mx-auto drop-shadow-2xl"
          />
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="relative z-10"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, delay: 1.2 }}
          >
            <h2 className="text-3xl font-display font-bold text-gradient-gold mb-2 flex items-center justify-center gap-2">
              <Sparkles className="w-8 h-8 text-accent" />
              Top o' the mornin'!
              <Sparkles className="w-8 h-8 text-accent" />
            </h2>
          </motion.div>
          <p className="text-xl text-foreground">Your Gold Machine is ready!</p>
          <p className="text-sm text-muted-foreground mt-2">Tap anywhere to continue</p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};