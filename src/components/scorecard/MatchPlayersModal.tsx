import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, MapPin, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NearbyPlayer {
  id: string;
  name: string;
  luckyLevel: number;
  distance: number;
  teeTime: string;
  avatar: string;
}

const mockPlayers: NearbyPlayer[] = [
  { id: "1", name: "Alex Chen", luckyLevel: 4, distance: 2.3, teeTime: "9:15 AM", avatar: "👨" },
  { id: "2", name: "Jordan Smith", luckyLevel: 3, distance: 4.8, teeTime: "9:30 AM", avatar: "👩" },
  { id: "3", name: "Casey Davis", luckyLevel: 4, distance: 1.2, teeTime: "9:00 AM", avatar: "🧔" },
  { id: "4", name: "Taylor Ryan", luckyLevel: 5, distance: 6.1, teeTime: "10:00 AM", avatar: "🧑" },
  { id: "5", name: "Morgan Lee", luckyLevel: 3, distance: 8.5, teeTime: "9:45 AM", avatar: "👨" },
];

interface MatchPlayersModalProps {
  userLuckyLevel: number;
  onClose: () => void;
}

export const MatchPlayersModal = ({ userLuckyLevel, onClose }: MatchPlayersModalProps) => {
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  const togglePlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleJoinGame = () => {
    if (selectedPlayers.size === 0) {
      toast.error("Select at least one player to join");
      return;
    }
    toast.success(`Matched with ${selectedPlayers.size} player${selectedPlayers.size > 1 ? "s" : ""}! 🏌️`);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="glass-card p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold">Nearby Golfers</h3>
              <p className="text-xs text-muted-foreground">Match within 1-2 Lucky Levels</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Players List */}
        <div className="space-y-2">
          {mockPlayers.map((player, index) => {
            const isSelected = selectedPlayers.has(player.id);
            const levelDiff = Math.abs(player.luckyLevel - userLuckyLevel);
            const isCompatible = levelDiff <= 2;

            return (
              <motion.button
                key={player.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => togglePlayer(player.id)}
                className={`w-full p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "bg-muted/30 border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/50"
                    }`}
                  >
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>

                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium truncate">{player.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {/* Lucky Level Stars */}
                        <div className="flex gap-0.5">
                          {Array.from({ length: Math.min(5, player.luckyLevel) }).map((_, i) => (
                            <span key={i} className="text-xs">⭐</span>
                          ))}
                        </div>
                        <span>•</span>
                        <MapPin className="w-3 h-3" />
                        <span>{player.distance} mi</span>
                      </div>
                    </div>

                  {/* Tee Time */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{player.teeTime}</span>
                  </div>
                </div>

                {/* Compatibility Indicator */}
                {!isCompatible && (
                  <p className="text-xs text-muted-foreground mt-2 ml-9">
                    ⚠️ Different skill level
                  </p>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Info */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
          <p>
            💡 <strong>Tip:</strong> You're Lucky Level <strong>{userLuckyLevel}</strong>. Match with players at similar levels for better games!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleJoinGame}
            disabled={selectedPlayers.size === 0}
            className="flex-1 bg-accent hover:bg-accent/90"
          >
            Join Game ({selectedPlayers.size > 0 ? selectedPlayers.size : "select"})
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
