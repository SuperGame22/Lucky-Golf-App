/**
 * AUTH PAGE — Login / Sign Up / Password Reset
 * Golf Pro aesthetic: bold, high-contrast, green/black/white
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { CloverLogo } from '@/components/icons/CloverLogo';
import { afterAuthPath, normalizeUsPhone, readPendingInvite, savePendingContact } from '@/features/invites/invites';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  Phone,
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, user } = useAuth();
  // An invite link sends new players here to sign up first.
  const pendingInvite = readPendingInvite(localStorage);
  const [mode, setMode] = useState<AuthMode>(pendingInvite && new URLSearchParams(window.location.search).get('invite') ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if already logged in
  if (user) {
    navigate(afterAuthPath(localStorage));
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email, password);
        if (err) { setError(err); }
        else { navigate(afterAuthPath(localStorage)); }
      } else if (mode === 'signup') {
        if (!displayName.trim()) { setError('Display name is required'); setLoading(false); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
        // The mobile number is optional, except for someone joining a wager from an invite link.
        const typed = phone.trim();
        const normalized = typed ? normalizeUsPhone(typed) : null;
        if (typed && !normalized) { setError('Enter a 10-digit US mobile number'); setLoading(false); return; }
        if (normalized && !consent) { setError('Please tick the box to let us text you, or clear the number'); setLoading(false); return; }
        if (pendingInvite && !normalized) { setError('Add your mobile number to join this wager'); setLoading(false); return; }
        const { error: err } = await signUp(email, password, displayName);
        if (err) { setError(err); }
        else {
          if (normalized) savePendingContact(localStorage, { phone: normalized, consent: true }); setSuccess('Account created! Check your email to confirm, or sign in now.'); setMode('login'); }
      } else if (mode === 'reset') {
        const { error: err } = await resetPassword(email);
        if (err) { setError(err); }
        else { setSuccess('Password reset email sent. Check your inbox.'); }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
    setLoading(false);
  };

  const inputCls = 'w-full h-12 bg-black/40 border border-border rounded-xl pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 bg-celtic-knot opacity-[0.04] pointer-events-none" style={{ backgroundSize: '120px 120px' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <CloverLogo className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-wider">Lucky Golf</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join the Club' : 'Reset Password'}
          </p>
        </motion.div>

        {pendingInvite && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4" data-testid="invite-banner">
            <CloverIcon className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-xs text-primary">You've been invited to a Lucky Wager. {mode === 'signup' ? 'Create your account to join.' : 'Sign in to join.'}</p>
          </div>
        )}

        {/* Error / Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 mb-4"
            >
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-xs text-green-400">{success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <motion.form
          key={mode}
          initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {mode === 'signup' && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                data-testid="auth-display-name"
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              data-testid="auth-email"
              required
            />
          </div>

          {mode !== 'reset' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                data-testid="auth-password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-2">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={pendingInvite ? 'Mobile number' : 'Mobile number (optional)'}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  data-testid="auth-phone"
                  required={!!pendingInvite}
                />
              </div>
              <label className="flex items-start gap-2 text-[11px] text-muted-foreground leading-snug cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" data-testid="auth-phone-consent" />
                <span>Yes, Lucky Golf may text me about my wagers and account. Message and data rates may apply.</span>
              </label>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 font-black uppercase tracking-wider text-sm"
            disabled={loading}
            data-testid="auth-submit"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'login' ? (
              'Sign In'
            ) : mode === 'signup' ? (
              'Create Account'
            ) : (
              'Send Reset Link'
            )}
          </Button>
        </motion.form>

        {/* Mode Switchers */}
        <div className="mt-6 space-y-3 text-center">
          {mode === 'login' && (
            <>
              <button
                onClick={() => { setMode('reset'); setError(null); setSuccess(null); }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest"
                data-testid="auth-forgot-link"
              >
                Forgot Password?
              </button>
              <div className="text-xs text-muted-foreground">
                No account?{' '}
                <button
                  onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                  className="text-primary font-bold hover:underline uppercase tracking-wider"
                  data-testid="auth-signup-link"
                >
                  Sign Up
                </button>
              </div>
            </>
          )}
          {mode === 'signup' && (
            <div className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
                className="text-primary font-bold hover:underline uppercase tracking-wider"
                data-testid="auth-login-link"
              >
                Sign In
              </button>
            </div>
          )}
          {mode === 'reset' && (
            <button
              onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
              className="flex items-center gap-2 mx-auto text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Sign In
            </button>
          )}
        </div>

        {/* Removed guest access — auth required */}
      </div>
    </div>
  );
}
