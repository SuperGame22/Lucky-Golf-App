import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { safeNextPath } from '@/features/checkout/checkoutReply';

/** Where Stripe sends the player after the embedded form: a short thank-you, then on to the page that used to follow checkout. */
export default function PayReturn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));

  useEffect(() => {
    const t = setTimeout(() => navigate(next, { replace: true }), 1600);
    return () => clearTimeout(t);
  }, [navigate, next]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center space-y-4" data-testid="pay-return">
      <CheckCircle2 className="w-14 h-14 text-primary" />
      <h1 className="text-2xl font-black uppercase tracking-wider">Thanks!</h1>
      <p className="text-sm text-muted-foreground">Your payment is going through. Adding it to your account…</p>
      <Button variant="outline" onClick={() => navigate(next, { replace: true })}>Continue</Button>
    </div>
  );
}
