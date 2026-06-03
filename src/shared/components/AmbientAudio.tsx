import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
export const AmbientAudio = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="absolute top-4 right-4 z-50">
      <button onClick={() => setPlaying(!playing)} className="p-2 rounded-full bg-black/50 text-white">
        {playing ? <Volume2 /> : <VolumeX />}
      </button>
    </div>
  );
};
