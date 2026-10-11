export type MembershipTier = 'free' | 'clover' | 'gold' | null | undefined;

// Clover Club and Gold Club both count as club members; Gold includes everything in Clover Club.
export const isClubMember = (tier: MembershipTier) => tier === 'clover' || tier === 'gold';
