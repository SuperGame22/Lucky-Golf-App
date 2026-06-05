import { supabase } from '@/integrations/supabase/client';

/**
 * Award clovers to a user by calling the add_clovers RPC.
 * Writes directly to golfer_profiles.clovers + total_clovers.
 */
export const addClovers = async (amount: number, reason: string): Promise<{ error: string | null; newBalance: number | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not signed in', newBalance: null };

    const { data, error } = await supabase.rpc('add_clovers', {
      p_user_id: user.id,
      p_amount: amount,
    });

    if (error) return { error: error.message, newBalance: null };
    if (!data?.success) return { error: data?.error || 'Failed', newBalance: null };

    console.log(`+${amount} clovers for: ${reason}`);
    return { error: null, newBalance: data.new_balance };
  } catch (e: any) {
    return { error: e.message, newBalance: null };
  }
};

export const getRecentTransactions = async (limit = 5): Promise<any[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  // Transactions are in the transactions table linked to wallets
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
};

export const updateGoldBalance = async (goldValue: number): Promise<{ error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not signed in' };
    const { error } = await supabase
      .from('golfer_profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    return { error: error?.message ?? null };
  } catch (e: any) {
    return { error: e.message };
  }
};
