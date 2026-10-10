/** Helpers for the weekly raffle admin queue and the Home card. Pure so they can be tested. */

const TZ = 'America/New_York';

export interface PrizeItem {
  week_start: string; // the Sunday (YYYY-MM-DD) the week begins, 8 pm Eastern
  prize_name: string;
  prize_credit?: number;
  prize_spins?: number;
  prize_products?: string;
  description?: string;
}

function easternParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hour: Number(p.hour), weekday };
}

const iso = (dt: Date) => dt.toISOString().slice(0, 10);

/** The Sunday (YYYY-MM-DD) the raffle week containing `at` began: weeks turn over Sunday 8 pm Eastern. */
export function weekStartDate(at: Date): string {
  const e = easternParts(at);
  const day = new Date(Date.UTC(e.y, e.m - 1, e.d));
  day.setUTCDate(day.getUTCDate() - e.weekday - (e.weekday === 0 && e.hour < 20 ? 7 : 0));
  return iso(day);
}

/** The next `count` weekly slots, starting with the week running now. */
export function upcomingWeeks(at: Date, count: number): string[] {
  const first = new Date(`${weekStartDate(at)}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first);
    d.setUTCDate(d.getUTCDate() + 7 * i);
    return iso(d);
  });
}

/** The Eastern calendar date (YYYY-MM-DD) of an instant, e.g. a stored week start. */
export function easternDate(at: Date): string {
  const e = easternParts(at);
  return iso(new Date(Date.UTC(e.y, e.m - 1, e.d)));
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

export const CSV_HEADER = 'week_start,prize_name,prize_credit,prize_spins,prize_products,description';

/**
 * Parses pasted/uploaded prize rows. The first line may be the header; columns are
 * week_start (a Sunday), prize_name, prize_credit, prize_spins, prize_products, description.
 */
export function parsePrizeCsv(text: string): { items: PrizeItem[]; errors: string[] } {
  const items: PrizeItem[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    const cols = splitCsvLine(line);
    if (idx === 0 && /^week_?start$/i.test(cols[0])) return;
    const n = idx + 1;
    const [week, name, credit, spins, products, description] = cols;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week ?? '') || Number.isNaN(new Date(`${week}T00:00:00Z`).getTime())) {
      errors.push(`Line ${n}: week_start must look like 2026-11-08`); return;
    }
    if (new Date(`${week}T00:00:00Z`).getUTCDay() !== 0) { errors.push(`Line ${n}: ${week} is not a Sunday`); return; }
    if (!name) { errors.push(`Line ${n}: prize_name is required`); return; }
    const c = credit ? Number(credit) : 0;
    const s = spins ? Number(spins) : 0;
    if (!Number.isFinite(c) || c < 0 || !Number.isInteger(s) || s < 0) { errors.push(`Line ${n}: credit and Spinz must be positive numbers`); return; }
    items.push({
      week_start: week, prize_name: name, prize_credit: c, prize_spins: s,
      ...(products ? { prize_products: products } : {}), ...(description ? { description } : {}),
    });
  });
  return { items, errors };
}

/** "$25 credit + 5 Spinz + Lucky Golf hat" */
export function describePrize(p: { prize_credit?: number | null; prize_spins?: number | null; prize_products?: string | null }): string {
  const parts: string[] = [];
  if (Number(p.prize_credit) > 0) parts.push(`$${Number(p.prize_credit)} credit`);
  if (Number(p.prize_spins) > 0) parts.push(`${Number(p.prize_spins)} Spinz`);
  if (p.prize_products?.trim()) parts.push(p.prize_products.trim());
  return parts.join(' + ');
}

/** "3d 4h", "4h 12m", "9m", or "Drawing soon". */
export function timeLeft(endsAt: string | Date, now = new Date()): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return 'Drawing soon';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}
