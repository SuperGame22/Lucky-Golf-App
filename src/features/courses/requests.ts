/** Helpers for scorecard uploads (course requests). Pure so they can be tested. */

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export interface RequestFields { name: string; city: string; state: string }

/** A short message for the first problem with the form, or null when it can be sent. */
export function requestProblem(f: RequestFields, photo: { type: string; size: number } | null): string | null {
  if (f.name.trim().length < 2) return 'Add the course name';
  if (f.state.trim().length < 2) return 'Add the state';
  if (!photo) return 'Add a photo of the scorecard';
  if (photo.type && !ACCEPTED_PHOTO_TYPES.includes(photo.type.toLowerCase())) return 'Use a JPG, PNG or WebP photo';
  if (photo.size > MAX_PHOTO_BYTES) return 'That photo is too big. Try a smaller one.';
  return null;
}

/** Where the photo is stored: always inside the player's own folder. */
export function photoPath(userId: string, unique: string, type: string): string {
  const ext = /png/i.test(type) ? 'png' : /webp/i.test(type) ? 'webp' : /heic/i.test(type) ? 'heic' : 'jpg';
  return `${userId}/${unique.replace(/[^a-zA-Z0-9-]/g, '')}.${ext}`;
}

export interface HoleInput { par: string; yards: string }

/** The admin's per-hole entries -> the hole_data the database expects, or a message about what is wrong. */
export function buildHoleData(holes: HoleInput[]): { data: { hole: number; par: number; yards_est: number | null }[] } | { error: string } {
  const data: { hole: number; par: number; yards_est: number | null }[] = [];
  for (let i = 0; i < holes.length; i++) {
    const par = Number(holes[i].par);
    if (!Number.isInteger(par) || par < 3 || par > 6) return { error: `Hole ${i + 1}: par must be 3 to 6` };
    const raw = holes[i].yards.trim();
    let yards: number | null = null;
    if (raw) {
      yards = Number(raw);
      if (!Number.isInteger(yards) || yards < 30 || yards > 900) return { error: `Hole ${i + 1}: yards must be 30 to 900` };
    }
    data.push({ hole: i + 1, par, yards_est: yards });
  }
  return { data };
}

export const emptyHoles = (n: 9 | 18): HoleInput[] => Array.from({ length: n }, () => ({ par: '', yards: '' }));
