import { supabase } from '@/integrations/supabase/client';

export interface ActivityItem {
  id: string;
  type: string;
  description: string | null;
  amount: number;
  created_at: string;
}

/** The signed-in player's latest money activity (purchases, top-ups, wager payouts). */
export const getRecentTransactions = async (limit = 5): Promise<ActivityItem[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, description, amount, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('recent activity:', error.message);
    return [];
  }
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount ?? 0) })) as ActivityItem[];
};

/** "+$5.00", "-$10.00", or "$4.00" for a purchase (money spent, not won). */
export const formatActivityAmount = (t: Pick<ActivityItem, 'type' | 'amount'>): { text: string; tone: 'gain' | 'loss' | 'neutral' } => {
  const abs = `$${Math.abs(t.amount).toFixed(2)}`;
  if (t.type === 'purchase') return { text: abs, tone: 'neutral' };
  if (t.amount > 0) return { text: `+${abs}`, tone: 'gain' };
  if (t.amount < 0) return { text: `-${abs}`, tone: 'loss' };
  return { text: abs, tone: 'neutral' };
};
