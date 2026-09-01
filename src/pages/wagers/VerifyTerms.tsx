/**
 * Age + Terms gate for real-money Foursome Wagers. Required once per
 * account before create_competition/join_competition will succeed — the
 * RPCs enforce this server-side (raise 'AGE_VERIFICATION_REQUIRED') too,
 * this page is just the UI to satisfy it.
 *
 * Self-attested DOB for now. This is a stopgap, not real ID verification —
 * swap in Stripe Identity once it's enabled in the Stripe dashboard.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const WAGER_TOS_VERSION = 'wager-tos-v1-2026-09-01';

export default function VerifyTerms() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshProfile } = useAuth();
  const returnTo = (location.state as { returnTo?: string })?.returnTo || '/play/wagers';

  const [dob, setDob] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!dob) { setError('Enter your date of birth.'); return; }
    if (!agreed) { setError('You must agree to the terms to continue.'); return; }

    setSubmitting(true);
    const { error: rpcErr } = await supabase.rpc('accept_wager_terms', {
      p_date_of_birth: dob,
      p_tos_version: WAGER_TOS_VERSION,
    });
    setSubmitting(false);

    if (rpcErr) {
      setError(
        rpcErr.message.includes('18 or older')
          ? 'You must be 18 or older to use real-money wagers.'
          : rpcErr.message
      );
      return;
    }

    await refreshProfile();
    navigate(returnTo, { replace: true });
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Verify to Wager</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Required once, real money only</p>
          </div>
        </div>

        <div className="glass-card p-5 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Foursome Wagers use real cash from your wallet balance. You must be 18 or older and agree to the
            wager rules below before hosting or joining one.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Date of Birth</label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            data-testid="dob-input"
            className="w-full h-12 px-4 bg-black/40 border border-border rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </div>

        <div className="glass-card p-4 space-y-2 text-xs text-muted-foreground max-h-64 overflow-y-auto">
          <p className="font-bold text-foreground uppercase tracking-widest text-[10px]">Wager Rules</p>
          <p>By continuing, you agree that:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>You are 18 years of age or older.</li>
            <li>Foursome Wagers are limited to a maximum of 4 participants per match.</li>
            <li>Each participant's individual wager is capped at $300 per match.</li>
            <li>Lucky Golf does not take a cut of any pot — the full pot is paid to the match winner.</li>
            <li>Wager funds are held in your Lucky Golf cash balance, funded and withdrawn via Stripe.</li>
            <li>You are solely responsible for complying with the gambling and skill-contest laws of your own state or jurisdiction — real-money wagering is restricted or prohibited in some jurisdictions, and Lucky Golf does not represent that this feature is legal to use where you live.</li>
            <li>The date of birth you provide is self-reported; providing false information to participate is a violation of these terms and may result in account suspension.</li>
          </ul>
        </div>

        <label className="flex items-start gap-3 glass-card p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            data-testid="tos-checkbox"
            className="mt-0.5 w-4 h-4 accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            I confirm I am 18 or older and I agree to the Wager Rules above.
          </span>
        </label>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500" /><p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <Button className="w-full h-14 text-lg font-black uppercase tracking-wider" disabled={submitting}
          onClick={handleSubmit} data-testid="verify-terms-submit">
          {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
          {submitting ? 'Verifying…' : 'Confirm & Continue'}
        </Button>
      </div>
    </AppLayout>
  );
}
