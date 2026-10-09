import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Share, SquarePlus, X } from 'lucide-react';
import { CloverLogo } from '@/components/icons/CloverLogo';
import { Button } from '@/components/ui/button';
import { dismiss, getInstallMode, isDismissed, shouldShowInstallCard } from '@/features/install/install';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Offers "put Lucky Golf on your home screen": a one-tap button where the browser allows it, steps on iPhone. */
export function InstallCard() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hidden, setHidden] = useState(() => isDismissed(localStorage));
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini-bar away; we show our card instead
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mode = installed ? 'installed' : getInstallMode({
    standalone,
    userAgent: navigator.userAgent,
    hasPromptEvent: !!promptEvent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
  if (!shouldShowInstallCard(mode, hidden)) return null;

  const notNow = () => { dismiss(localStorage); setHidden(true); };
  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === 'dismissed') notNow();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 border-primary/30" data-testid="install-card">
      <div className="flex items-start gap-3">
        <CloverLogo className="w-10 h-10 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold">Put Lucky Golf on your home screen</p>
          <p className="text-xs text-muted-foreground">Opens full screen like an app. No store needed.</p>
          {mode === 'prompt' && (
            <Button size="sm" className="mt-2 font-black uppercase tracking-wider" onClick={install} data-testid="install-btn">Add it</Button>
          )}
          {mode === 'ios' && !showSteps && (
            <Button size="sm" className="mt-2 font-black uppercase tracking-wider" onClick={() => setShowSteps(true)} data-testid="install-how-btn">Show me how</Button>
          )}
          {mode === 'ios' && showSteps && (
            <ol className="mt-2 text-sm space-y-1.5" data-testid="install-steps">
              <li className="flex items-center gap-2"><Share className="w-4 h-4 text-primary shrink-0" /> Tap the <b>Share</b> button at the bottom of Safari</li>
              <li className="flex items-center gap-2"><SquarePlus className="w-4 h-4 text-primary shrink-0" /> Choose <b>Add to Home Screen</b>, then <b>Add</b></li>
            </ol>
          )}
        </div>
        <button onClick={notNow} aria-label="Not now" className="p-1 text-muted-foreground hover:text-foreground" data-testid="install-dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
