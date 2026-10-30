/** Small pure helpers for the putting round's state, kept here so they can be unit-tested. */

export type PuttState = 'aim' | 'roll' | 'sunk' | 'lip' | 'miss' | 'sand' | 'practice';

/**
 * What the game state becomes when the "Lip Out" banner times out. The ball only goes back to "roll"
 * if it is still showing the lip-out. If it has since dropped (sunk), stopped (miss), left the green
 * or the player reset, that outcome is kept, so a late timer can't stop the round from finishing.
 */
export function afterLipOut(state: PuttState): PuttState {
  return state === 'lip' ? 'roll' : state;
}

/** Whole seconds between two timestamps (ms), never negative. */
export function elapsedSeconds(startMs: number, endMs: number): number {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}
