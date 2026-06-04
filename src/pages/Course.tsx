import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Play, Pause, ChevronLeft, ChevronRight, Gauge, Eye, Target, Flag, Crosshair, AlertTriangle } from "lucide-react";
import { CloverIcon } from "@/components/icons/CloverIcon";

interface Course {
  id: string;
  name: string;
  city: string;
  holes: number;
}

const mockCourses: Course[] = [
  { id: "1", name: "Pebble Beach Golf Links", city: "Pebble Beach, CA", holes: 18 },
  { id: "2", name: "Augusta National Golf Club", city: "Augusta, GA", holes: 18 },
  { id: "3", name: "St. Andrews Links", city: "St. Andrews, Scotland", holes: 18 },
  { id: "4", name: "TPC Sawgrass", city: "Ponte Vedra Beach, FL", holes: 18 },
  { id: "5", name: "Torrey Pines Golf Course", city: "San Diego, CA", holes: 18 },
];

const Course = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showHoleMap, setShowHoleMap] = useState(false);
  const [arMode, setArMode] = useState(false);
  const [showClover, setShowClover] = useState(true);
  
  // Rangefinder demo distances
  const distances = {
    front: 142,
    middle: 156,
    back: 168,
    hazard: 89,
  };

  const filteredCourses = mockCourses.filter(
    (course) =>
      course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
    setSelectedHole(null);
    setShowHoleMap(true);
  };

  const handleHoleSelect = (hole: number) => {
    setSelectedHole(hole);
    setIsPlaying(true);
    setShowHoleMap(false);
  };

  const handleSpeedChange = (delta: number) => {
    setPlaybackSpeed((prev) => Math.max(0.25, Math.min(3, prev + delta)));
  };

  const goBack = () => {
    if (selectedHole !== null) {
      setSelectedHole(null);
      setShowHoleMap(true);
      setIsPlaying(false);
    } else if (selectedCourse) {
      setSelectedCourse(null);
      setShowHoleMap(false);
    }
  };

  return (
    <AppLayout>
      <div className="relative min-h-screen flex flex-col bg-gradient-to-b from-background to-secondary/20">
        <div className="relative flex-1 max-w-lg mx-auto px-4 py-6 w-full">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-6"
          >
            {(selectedCourse || selectedHole !== null) && (
              <Button variant="ghost" size="icon" onClick={goBack}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-display font-bold">Course Flyover</h1>
              <p className="text-sm text-muted-foreground">
                {selectedCourse
                  ? selectedHole !== null
                    ? `Hole ${selectedHole}`
                    : "Select a hole"
                  : "Search for a course"}
              </p>
            </div>
            <Button
              variant={arMode ? "gold" : "glass"}
              size="sm"
              onClick={() => setArMode(!arMode)}
              className="gap-2"
            >
              <Eye className="w-5 h-5" />
              {arMode ? "AR ON" : "AR Mode"}
            </Button>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* Default Screen - Rangefinder with Target */}
            {!selectedCourse && !searchQuery && (
              <motion.div
                key="rangefinder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Main Distance Display */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="relative glass-card p-8 text-center glow-green"
                >
                  {/* Animated crosshair with flag */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 flex items-center justify-center opacity-10"
                  >
                    <Crosshair className="w-40 h-40 text-primary" />
                  </motion.div>
                  
                  {/* Target with flag in center */}
                  <div className="relative flex items-center justify-center mb-4">
                    <div className="relative">
                      <Target className="w-24 h-24 text-primary/30" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Flag className="w-8 h-8 text-primary" />
                      </div>
                    </div>
                  </div>

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
                  className="flex items-center gap-3 bg-accent/10 border border-accent/20 rounded-xl p-4"
                >
                  <AlertTriangle className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-accent">Water Hazard</p>
                    <p className="text-xs text-muted-foreground">{distances.hazard} yards to carry</p>
                  </div>
                </motion.div>

                {/* Course Search Button */}
                <Button
                  variant="glass"
                  className="w-full gap-2"
                  onClick={() => setSearchQuery(" ")}
                >
                  <Search className="w-4 h-4" />
                  Search Courses for Flyover
                </Button>

                {/* Club Recommendation */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-card p-4"
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
              </motion.div>
            )}

            {/* Search Screen */}
            {(searchQuery || selectedCourse) && !selectedCourse && (
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by course name or city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="space-y-2">
                  {filteredCourses.map((course) => (
                    <motion.button
                      key={course.id}
                      onClick={() => handleCourseSelect(course)}
                      className="w-full glass-card p-4 text-left hover:bg-primary/5 transition-colors"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{course.name}</p>
                          <p className="text-sm text-muted-foreground">{course.city}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Hole Selection - Map View */}
            {selectedCourse && showHoleMap && !selectedHole && (
              <motion.div
                key="holemap"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="glass-card p-4">
                  <p className="font-semibold mb-2">{selectedCourse.name}</p>
                  <p className="text-sm text-muted-foreground mb-4">Tap a hole to start flyover</p>
                  
                  {/* Bird's eye course map with fairway shapes */}
                  <div className="relative aspect-square bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 rounded-xl overflow-hidden p-3">
                    {/* Fairway-shaped holes arranged like a real course map */}
                    <svg viewBox="0 0 300 300" className="w-full h-full">
                      {/* Background rough/trees */}
                      <rect x="0" y="0" width="300" height="300" fill="hsl(150, 40%, 15%)" />
                      
                      {/* Hole 1 - straight fairway */}
                      <g onClick={() => handleHoleSelect(1)} className="cursor-pointer hover:opacity-80">
                        <path d="M260 280 Q265 250 260 220 Q255 200 260 180 L275 180 Q280 200 275 220 Q280 250 275 280 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="267" cy="185" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="267" cy="265" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="267" y="250" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">1</text>
                      </g>
                      
                      {/* Hole 2 - dogleg right */}
                      <g onClick={() => handleHoleSelect(2)} className="cursor-pointer hover:opacity-80">
                        <path d="M220 280 Q225 260 220 240 Q210 220 230 200 Q250 185 270 170 L280 180 Q260 195 240 210 Q225 225 235 245 Q240 265 235 280 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="273" cy="173" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="227" cy="265" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="250" y="220" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">2</text>
                      </g>
                      
                      {/* Hole 3 - straight up */}
                      <g onClick={() => handleHoleSelect(3)} className="cursor-pointer hover:opacity-80">
                        <path d="M160 80 Q155 50 160 20 L175 20 Q180 50 175 80 Q180 110 175 140 L160 140 Q155 110 160 80 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="167" cy="25" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="167" cy="125" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="167" y="75" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">3</text>
                      </g>
                      
                      {/* Hole 4 - dogleg left with water */}
                      <g onClick={() => handleHoleSelect(4)} className="cursor-pointer hover:opacity-80">
                        <path d="M40 80 Q35 60 50 40 Q70 25 90 20 L95 35 Q75 40 60 55 Q50 70 55 90 Q60 110 55 130 L40 130 Q35 110 40 80 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="90" cy="27" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <ellipse cx="30" cy="55" rx="12" ry="8" fill="hsl(200, 70%, 40%)" />
                        <circle cx="47" cy="115" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="60" y="70" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">4</text>
                      </g>
                      
                      {/* Hole 5 - short par 3 */}
                      <g onClick={() => handleHoleSelect(5)} className="cursor-pointer hover:opacity-80">
                        <path d="M30 140 Q25 155 30 170 L50 170 Q55 155 50 140 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="40" cy="145" rx="6" ry="5" fill="hsl(120, 60%, 50%)" />
                        <circle cx="40" cy="165" r="5" fill="hsl(120, 45%, 45%)" />
                        <text x="40" y="158" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">5</text>
                      </g>
                      
                      {/* Hole 6 - wide fairway */}
                      <g onClick={() => handleHoleSelect(6)} className="cursor-pointer hover:opacity-80">
                        <path d="M115 90 Q100 75 115 55 Q130 40 150 45 Q165 50 165 70 Q165 90 150 100 Q135 110 115 90 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="145" cy="55" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="120" cy="80" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="135" y="75" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">6</text>
                      </g>
                      
                      {/* Hole 7 - curved */}
                      <g onClick={() => handleHoleSelect(7)} className="cursor-pointer hover:opacity-80">
                        <path d="M200 55 Q210 40 230 35 Q250 30 260 50 Q265 70 255 85 L240 80 Q245 65 240 55 Q230 45 215 55 Q205 65 210 80 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="255" cy="45" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="205" cy="70" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="230" y="55" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">7</text>
                      </g>
                      
                      {/* Hole 8 - long par 5 */}
                      <g onClick={() => handleHoleSelect(8)} className="cursor-pointer hover:opacity-80">
                        <path d="M240 100 Q235 120 245 145 Q255 165 250 190 L265 195 Q270 170 260 145 Q250 120 255 100 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="247" cy="105" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="257" cy="180" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="252" y="145" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">8</text>
                      </g>
                      
                      {/* Hole 9 - back to clubhouse */}
                      <g onClick={() => handleHoleSelect(9)} className="cursor-pointer hover:opacity-80">
                        <path d="M200 200 Q190 220 195 245 Q200 270 190 280 L175 275 Q185 260 180 240 Q175 220 185 200 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="192" cy="205" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="182" cy="265" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="187" y="235" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">9</text>
                      </g>
                      
                      {/* Hole 10 */}
                      <g onClick={() => handleHoleSelect(10)} className="cursor-pointer hover:opacity-80">
                        <path d="M25 200 Q20 225 25 250 Q30 275 25 290 L40 290 Q45 275 40 250 Q45 225 40 200 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="32" cy="205" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="32" cy="280" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="32" y="245" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">10</text>
                      </g>
                      
                      {/* Hole 11 - dogleg */}
                      <g onClick={() => handleHoleSelect(11)} className="cursor-pointer hover:opacity-80">
                        <path d="M50 200 Q70 195 85 210 Q100 230 95 250 L80 250 Q85 235 75 220 Q60 210 50 215 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="55" cy="207" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="87" cy="245" r="5" fill="hsl(120, 45%, 45%)" />
                        <text x="72" y="225" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">11</text>
                      </g>
                      
                      {/* Hole 12 - par 3 over water */}
                      <g onClick={() => handleHoleSelect(12)} className="cursor-pointer hover:opacity-80">
                        <ellipse cx="85" cy="175" rx="15" ry="10" fill="hsl(200, 70%, 40%)" />
                        <path d="M65 190 L75 190 L75 200 L65 200 Z" fill="hsl(120, 50%, 35%)" />
                        <path d="M95 155 L105 155 L105 165 L95 165 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="100" cy="158" rx="4" ry="3" fill="hsl(120, 60%, 50%)" />
                        <circle cx="70" cy="197" r="4" fill="hsl(120, 45%, 45%)" />
                        <text x="85" y="178" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">12</text>
                      </g>
                      
                      {/* Hole 13 - center of course */}
                      <g onClick={() => handleHoleSelect(13)} className="cursor-pointer hover:opacity-80">
                        <path d="M115 180 Q130 170 145 180 Q155 195 145 210 Q130 220 115 210 Q105 195 115 180 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="140" cy="183" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="120" cy="200" r="5" fill="hsl(120, 45%, 45%)" />
                        <text x="130" y="198" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">13</text>
                      </g>
                      
                      {/* Hole 14 */}
                      <g onClick={() => handleHoleSelect(14)} className="cursor-pointer hover:opacity-80">
                        <path d="M115 115 Q130 105 145 115 Q155 130 145 145 L130 145 Q140 130 130 120 Q120 115 115 125 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="140" cy="118" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="122" cy="135" r="5" fill="hsl(120, 45%, 45%)" />
                        <text x="132" y="132" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">14</text>
                      </g>
                      
                      {/* Hole 15 - with bunkers */}
                      <g onClick={() => handleHoleSelect(15)} className="cursor-pointer hover:opacity-80">
                        <path d="M55 90 Q50 110 55 130 L70 130 Q75 110 70 90 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="62" cy="95" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <ellipse cx="78" cy="115" rx="5" ry="3" fill="hsl(45, 70%, 70%)" />
                        <circle cx="62" cy="125" r="4" fill="hsl(120, 45%, 45%)" />
                        <text x="62" y="112" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">15</text>
                      </g>
                      
                      {/* Hole 16 */}
                      <g onClick={() => handleHoleSelect(16)} className="cursor-pointer hover:opacity-80">
                        <path d="M20 55 Q15 40 25 25 L40 30 Q30 45 35 60 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="32" cy="30" rx="4" ry="3" fill="hsl(120, 60%, 50%)" />
                        <circle cx="27" cy="52" r="4" fill="hsl(120, 45%, 45%)" />
                        <text x="30" y="43" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">16</text>
                      </g>
                      
                      {/* Hole 17 - island green style */}
                      <g onClick={() => handleHoleSelect(17)} className="cursor-pointer hover:opacity-80">
                        <ellipse cx="165" cy="155" rx="20" ry="15" fill="hsl(200, 70%, 40%)" />
                        <ellipse cx="165" cy="155" rx="10" ry="8" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="165" cy="152" rx="4" ry="3" fill="hsl(120, 60%, 50%)" />
                        <path d="M150 170 L160 175 L165 170 Z" fill="hsl(120, 50%, 35%)" />
                        <text x="165" y="158" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">17</text>
                      </g>
                      
                      {/* Hole 18 - finishing hole */}
                      <g onClick={() => handleHoleSelect(18)} className="cursor-pointer hover:opacity-80">
                        <path d="M130 250 Q125 230 135 210 Q145 195 155 200 Q165 210 160 230 Q155 250 165 270 L150 275 Q145 255 150 235 Q155 215 145 210 Q135 215 140 235 Q145 255 140 270 Z" fill="hsl(120, 50%, 35%)" />
                        <ellipse cx="152" cy="202" rx="5" ry="4" fill="hsl(120, 60%, 50%)" />
                        <circle cx="157" cy="265" r="6" fill="hsl(120, 45%, 45%)" />
                        <text x="147" y="235" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">18</text>
                      </g>
                      
                      {/* Clubhouse */}
                      <rect x="135" y="270" x2="155" y2="290" width="25" height="20" fill="hsl(30, 30%, 40%)" rx="2" />
                      <text x="147" y="283" textAnchor="middle" fill="white" fontSize="6">Club</text>
                    </svg>
                  </div>
                </div>

                {/* Hole list alternative */}
                <div className="grid grid-cols-6 gap-2">
                  {[...Array(selectedCourse.holes)].map((_, i) => (
                    <Button
                      key={i}
                      variant="glass"
                      size="sm"
                      onClick={() => handleHoleSelect(i + 1)}
                      className="aspect-square"
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Flyover Player */}
            {selectedHole !== null && (
              <motion.div
                key="flyover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Video Player */}
                <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
                  <video
                    className="w-full h-full object-cover"
                    src="/videos/hole-flyover-example.mov"
                    autoPlay={isPlaying}
                    loop
                    muted
                    playsInline
                    ref={(video) => {
                      if (video) {
                        video.playbackRate = playbackSpeed;
                        if (isPlaying) {
                          video.play();
                        } else {
                          video.pause();
                        }
                      }
                    }}
                  />
                  
                  {/* Overlay info */}
                  <div className="absolute top-4 left-4 glass-card px-3 py-1.5">
                    <p className="text-sm font-semibold">Hole {selectedHole}</p>
                    <p className="text-xs text-muted-foreground">Par 4 • 425 yds</p>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedHole(Math.max(1, selectedHole - 1))}
                      disabled={selectedHole === 1}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>

                    <Button
                      variant="gold"
                      size="lg"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="gap-2"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-5 h-5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          Play
                        </>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedHole(Math.min(18, selectedHole + 1))}
                      disabled={selectedHole === 18}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Golf Cart Pedal Controls */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Speed Control</span>
                      <span className="text-sm font-semibold">{playbackSpeed.toFixed(2)}x</span>
                    </div>
                    
                    {/* Golf Cart Pedals */}
                    <div className="flex items-end justify-center gap-6">
                      {/* Brake Pedal */}
                      <motion.button
                        className="relative flex flex-col items-center"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSpeedChange(-0.25)}
                        disabled={playbackSpeed <= 0.25}
                      >
                        <span className="text-xs text-muted-foreground mb-1">BRAKE</span>
                        <div className={`relative w-14 h-20 rounded-t-lg rounded-b-md shadow-lg transition-all ${
                          playbackSpeed <= 0.25 
                            ? "bg-muted/50 cursor-not-allowed" 
                            : "bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 cursor-pointer"
                        }`}>
                          {/* Pedal texture lines */}
                          <div className="absolute inset-x-2 top-3 space-y-1.5">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-0.5 bg-black/20 rounded-full" />
                            ))}
                          </div>
                          {/* Pedal stem */}
                          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-muted-foreground/30 rounded-b-md" />
                        </div>
                        <span className="mt-5 text-xs font-semibold">🐢 Slow</span>
                      </motion.button>

                      {/* Speed Display */}
                      <div className="flex flex-col items-center mb-4">
                        <Gauge className="w-8 h-8 text-accent mb-1" />
                        <span className="text-2xl font-bold">{playbackSpeed.toFixed(1)}x</span>
                        <span className="text-xs text-muted-foreground">
                          {playbackSpeed <= 0.5 ? "Crawling" : playbackSpeed <= 1 ? "Cruising" : playbackSpeed <= 2 ? "Speeding" : "Flying!"}
                        </span>
                      </div>

                      {/* Gas Pedal */}
                      <motion.button
                        className="relative flex flex-col items-center"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSpeedChange(0.25)}
                        disabled={playbackSpeed >= 3}
                      >
                        <span className="text-xs text-muted-foreground mb-1">GAS</span>
                        <div className={`relative w-14 h-24 rounded-t-lg rounded-b-md shadow-lg transition-all ${
                          playbackSpeed >= 3 
                            ? "bg-muted/50 cursor-not-allowed" 
                            : "bg-gradient-to-b from-primary to-lucky-emerald hover:from-lucky-green-light hover:to-primary cursor-pointer"
                        }`}>
                          {/* Pedal texture lines */}
                          <div className="absolute inset-x-2 top-3 space-y-1.5">
                            {[...Array(6)].map((_, i) => (
                              <div key={i} className="h-0.5 bg-black/20 rounded-full" />
                            ))}
                          </div>
                          {/* Pedal stem */}
                          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-muted-foreground/30 rounded-b-md" />
                        </div>
                        <span className="mt-5 text-xs font-semibold">🏎️ Fast</span>
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Hole selector strip */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4">
                  {[...Array(18)].map((_, i) => (
                    <Button
                      key={i}
                      variant={selectedHole === i + 1 ? "default" : "glass"}
                      size="sm"
                      onClick={() => handleHoleSelect(i + 1)}
                      className="min-w-[2.5rem] aspect-square flex-shrink-0"
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
};

export default Course;
