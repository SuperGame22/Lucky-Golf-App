import { motion } from "framer-motion";
import { GoldCoinIcon } from "@/components/icons/GoldCoinIcon";

type FlakeType = "flake" | "dust" | "sparkle";

interface GoldFlakeProps {
  type: FlakeType;
  delay: number;
  startX: number;
}

export const GoldFlake = ({ type, delay, startX }: GoldFlakeProps) => {
  const getFlakeElement = () => {
    switch (type) {
      case "flake":
        return (
          <div className="w-2 h-2 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 rounded-sm rotate-12 shadow-sm" />
        );
      case "sparkle":
        return (
          <svg className="w-2 h-2 text-yellow-300" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" />
          </svg>
        );
      case "dust":
        return (
          <div className="w-1 h-1 bg-accent/70 rounded-full blur-[0.5px]" />
        );
    }
  };

  // Much slower durations for gentle falling flakes
  const duration = type === "dust" ? 4 : type === "sparkle" ? 5 : 6;

  return (
    <motion.div
      initial={{ 
        y: 0, 
        x: startX,
        opacity: 0, 
        scale: type === "dust" ? 0.3 : 0.5,
        rotate: 0 
      }}
      animate={{
        y: [0, 20, 45],
        x: [startX, startX + (Math.random() - 0.5) * 8, startX],
        opacity: [0, 1, 0],
        scale: type === "dust" ? [0.3, 0.5, 0.3] : [0.5, 0.8, 0.6],
        rotate: [0, 20, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeIn",
      }}
      className="absolute"
    >
      {getFlakeElement()}
    </motion.div>
  );
};
