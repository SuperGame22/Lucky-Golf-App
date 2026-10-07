import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Volume2, VolumeX } from "lucide-react";
import { FULL_SCREEN_ROUTES } from "@/shared/fullScreenRoutes";
export const AmbientAudio = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const { pathname } = useLocation();
  if (FULL_SCREEN_ROUTES.includes(pathname)) return null;
  return (
    <div className="absolute top-4 right-4 z-50">
      <button onClick={() => setPlaying(!playing)} className="p-2 rounded-full bg-black/50 text-white">
        {playing ? <Volume2 /> : <VolumeX />}
      </button>
    </div>
  );
};
