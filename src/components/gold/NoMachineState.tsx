import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin } from "lucide-react";
import mascotImage from "@/assets/lucky-leprechaun-mascot.png";
interface NoMachineStateProps {
  onActivate?: () => void;
}
export const NoMachineState = ({
  onActivate
}: NoMachineStateProps) => {
  return <motion.div initial={{
    opacity: 0,
    scale: 0.95
  }} animate={{
    opacity: 1,
    scale: 1
  }} className="relative glass-card p-8 overflow-hidden text-center">
      {/* Background shimmer */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <motion.div animate={{
      background: ["radial-gradient(circle at 20% 50%, hsl(var(--primary) / 0.1) 0%, transparent 50%)", "radial-gradient(circle at 80% 50%, hsl(var(--accent) / 0.1) 0%, transparent 50%)", "radial-gradient(circle at 20% 50%, hsl(var(--primary) / 0.1) 0%, transparent 50%)"]
    }} transition={{
      duration: 5,
      repeat: Infinity
    }} className="absolute inset-0" />

      <div className="relative">
        {/* Mascot */}
        <motion.div animate={{
        y: [0, -10, 0]
      }} transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }} className="mb-6">
          <div className="relative w-32 h-32 mx-auto">
            {/* Soft circular glow behind mascot */}
            <div className="absolute inset-0 rounded-full" style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, hsl(var(--primary) / 0.1) 40%, transparent 70%)"
          }} />
            <img alt="Lucky Leprechaun" src="/lovable-uploads/15111a86-4b12-4ac2-8f1d-8f12c3c89a6b.png" className="relative w-full h-full object-contain drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)] opacity-100 border-0" />
          </div>
        </motion.div>

        {/* Irish message */}
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.3
      }}>
          <h2 className="text-2xl font-display font-bold mb-3 text-gradient-gold">
            Ah, there's no pot o' gold here yet!
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
            You must find the Lucky Leprechaun to build your gold machine!
          </p>
        </motion.div>

        {/* Hint box */}
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        delay: 0.5
      }} className="bg-primary/10 border border-primary/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-primary mb-2">
            <MapPin className="w-5 h-5" />
            <span className="font-semibold">How to find the Leprechaun</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Use your rangefinder on the course and look for the rainbow in AR mode. 
            Follow it to find the Lucky Leprechaun near the greens!
          </p>
        </motion.div>

        {/* Demo activate button */}
        {onActivate && <Button variant="gold" size="lg" onClick={onActivate} className="group">
            <Sparkles className="w-5 h-5 transition-transform group-hover:rotate-12" />
            Activate Machine (Demo)
          </Button>}

        {/* Floating clovers */}
        {[...Array(4)].map((_, i) => <motion.div key={i} animate={{
        y: [0, -20, 0],
        rotate: [0, 10, -10, 0],
        opacity: [0.3, 0.7, 0.3]
      }} transition={{
        duration: 3,
        delay: i * 0.7,
        repeat: Infinity
      }} className="absolute text-primary/30" style={{
        top: `${15 + i % 2 * 60}%`,
        left: `${5 + i * 25}%`
      }}>
            🍀
          </motion.div>)}
      </div>
    </motion.div>;
};