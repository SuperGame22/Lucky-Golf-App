/**
 * PROFILE EDITOR — Update display_name, handicap, avatar
 * Persists to Supabase golfer_profiles table
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Camera,
  Save,
  User,
  Hash,
  Loader2,
  Check,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

const AVATARS = ['🏌️', '🏌️‍♂️', '🏌️‍♀️', '🧔', '👩', '🧑', '👱‍♀️', '👱‍♂️', '🧢', '⛳'];

export default function ProfileEditor() {
  const navigate = useNavigate();
  const { profile, user, updateProfile, signOut, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setHandicap(String(profile.handicap_index ?? ''));
      setAvatar(profile.avatar_url || '🏌️');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    const hcp = parseFloat(handicap);
    if (handicap && (isNaN(hcp) || hcp < 0 || hcp > 54)) {
      setError('Handicap must be between 0 and 54');
      return;
    }

    setSaving(true);
    setError(null);

    const updates: Record<string, any> = {
      display_name: displayName.trim(),
      avatar_url: avatar,
    };
    if (handicap) updates.handicap_index = hcp;

    const { error: err } = await updateProfile(updates);
    if (err) {
      setError(err);
    } else {
      toast.success('Profile updated!');
      await refreshProfile();
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/career')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Edit Profile</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">{user?.email}</p>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 text-center">
          <div className="relative inline-block mb-4">
            <div
              className="w-24 h-24 rounded-full bg-primary/20 border-4 border-primary/50 flex items-center justify-center text-5xl cursor-pointer hover:border-primary transition-colors"
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              data-testid="avatar-picker-trigger"
            >
              {avatar || '🏌️'}
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg"
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            >
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>

          {showAvatarPicker && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-5 gap-3 mt-4 pt-4 border-t border-border">
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => { setAvatar(a); setShowAvatarPicker(false); }}
                  className={`text-3xl p-2 rounded-xl transition-all ${
                    avatar === a ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'
                  }`}
                >
                  {a}
                </button>
              ))}
            </motion.div>
          )}

          <p className="text-xs text-muted-foreground mt-2">Tap to change avatar</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-2">
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                data-testid="profile-display-name"
                className="w-full h-12 bg-black/40 border border-border rounded-xl pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground block mb-2">
              Handicap Index
            </label>
            <div className="relative">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                value={handicap}
                onChange={e => setHandicap(e.target.value)}
                placeholder="0 - 54"
                step="0.1"
                min="0"
                max="54"
                data-testid="profile-handicap"
                className="w-full h-12 bg-black/40 border border-border rounded-xl pl-12 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 text-sm"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Your USGA Handicap Index (optional)</p>
          </div>
        </motion.div>

        <Button
          className="w-full h-12 font-black uppercase tracking-wider"
          onClick={handleSave}
          disabled={saving}
          data-testid="profile-save-btn"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
        </Button>

        <div className="glass-card p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Account</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground">Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full font-bold uppercase tracking-wider text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={handleSignOut} data-testid="sign-out-btn">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>
    </AppLayout>
  );}
