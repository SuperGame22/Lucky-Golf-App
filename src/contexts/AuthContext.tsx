import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { buildInviteLink, publicBaseUrl, readPendingInvite } from '@/features/invites/invites';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  handicap_index: number | null;
  lucky_level: number;
  clovers: number;
  total_clovers: number;
  spins?: number;
  gold_balance?: number;
  bio: string;
  role?: string;
  membership_tier?: 'free' | 'clover' | 'gold' | null;
  date_of_birth?: string | null;
  tos_accepted_at?: string | null;
  tos_version?: string | null;
}

/** Fields a player may change on their own profile (role, tier, clovers and gold are server-only). */
export type ProfileUpdate = Partial<Pick<Profile, 'display_name' | 'username' | 'avatar_url' | 'handicap_index' | 'bio' | 'date_of_birth' | 'tos_accepted_at' | 'tos_version'>>;

/** Browser keys that belong to the signed-in player and are cleared on sign-out. */
const PER_USER_KEYS = ['lg_tier', 'lg_pending_invite', 'lg_pending_contact', 'lg_scorecard_draft'];

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True until the first session check (and that user's profile) has finished. */
  loading: boolean;
  /** True while a signed-in user's profile is being (re)loaded and none is in hand yet. */
  profileLoading: boolean;
  /** The user arrived from a password-reset email and should choose a new password. */
  passwordRecovery: boolean;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const profileUserRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    // Only show "loading" when we have no profile for this user yet (token refreshes stay silent).
    if (profileUserRef.current !== userId) setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('golfer_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      profileUserRef.current = userId;
      setProfile(data as Profile | null);
    } catch (e) {
      console.error('fetchProfile error:', e);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (session?.user) {
        // A refreshed token for the same user doesn't change the profile.
        if (event !== 'TOKEN_REFRESHED' || profileUserRef.current !== session.user.id) fetchProfile(session.user.id);
      } else {
        profileUserRef.current = null;
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    // The confirmation email returns to the invite link when signing up from one, so the code survives
    // even if the email is opened in a different browser.
    const invite = readPendingInvite(localStorage);
    const base = publicBaseUrl(import.meta.env.VITE_PUBLIC_APP_URL, window.location.origin);
    const emailRedirectTo = invite ? buildInviteLink(base, invite.code, invite.from ?? '') : undefined;
    const name = displayName.trim();
    // The database creates the profile from this display name (works even before the email is confirmed).
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
    });
    if (error) return { error: error.message };
    // Older databases without that trigger: create the row here when we already have a session.
    if (data.user && data.session) {
      const { error: pErr } = await supabase.from('golfer_profiles')
        .upsert({ user_id: data.user.id, display_name: name }, { onConflict: 'user_id', ignoreDuplicates: true });
      if (pErr) console.warn('profile create:', pErr.message);
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('signOut error:', error.message);
    for (const k of PER_USER_KEYS) {
      try { localStorage.removeItem(k); } catch { /* storage unavailable */ }
    }
    profileUserRef.current = null;
    setProfile(null);
    setPasswordRecovery(false);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?reset=1`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setPasswordRecovery(false);
    return { error: error?.message ?? null };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const updateProfile = async (updates: ProfileUpdate) => {
    if (!user) return { error: 'Not signed in' };
    const { error } = await supabase
      .from('golfer_profiles')
      .update(updates)
      .eq('user_id', user.id);
    if (!error) await fetchProfile(user.id);
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileLoading, passwordRecovery, updatePassword, signUp, signIn, signOut, resetPassword, refreshProfile, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
