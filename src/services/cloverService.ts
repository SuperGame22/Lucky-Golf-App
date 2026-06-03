export const addClovers = async (amount: number, reason: string) => { console.log(`+${amount} clovers added for :${reason}`); return { data: null, error: null }; };
export const getRecentTransactions = async (limit?: number) => { return []; };
