import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { CloverProvider } from "@/contexts/CloverContext";
import { BottomNavigation } from "@/shared/components/BottomNavigation";
import { AuthProvider } from "@/contexts/AuthContext";
import { TierProvider } from "@/contexts/TierContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PageFade } from "@/components/PageFade";
import { ContactSync } from "@/components/ContactSync";
import { PurchaseSync } from "@/components/PurchaseSync";
import JoinInvite from "./pages/JoinInvite";
const Pay = lazy(() => import("./pages/pay/Pay"));
const PayReturn = lazy(() => import("./pages/pay/PayReturn"));

// Domain Screens (5-tab architecture)
import HomeScreen from "@/domains/home/screens/HomeScreen";
import PracticeScreen from "@/domains/practice/screens/PracticeScreen";
import PlayScreen from "@/domains/play/screens/PlayScreen";
import CareerScreen from "@/domains/career/screens/CareerScreen";
import EarnScreen from "@/domains/earn/screens/EarnScreen";

// ── Play Sub-Routes ──
const Rangefinder = lazy(() => import("./pages/Rangefinder"));
const Course = lazy(() => import("./pages/Course"));
const Scorecard = lazy(() => import("./pages/Scorecard"));
const LuckyWagers = lazy(() => import("./pages/play/Wagers"));
const FoursomeFinder = lazy(() => import("./pages/play/Foursome"));
const PersonalCaddie = lazy(() => import("./pages/play/Caddie"));
const StartRound = lazy(() => import("./pages/play/StartRound"));

// ── Practice Sub-Routes ──
const PuttingGrid = lazy(() => import("./pages/practice/Putting"));
const DistanceControl = lazy(() => import("./pages/practice/Distance"));
const PracticeSessions = lazy(() => import("./pages/practice/Sessions"));
const PracticeProgress = lazy(() => import("./pages/practice/Progress"));

// ── Career Sub-Routes ──
const CareerStats = lazy(() => import("./pages/career/Stats"));
const ScorePatterns = lazy(() => import("./pages/career/Patterns"));
const Leaderboards = lazy(() => import("./pages/career/Leaderboards"));
const Achievements = lazy(() => import("./pages/career/Achievements"));

// ── Earn Sub-Routes ──
const GoldMachine = lazy(() => import("./pages/GoldMachine"));
const LuckySpin = lazy(() => import("./pages/LuckySpin"));
const Shop = lazy(() => import("./pages/Shop"));
const WeeklyRaffle = lazy(() => import("./pages/earn/Raffle"));
const CloverPacks = lazy(() => import("./pages/earn/Packs"));
const PuttingPacks = lazy(() => import("./pages/earn/PuttingPacks"));
const AddCash = lazy(() => import("./pages/wallet/AddCash"));
const VerifyTerms = lazy(() => import("./pages/wagers/VerifyTerms"));

// ── Cross-Domain ──
const Membership = lazy(() => import("./pages/Membership"));
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
const CoachAce = lazy(() => import("./pages/CoachAce"));
const LuckyCoach = lazy(() => import("./pages/LuckyCoach"));
const ProfileEditor = lazy(() => import("./pages/ProfileEditor"));
const Profile = lazy(() => import("./pages/Profile"));

// ── Admin ──
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminJackpots = lazy(() => import("./pages/admin/Jackpots"));
const AdminRaffle = lazy(() => import("./pages/admin/Raffle"));
const AdminCourseRequests = lazy(() => import("./pages/admin/CourseRequests"));
const AddCourse = lazy(() => import("./pages/play/AddCourse"));
const AdminWagers = lazy(() => import("./pages/admin/Wagers"));
import { AdminRoute } from "./components/AdminRoute";

// Camera, detector and bracket editor load only when Monocle is opened.
const Monocle = lazy(() => import("./pages/Monocle"));

const queryClient = new QueryClient();

// Once the app is up and the browser is idle, fetch the pages people open most so the first tap is instant.
const warmRoutes = () => {
  const run = () => {
    void import("./pages/play/StartRound");
    void import("./pages/Scorecard");
    void import("./pages/practice/Putting");
    void import("./pages/LuckySpin");
    void import("./pages/play/Wagers");
    void import("./pages/earn/Packs");
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(run, { timeout: 4000 }); else setTimeout(run, 2500);
};
if (typeof window !== "undefined") window.addEventListener("load", warmRoutes, { once: true });

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
            <ScrollToTop />
            <ContactSync />
            <PurchaseSync />
            <PageFade>
            <Suspense fallback={<div className="min-h-screen w-full bg-background" />}>
            <Routes>
              {/* ── Auth (public) ── */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/join/:code" element={<JoinInvite />} />
              <Route path="/pay" element={<ProtectedRoute><Pay /></ProtectedRoute>} />
              <Route path="/pay/return" element={<ProtectedRoute><PayReturn /></ProtectedRoute>} />

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
              <Route path="/play/add-course" element={<ProtectedRoute><AddCourse /></ProtectedRoute>} />
              <Route path="/play/caddie" element={<ProtectedRoute><PersonalCaddie /></ProtectedRoute>} />
              <Route path="/play/start" element={<ProtectedRoute><StartRound /></ProtectedRoute>} />
              <Route path="/play/round" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />
              <Route path="/play/rounds/:id" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />

              {/* ── Practice Sub-Routes ── */}
              <Route path="/practice/rangefinder" element={<ProtectedRoute><Rangefinder /></ProtectedRoute>} />
              <Route
                path="/monocle"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
                      <Monocle />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
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
              <Route path="/earn/putting-packs" element={<ProtectedRoute><PuttingPacks /></ProtectedRoute>} />

              {/* ── Legacy Route Aliases ── */}
              <Route path="/spin" element={<Navigate to="/earn/spin" replace />} />
              <Route path="/gold-machine" element={<Navigate to="/earn/gold-machine" replace />} />
              <Route path="/shop" element={<Navigate to="/earn/shop" replace />} />
              <Route path="/rangefinder" element={<Navigate to="/play/rangefinder" replace />} />
              <Route path="/scorecard" element={<Navigate to="/play/scorecard" replace />} />
              <Route path="/course" element={<Navigate to="/play/flyover" replace />} />
              <Route path="/wallet/add-cash" element={<ProtectedRoute><AddCash /></ProtectedRoute>} />
              <Route path="/wagers/verify" element={<ProtectedRoute><VerifyTerms /></ProtectedRoute>} />
              <Route path="/wallet" element={<Navigate to="/earn" replace />} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

              {/* ── Cross-Domain ── */}
              <Route path="/membership" element={<ProtectedRoute><Membership /></ProtectedRoute>} />
              <Route path="/chat" element={<Navigate to="/" replace />} />

              {/* ── Admin ── */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/jackpots" element={<AdminRoute><AdminJackpots /></AdminRoute>} />
              <Route path="/admin/raffle" element={<AdminRoute><AdminRaffle /></AdminRoute>} />
              <Route path="/admin/courses" element={<AdminRoute><AdminCourseRequests /></AdminRoute>} />
              <Route path="/admin/wagers" element={<AdminRoute><AdminWagers /></AdminRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </PageFade>
            <BottomNavigation />
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </CloverProvider>
    </TierProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
