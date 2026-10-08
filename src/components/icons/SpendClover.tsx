import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import cloverOutline from "@/assets/clover-outline.png";
import leaf1 from "@/assets/clover-leaf-1.png";
import leaf2 from "@/assets/clover-leaf-2.png";
import leaf3 from "@/assets/clover-leaf-3.png";
import leaf4 from "@/assets/clover-leaf-4.png";

interface SpendCloverProps {
  className?: string;
  litLeaves: number;
  earnedPulse: number;
}

export const SpendClover = ({ className = "", litLeaves, earnedPulse }: SpendCloverProps) => {
  const [showEarnedEffect, setShowEarnedEffect] = useState(false);
  const [lastPulse, setLastPulse] = useState(earnedPulse);

  useEffect(() => {
    if (earnedPulse > lastPulse) {
      setShowEarnedEffect(true);
      setLastPulse(earnedPulse);
      const timer = setTimeout(() => setShowEarnedEffect(false), 600);
      return () => clearTimeout(timer);
    }
  }, [earnedPulse, lastPulse]);

  // Each fill is a PNG cut from clover-outline.png at the same pixel size, so every layer
  // below shares one box, one object-fit and one scale and lines up with the outline exactly.
  const leaves = [
    { id: 1, src: leaf1 }, // top-left
    { id: 2, src: leaf2 }, // top-right
    { id: 3, src: leaf3 }, // bottom-left
    { id: 4, src: leaf4 }, // bottom-right
  ];

  return (
    <div className={`relative ${className}`} style={{ aspectRatio: "1" }}>
      {/* Outline and fills in one wrapper so they scale together */}
      <div className="absolute inset-0" style={{ transform: "scale(1.45)" }}>
        {/* Leaf fills - behind the outline */}
        {leaves.map((leaf) => (
          <img
            key={leaf.id}
            src={leaf.src}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-150"
            style={{
              opacity: litLeaves >= leaf.id ? 0.65 : 0,
              filter: "drop-shadow(0 0 5px hsl(142 71% 45%))",
            }}
          />
        ))}

        {/* Clover outline on top */}
        <img
          src={cloverOutline}
          alt="Clover"
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>

      {/* Glow effect when earning */}
      <AnimatePresence>
        {showEarnedEffect && (
          <motion.div
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-primary/30 rounded-full blur-xl"
          />
        )}
      </AnimatePresence>

      {/* Floating +1 indicator */}
      <AnimatePresence>
        {showEarnedEffect && (
          <motion.div
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -30, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-primary font-bold text-lg"
          >
            +1
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
