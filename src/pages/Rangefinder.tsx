import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { Eye, MapPin, Target, Crosshair, Flag, AlertTriangle } from "lucide-react";

const Rangefinder = () => {
  const [searchParams] = useSearchParams();
  const [arMode, setArMode] = useState(searchParams.get("ar") === "true");
  const [showClover, setShowClover] = useState(true);

  const distances = {
    front: 142,
    middle: 156,
    back: 168,
    hazard: 89,
  };

  const collectClover = () => {
    setShowClover(false);
  };

  return (
    <AppLayout>
      <div className="relative min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/20">
        {/* Course Background Overlay */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800')] bg-cover bg-center opacity-20" />
        
        <div className="relative flex-1 max-w-lg mx-auto px-4 py-6 w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <h1 className="text-xl font-display font-bold">Rangefinder</h1>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>Pebble Beach - Hole 7</span>
              </div>
            </div>
            <Button
              variant={arMode ? "gold" : "glass"}
              size="sm"
              onClick={() => setArMode(!arMode)}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              {arMode ? "AR ON" : "AR Mode"}
            </Button>
          </motion.div>

          {/* Main Distance Display */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative glass-card p-8 mb-6 text-center glow-green"
          >
            {/* Animated crosshair */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 flex items-center justify-center opacity-10"
            >
              <Crosshair className="w-40 h-40 text-primary" />
            </motion.div>

            <div className="relative">
              <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">Distance to Pin</p>
              <motion.div
                key={distances.middle}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                className="flex items-baseline justify-center gap-2"
              >
                <span className="text-7xl font-display font-bold text-gradient-green">
                  {distances.middle}
                </span>
                <span className="text-2xl text-muted-foreground">yds</span>
              </motion.div>

              <div className="flex justify-center gap-8 mt-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase">Front</p>
                  <p className="text-xl font-bold text-foreground">{distances.front}</p>
                </div>
                <div className="text-center">
                  <Flag className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-primary">{distances.middle}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase">Back</p>
                  <p className="text-xl font-bold text-foreground">{distances.back}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Hazard Alert */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-xl p-4 mb-6"
          >
            <AlertTriangle className="w-5 h-5 text-accent" />
            <div>
              <p className="text-sm font-medium text-accent">Water Hazard</p>
              <p className="text-xs text-muted-foreground">{distances.hazard} yards to carry</p>
            </div>
          </motion.div>

          {/* AR Mode Content */}
          <AnimatePresence>
            {arMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="space-y-4"
              >
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">AR Monocle Active</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Scanning for clovers and leprechauns...
                  </p>

                  {/* AR Discovery Area */}
                  <div className="relative aspect-video bg-muted/50 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    
                    {/* Simulated AR clover */}
                    <AnimatePresence>
                      {showClover && (
                        <motion.button
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                          whileHover={{ scale: 1.2 }}
                          onClick={collectClover}
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                        >
                          <motion.div
                            animate={{ 
                              y: [0, -5, 0],
                              filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <CloverIcon className="w-16 h-16 text-primary drop-shadow-[0_0_15px_hsl(152,76%,40%)]" />
                          </motion.div>
                          <p className="text-xs text-primary font-medium mt-2 text-center">Tap to collect!</p>
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {!showClover && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div className="text-center">
                          <motion.div
                            initial={{ scale: 1.5, opacity: 1 }}
                            animate={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            <CloverIcon className="w-20 h-20 text-primary" />
                          </motion.div>
                          <p className="text-lg font-display font-bold text-primary">+1 Clover!</p>
                          <p className="text-sm text-muted-foreground">Keep searching for more</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Rainbow indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 animate-rainbow" />
                    <div>
                      <p className="font-semibold">Rainbow Spotted!</p>
                      <p className="text-sm text-muted-foreground">Leprechaun near Hole 9 green</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Club Recommendation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-4 mt-6"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Suggested Club</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-lg">7 Iron</p>
                  <p className="text-sm text-muted-foreground">Avg: 150-160 yds</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Wind</p>
                <p className="font-medium">→ 8 mph</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Rangefinder;
