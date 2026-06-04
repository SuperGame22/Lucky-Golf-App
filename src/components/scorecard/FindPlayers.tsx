import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Clock, MapPin, Send, Check, X, DollarSign, Trophy, Wallet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloverIcon } from "@/components/icons/CloverIcon";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useWallet } from "@/contexts/WalletContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CompetitionPlayer {
  id: string;
  user_id: string;
  has_paid: boolean;
}

interface Competition {
  id: string;
  course_name: string | null;
  buy_in: number;
  pot_total: number;
  status: string;
  tee_time: string | null;
  created_at: string;
  creator_id: string | null;
  competition_players: CompetitionPlayer[];
}

const BUY_IN_OPTIONS = [5, 10, 20, 50];

interface FindPlayersProps {
  userLuckyLevel: number;
}

export const FindPlayers = ({ userLuckyLevel }: FindPlayersProps) => {
  const [showCreateInvite, setShowCreateInvite] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [isCompetition, setIsCompetition] = useState(false);
  const [selectedBuyIn, setSelectedBuyIn] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const { balance, refreshWallet } = useWallet();

  // Fetch competitions from database
  const fetchCompetitions = async () => {
    try {
      const { data, error } = await supabase
        .from("competitions")
        .select(`
          *,
          competition_players (
            id,
            user_id,
            has_paid
          )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompetitions(data || []);
    } catch (error) {
      console.error("Error fetching competitions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Fetch competitions on mount
  useEffect(() => {
    fetchCompetitions();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("competitions-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competitions",
        },
        () => fetchCompetitions()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_players",
        },
        () => fetchCompetitions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleJoinCompetition = async (competitionId: string) => {
    if (!currentUserId) {
      toast.error("Please sign in to join competitions");
      return;
    }

    setIsJoining(competitionId);

    try {
      const { data, error } = await supabase.rpc("join_competition", {
        p_competition_id: competitionId,
        p_user_id: currentUserId,
      });

      if (error) {
        if (error.message.includes("Insufficient funds")) {
          toast.error("Insufficient funds");
        } else if (error.message.includes("already joined")) {
          toast.error("You have already joined this competition");
        } else {
          toast.error(error.message || "Failed to join competition");
        }
        return;
      }

      await refreshWallet();
      await fetchCompetitions();
      toast.success("You're in! Competition joined successfully 🏆");
    } catch (error) {
      console.error("Error joining competition:", error);
      toast.error("Failed to join competition");
    } finally {
      setIsJoining(null);
    }
  };

  const handleCreateCompetition = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to create competitions");
      return;
    }

    if (!isCompetition) {
      toast.info("Non-competition tee times coming soon!");
      setShowCreateInvite(false);
      return;
    }

    if (balance < selectedBuyIn) {
      toast.error(`Insufficient funds. Need $${selectedBuyIn.toFixed(2)}`);
      return;
    }

    setIsCreating(true);

    try {
      const teeTime = new Date();
      teeTime.setDate(teeTime.getDate() + 1); // Tomorrow
      teeTime.setHours(9, 0, 0, 0);

      const { data, error } = await supabase.rpc("create_competition", {
        p_user_id: currentUserId,
        p_buy_in: selectedBuyIn,
        p_course_name: "Pebble Beach",
        p_tee_time: teeTime.toISOString(),
      });

      if (error) {
        if (error.message.includes("Insufficient funds")) {
          toast.error("Insufficient funds");
        } else {
          toast.error(error.message || "Failed to create competition");
        }
        return;
      }

      await refreshWallet();
      await fetchCompetitions();
      setShowCreateInvite(false);
      toast.success(`Competition created! $${selectedBuyIn} pot started 🏆`);
    } catch (error) {
      console.error("Error creating competition:", error);
      toast.error("Failed to create competition");
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return date.toLocaleDateString("en-US", { weekday: "long" });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-primary/20 rounded-xl">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold">Find Yer Foursome</h3>
            <p className="text-xs text-muted-foreground">
              Connect with players at your Lucky Level
            </p>
          </div>
        </div>

        {/* Available players at similar level */}
        <div className="flex items-center gap-2 mb-4">
          <p className="text-sm text-muted-foreground">Players nearby:</p>
          <div className="flex -space-x-2">
            {["🧔", "👨", "👩", "🧑"].map((avatar, idx) => (
              <div
                key={idx}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-lg border-2 border-background"
              >
                {avatar}
              </div>
            ))}
          </div>
          <span className="text-xs text-primary font-medium">+12 more</span>
        </div>

        <Button
          variant="lucky"
          className="w-full"
          onClick={() => setShowCreateInvite(true)}
        >
          <Send className="w-4 h-4 mr-2" />
          Create Tee Time Invite
        </Button>
      </div>

      {/* Create Invite Modal */}
      <AnimatePresence>
        {showCreateInvite && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 border-2 border-primary/30"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-display font-bold">New Tee Time</h4>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCreateInvite(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>Pebble Beach Golf Links</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Tomorrow, 9:00 AM</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CloverIcon className="w-4 h-4 text-primary" />
                <span>
                  Inviting players at <strong>Lucky Level {userLuckyLevel}</strong>
                </span>
              </div>
            </div>

            {/* Competition Toggle */}
            <div className="bg-muted/50 rounded-xl p-4 mb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  <Label htmlFor="competition-mode" className="font-medium">
                    Competition Mode
                  </Label>
                </div>
                <Switch
                  id="competition-mode"
                  checked={isCompetition}
                  onCheckedChange={setIsCompetition}
                />
              </div>

              <AnimatePresence>
                {isCompetition && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      Winner takes all! Lowest score wins the pot.
                    </p>
                    
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Buy-in Amount</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {BUY_IN_OPTIONS.map((amount) => (
                          <Button
                            key={amount}
                            variant={selectedBuyIn === amount ? "lucky" : "outline"}
                            size="sm"
                            onClick={() => setSelectedBuyIn(amount)}
                            className="text-sm"
                          >
                            ${amount}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm bg-accent/10 rounded-lg p-3">
                      <span className="text-muted-foreground">Pot Total (4 players):</span>
                      <span className="font-bold text-accent">${selectedBuyIn * 4}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Wallet className="w-3 h-3" />
                      <span>Your balance: ${balance.toFixed(2)}</span>
                      {balance < selectedBuyIn && (
                        <span className="text-destructive">(Need ${(selectedBuyIn - balance).toFixed(2)} more)</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button 
              variant="lucky" 
              className="w-full" 
              onClick={handleCreateCompetition}
              disabled={(isCompetition && balance < selectedBuyIn) || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : isCompetition ? (
                <>
                  <Trophy className="w-4 h-4 mr-2" />
                  Create ${selectedBuyIn} Competition
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Invite to 12 Players
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && (
        <div className="glass-card p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Active Competitions */}
      {!isLoading && competitions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground px-1">
            Open Competitions
          </h4>
          {competitions.map((competition) => {
            const playerCount = competition.competition_players?.length || 0;
            const maxPlayers = 4;
            const spotsLeft = maxPlayers - playerCount;
            const isFull = spotsLeft === 0;
            const hasJoined = competition.competition_players?.some(
              (p) => p.user_id === currentUserId
            );
            const canAfford = balance >= competition.buy_in;

            return (
              <motion.div
                key={competition.id}
                layout
                className={`glass-card p-4 ${
                  isFull ? "border-2 border-primary/50 bg-primary/5" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {competition.course_name || "Golf Course"}
                      </p>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        ${competition.pot_total} Pot
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(competition.tee_time)} at{" "}
                      {formatTime(competition.tee_time)}
                    </p>
                  </div>
                  {isFull ? (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                      Foursome Complete! ⛳
                    </span>
                  ) : (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                      {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex -space-x-2">
                    {competition.competition_players?.map((player, idx) => (
                      <div
                        key={player.id}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-lg border-2 border-background ${
                          player.user_id === currentUserId
                            ? "bg-primary/20"
                            : "bg-muted"
                        }`}
                      >
                        {player.user_id === currentUserId ? "🍀" : ["🧔", "👨", "👩", "🧑"][idx % 4]}
                      </div>
                    ))}
                    {Array.from({ length: spotsLeft }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="w-8 h-8 rounded-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center"
                      >
                        <span className="text-muted-foreground/50 text-xs">?</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ${competition.buy_in} buy-in
                  </span>
                </div>

                {!isFull && !hasJoined && (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={() => handleJoinCompetition(competition.id)}
                    disabled={!canAfford || isJoining === competition.id}
                  >
                    {isJoining === competition.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4 mr-1" />
                        Join for ${competition.buy_in}
                        {!canAfford && " (Insufficient funds)"}
                      </>
                    )}
                  </Button>
                )}

                {hasJoined && !isFull && (
                  <p className="text-center text-sm text-primary font-medium">
                    You're in! Waiting for more players...
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && competitions.length === 0 && (
        <div className="glass-card p-6 text-center">
          <Trophy className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No open competitions yet. Create one to get started!
          </p>
        </div>
      )}
    </motion.div>
  );
};
