import { supabase } from '@/integrations/supabase/client';

/**
 * Add clovers to the current user's balance via RPC.
 * Prefer useClovers().addClovers() inside React; use this for non-component code.
 */
export const addClovers = async (userId: string, amount: number, reason = 'app') => {
  const { data, error } = await supabase.rpc('add_clovers', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) console.error('addClovers error:', error);
  return { data, error };
};

/**
 * Update gold balance in golfer_profiles.
 */
export const updateGoldBalance = async (amount: number) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('golfer_profiles')
    .update({ gold_balance: amount })
    .eq('user_id', user.id);
  if (error) console.error('updateGoldBalance error:', error);
};

export const getRecentTransactions = async (_limit?: number) => [];
