// NOTE: these remain client-side stubs. Currency does NOT persist to Supabase yet.
// TODO: wire to golfer_profiles / transactions table behind RLS + server-side validation.
export const addClovers = async (amount: number, reason: string) => {
  console.log(`+${amount} clovers added for: ${reason}`);
  return { data: null, error: null };
};

export const getRecentTransactions = async (_limit?: number) => {
  return [];
};

export const updateGoldBalance = async (value: number) => {
  console.log(`gold balance set to: ${value}`);
  return { data: null, error: null };
};
