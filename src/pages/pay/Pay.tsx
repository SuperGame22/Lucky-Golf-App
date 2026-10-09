import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { stripePublishableKey } from '@/features/checkout/checkout';

/**
 * Stripe's payment form shown inside Lucky Golf. Stripe still handles the card fields (they run on
 * Stripe's secure frame), so card numbers never touch our code. The look comes from the Stripe
 * dashboard's Branding settings (logo, colours, font).
 */
export default function Pay() {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { clientSecret?: string; title?: string } | null };
  const clientSecret = state?.clientSecret;
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const key = stripePublishableKey();
    if (!clientSecret || !key) return;
    let cancelled = false;
    let checkout: { mount: (el: HTMLElement) => void; destroy: () => void } | null = null;
    (async () => {
      try {
        const stripe = await loadStripe(key);
        if (!stripe) throw new Error('Stripe did not load');
        const c = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => clientSecret });
        if (cancelled || !mountRef.current) {
          c.destroy();
          return;
        }
        checkout = c;
        c.mount(mountRef.current);
        setStatus('ready');
      } catch (e) {
        console.error('embedded checkout failed:', e);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      try { checkout?.destroy(); } catch { /* already gone */ }
    };
  }, [clientSecret]);

  // Opened without a checkout (refresh after finishing, or typed in): nothing to pay for.
  if (!clientSecret || !stripePublishableKey()) return <Navigate to="/earn" replace />;

  return (
    <AppLayout hideHeader>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider">{state?.title ?? 'Secure checkout'}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Lock className="w-3 h-3" /> Payments by Stripe</p>
          </div>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        )}
        {status === 'error' && (
          <div className="glass-card p-5 text-center space-y-3" data-testid="pay-error">
            <p className="text-sm">We couldn't open the payment form.</p>
            <Button onClick={() => navigate(-1)}>Go back and try again</Button>
          </div>
        )}
        <div ref={mountRef} className="rounded-2xl overflow-hidden bg-white" data-testid="pay-form" style={{ display: status === 'ready' ? 'block' : 'none' }} />
      </div>
    </AppLayout>
  );
}
