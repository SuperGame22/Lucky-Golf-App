import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { CloverProvider } from "@/contexts/CloverContext";
import { BottomNavigation } from "@/shared/components/BottomNavigation";
import { AmbientAudio } from "@/shared/components/AmbientAudio";
import { AuthProvider } from "@/contexts/AuthContext";
import { TierProvider } from "@/contexts/TierContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Domain Screens (5-tab architecture)
import HomeScreen from "@/domains/home/screens/HomeScreen";
import PracticeScreen from "@/domains/practice/screens/PracticeScreen";
import PlayScreen from "@/domains/play/screens/PlayScreen";
import CareerScreen from "@/domains/career/screens/CareerScreen";
import EarnScreen from "@/domains/earn/screens/EarnScreen";

// ── Play Sub-Routes ──
import Rangefinder from "./pages/Rangefinder";
import Course from "./pages/Course";
import Scorecard from "./pages/Scorecard";
import LuckyWagers from "./pages/play/Wagers";
import FoursomeFinder from "./pages/play/Foursome";
import PersonalCaddie from "./pages/play/Caddie";
import StartRound from "./pages/play/StartRound";

// ── Practice Sub-Routes ──
import PuttingGrid from "./pages/practice/Putting";
import DistanceControl from "./pages/practice/Distance";
import PracticeSessions from "./pages/practice/Sessions";
import PracticeProgress from "./pages/practice/Progress";

// ── Career Sub-Routes ──
import CareerStats from "./pages/career/Stats";
import ScorePatterns from "./pages/career/Patterns";
import Leaderboards from "./pages/career/Leaderboards";
import Achievements from "./pages/career/Achievements";

// ── Earn Sub-Routes ──
import GoldMachine from "./pages/GoldMachine";
import LuckySpin from "./pages/LuckySpin";
import Shop from "./pages/Shop";
import WeeklyRaffle from "./pages/earn/Raffle";
import CloverPacks from "./pages/earn/Packs";

// ── Cross-Domain ──
import Chat from "./pages/Chat";
import Membership from "./pages/Membership";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import CoachAce from "./pages/CoachAce";
import LuckyCoach from "./pages/LuckyCoach";
import ProfileEditor from "./pages/ProfileEditor";

// ── Admin ──
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminPromotions from "./pages/admin/Promotions";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TierProvider>
    <CloverProvider initialBalance={0}>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* ── Auth (public) ── */}
              <Route path="/auth" element={<Auth />} />

              {/* ── 5-Tab Domain Hubs ── */}
              <Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />
              <Route path="/practice" element={<ProtectedRoute><PracticeScreen /></ProtectedRoute>} />
              <Route path="/play" element={<ProtectedRoute><PlayScreen /></ProtectedRoute>} />
              <Route path="/career" element={<ProtectedRoute><CareerScreen /></ProtectedRoute>} />
              <Route path="/earn" element={<ProtectedRoute><EarnScreen /></ProtectedRoute>} />
              <Route path="/coach" element={<ProtectedRoute><LuckyCoach /></ProtectedRoute>} />
              <Route path="/coach/ace" element={<ProtectedRoute><CoachAce /></ProtectedRoute>} />
              <Route path="/profile/edit" element={<ProtectedRoute><ProfileEditor /></ProtectedRoute>} />

              {/* ── Play Sub-Routes ── */}
              <Route path="/play/rangefinder" element={<ProtectedRoute><Rangefinder /></ProtectedRoute>} />
              <Route path="/play/scorecard" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />
              <Route path="/play/wagers" element={<ProtectedRoute><LuckyWagers /></ProtectedRoute>} />
              <Route path="/play/flyover" element={<ProtectedRoute><Course /></ProtectedRoute>} />
              <Route path="/play/foursome" element={<ProtectedRoute><FoursomeFinder /></ProtectedRoute>} />
              <Route path="/play/caddie" element={<ProtectedRoute><PersonalCaddie /></ProtectedRoute>} />
              <Route path="/play/start" element={<ProtectedRoute><StartRound /></ProtectedRoute>} />
              <Route path="/play/round" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />
              <Route path="/play/rounds/:id" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />

              {/* ── Practice Sub-Routes ── */}
              <Route path="/practice/rangefinder" element={<ProtectedRoute><Rangefinder /></ProtectedRoute>} />
              <Route path="/practice/putting" element={<ProtectedRoute><PuttingGrid /></ProtectedRoute>} />
              <Route path="/practice/distance" element={<ProtectedRoute><DistanceControl /></ProtectedRoute>} />
              <Route path="/practice/sessions" element={<ProtectedRoute><PracticeSessions /></ProtectedRoute>} />
              <Route path="/practice/progress" element={<ProtectedRoute><PracticeProgress /></ProtectedRoute>} />

              {/* ── Career Sub-Routes ── */}
              <Route path="/career/stats" element={<ProtectedRoute><CareerStats /></ProtectedRoute>} />
              <Route path="/career/patterns" element={<ProtectedRoute><ScorePatterns /></ProtectedRoute>} />
              <Route path="/career/leaderboards" element={<ProtectedRoute><Leaderboards /></ProtectedRoute>} />
              <Route path="/career/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />

              {/* ── Earn Sub-Routes ── */}
              <Route path="/earn/spin" element={<ProtectedRoute><LuckySpin /></ProtectedRoute>} />
              <Route path="/earn/gold-machine" element={<ProtectedRoute><GoldMachine /></ProtectedRoute>} />
              <Route path="/earn/shop" element={<ProtectedRoute><Shop /></ProtectedRoute>} />
              <Route path="/earn/raffle" element={<ProtectedRoute><WeeklyRaffle /></ProtectedRoute>} />
              <Route path="/earn/packs" element={<ProtectedRoute><CloverPacks /></ProtectedRoute>} />

              {/* ── Legacy Route Aliases ── */}
              <Route path="/spin" element={<Navigate to="/earn/spin" replace />} />
              <Route path="/gold-machine" element={<Navigate to="/earn/gold-machine" replace />} />
              <Route path="/shop" element={<Navigate to="/earn/shop" replace />} />
              <Route path="/rangefinder" element={<Navigate to="/play/rangefinder" replace />} />
              <Route path="/scorecard" element={<Navigate to="/play/scorecard" replace />} />
              <Route path="/course" element={<Navigate to="/play/flyover" replace />} />
              <Route path="/wallet" element={<Navigate to="/earn" replace />} />
              <Route path="/profile" element={<Navigate to="/career" replace />} />

              {/* ── Cross-Domain ── */}
              <Route path="/membership" element={<ProtectedRoute><Membership /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

              {/* ── Admin ── */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/products" element={<ProtectedRoute><AdminProducts /></ProtectedRoute>} />
              <Route path="/admin/promotions" element={<ProtectedRoute><AdminPromotions /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            <BottomNavigation />
            <AmbientAudio />
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </CloverProvider>
    </TierProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
