import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, JACKPOTS_LIVE, LIVE, PAYMENTS_LIVE, migrationSql } from "./fixtures";

const ADMIN = "55555555-5555-5555-5555-555555555555";
const sql = migrationSql("20261015120000_weekly_raffle.sql");

describe("weekly raffle", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string | null) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  const asAnon = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE anon;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const call = async (s: string): Promise<J> => (await db.query<{ r: J }>(`SELECT ${s} AS r`)).rows[0].r;
  const rows = async <T extends object>(s: string) => { await asAdmin(); return (await db.query<T>(s)).rows; };

  /** An ended week with a prize and some entries; returns its id. */
  const endedWeek = async (opts: { credit?: number; spins?: number; products?: string | null; prize?: string | null; entries?: [string, number][] } = {}) => {
    await asAdmin();
    const r = await db.query<{ id: string }>(
      `INSERT INTO public.weekly_jackpots (title, prize_name, prize_credit, prize_spins, prize_products, starts_at, ends_at, status)
       VALUES ('w', $1, $2, $3, $4, now() - interval '8 days', now() - interval '1 day', 'active') RETURNING id`,
      [opts.prize === undefined ? "Prize" : opts.prize, opts.credit ?? 0, opts.spins ?? 0, opts.products ?? null]);
    const id = r.rows[0].id;
    let i = 0;
    for (const [u, n] of opts.entries ?? []) {
      await db.query(`INSERT INTO public.jackpot_entries (jackpot_id, user_id, entry_count, created_at) VALUES ($1, $2, $3, now() - interval '3 days' + $4 * interval '1 minute')`, [id, u, n, i++]);
    }
    return id;
  };
  const nextSundays = async (n: number) => {
    await asAdmin();
    const r = await db.query<{ d: string }>(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS d FROM generate_series((now() + interval '8 days')::date, (now() + interval '60 days')::date, interval '1 day') d
       WHERE extract(dow FROM d) = 0 ORDER BY d LIMIT ${n}`);
    return r.rows.map((x) => x.d);
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE + PAYMENTS_LIVE + JACKPOTS_LIVE);
    await db.exec(sql);
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      TRUNCATE public.jackpot_entries, public.weekly_jackpots, public.admin_audit_log, public.transactions, public.wallets;
      DELETE FROM public.golfer_profiles;
      DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}'), ('${ADMIN}');
      INSERT INTO public.golfer_profiles (user_id, display_name, role, spins) VALUES
        ('${ALICE}', 'Alice', NULL, 3), ('${BOB}', 'Bob', NULL, 3), ('${ADMIN}', 'Boss', 'admin', 3);
    `);
  });

  describe("the week", () => {
    const start = async (ts: string) => (await call(`to_char(public._raffle_week_start('${ts}') AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')`)) as unknown as string;
    it("turns over Sunday 8 pm Eastern", async () => {
      expect(await start("2026-10-12 00:00:00+00")).toBe("2026-10-12 00:00"); // Sun 8:00 pm EDT exactly: new week
      expect(await start("2026-10-11 23:59:59+00")).toBe("2026-10-05 00:00"); // 7:59:59 pm: still last week
      expect(await start("2026-10-14 15:00:00+00")).toBe("2026-10-12 00:00"); // midweek
    });
    it("keeps 8 pm local across daylight saving", async () => {
      // EDT -> EST on 2026-11-01. Week starting Oct 25 8 pm EDT ends Nov 1 8 pm EST (= 01:00 UTC Nov 2).
      expect(await call(`to_char(public._raffle_week_end('2026-10-26 00:00:00+00') AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')`)).toBe("2026-11-02 01:00");
    });
  });

  describe("entries", () => {
    it("every clover earned is one entry, from any path, merged into one row per week", async () => {
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 5, total_clovers = 5 WHERE user_id = '${ALICE}'`);
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 7, total_clovers = 7 WHERE user_id = '${ALICE}'`);
      const r = await rows<{ user_id: string; entry_count: number }>(`SELECT user_id, entry_count FROM public.jackpot_entries`);
      expect(r).toHaveLength(1);
      expect(r[0].entry_count).toBe(7);
    });
    it("spending or losing clovers never adds entries", async () => {
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 10, total_clovers = 10 WHERE user_id = '${ALICE}'`);
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 2 WHERE user_id = '${ALICE}'`);
      await db.exec(`UPDATE public.golfer_profiles SET total_clovers = 4 WHERE user_id = '${ALICE}'`);
      const r = await rows<{ n: number }>(`SELECT sum(entry_count)::int AS n FROM public.jackpot_entries`);
      expect(r[0].n).toBe(10);
    });
    it("the old award call is a no-op, so nothing is counted twice", async () => {
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 3, total_clovers = 3 WHERE user_id = '${ALICE}'`);
      await db.exec(`SELECT public.award_jackpot_entry('${ALICE}', 3)`);
      expect((await rows<{ n: number }>(`SELECT sum(entry_count)::int AS n FROM public.jackpot_entries`))[0].n).toBe(3);
    });
    it("a week with no prize queued still collects entries on a placeholder", async () => {
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 2, total_clovers = 2 WHERE user_id = '${BOB}'`);
      const j = await rows<{ prize_name: string; status: string }>(`SELECT prize_name, status FROM public.weekly_jackpots`);
      expect(j).toEqual([{ prize_name: "Prize to be announced", status: "active" }]);
    });
    it("a raffle problem never blocks earning clovers", async () => {
      await asAdmin();
      await db.exec(`ALTER TABLE public.jackpot_entries RENAME TO jackpot_entries_x`);
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 4, total_clovers = 4 WHERE user_id = '${ALICE}'`);
      await db.exec(`ALTER TABLE public.jackpot_entries_x RENAME TO jackpot_entries`);
      expect((await rows<{ clovers: number }>(`SELECT clovers FROM public.golfer_profiles WHERE user_id = '${ALICE}'`))[0].clovers).toBe(4);
    });
  });

  describe("the random pick", () => {
    it("always stays inside 1..total", async () => {
      await asAdmin();
      const r = await db.query<{ lo: string; hi: string }>(`SELECT min(t)::text AS lo, max(t)::text AS hi FROM (SELECT public._raffle_pick(7) AS t FROM generate_series(1, 3000)) s`);
      expect(Number(r.rows[0].lo)).toBeGreaterThanOrEqual(1);
      expect(Number(r.rows[0].hi)).toBeLessThanOrEqual(7);
      expect((await db.query<{ t: string }>(`SELECT public._raffle_pick(1)::text AS t`)).rows[0].t).toBe("1");
    });
    it("is spread evenly across tickets", async () => {
      await asAdmin();
      const r = await db.query<{ t: string; n: number }>(`SELECT t::text, count(*)::int AS n FROM (SELECT public._raffle_pick(4) AS t FROM generate_series(1, 4000)) s GROUP BY t ORDER BY t`);
      expect(r.rows).toHaveLength(4);
      for (const row of r.rows) expect(row.n).toBeGreaterThan(800); // expected 1000 each; a fair draw essentially never falls below 800
    });
    it("rejects nonsense totals", async () => {
      await asAdmin();
      await expect(db.query(`SELECT public._raffle_pick(0)`)).rejects.toThrow(/Invalid ticket count/);
    });
    it("maps tickets to owners in a fixed order, weighted by entries", async () => {
      const id = await endedWeek({ entries: [[ALICE, 3], [BOB, 2]] });
      const owner = async (t: number) => (await rows<{ user_id: string }>(`SELECT user_id FROM public._raffle_owner('${id}', ${t})`))[0].user_id;
      expect([await owner(1), await owner(3)]).toEqual([ALICE, ALICE]);
      expect([await owner(4), await owner(5)]).toEqual([BOB, BOB]);
    });
  });

  describe("the draw", () => {
    it("pays credit and Spinz automatically and records the draw", async () => {
      const id = await endedWeek({ credit: 25, spins: 5, entries: [[ALICE, 4]] });
      await asAdmin();
      expect(await call(`public.run_weekly_raffle()`)).toBe(1);
      const j = (await rows<J>(`SELECT * FROM public.weekly_jackpots WHERE id = '${id}'`))[0];
      expect(j.winner_user_id).toBe(ALICE);
      expect(j.status).toBe("fulfilled");
      expect(Number(j.draw_total)).toBe(4);
      expect(Number(j.draw_ticket)).toBeGreaterThanOrEqual(1);
      expect(j.drawn_at).not.toBeNull();
      expect((await rows<{ spins: number }>(`SELECT spins FROM public.golfer_profiles WHERE user_id = '${ALICE}'`))[0].spins).toBe(8);
      expect(Number((await rows<{ balance: string }>(`SELECT balance FROM public.wallets WHERE user_id = '${ALICE}'`))[0].balance)).toBe(25);
      expect((await rows<{ type: string }>(`SELECT type FROM public.transactions WHERE user_id = '${ALICE}'`))[0].type).toBe("winnings");
    });
    it("leaves free products for admin to fulfil", async () => {
      const id = await endedWeek({ credit: 10, products: "Lucky Golf hat", entries: [[BOB, 1]] });
      await asAdmin();
      await db.exec(`SELECT public.run_weekly_raffle()`);
      const j = (await rows<J>(`SELECT status, fulfilled_at, winner_user_id FROM public.weekly_jackpots WHERE id = '${id}'`))[0];
      expect(j.winner_user_id).toBe(BOB);
      expect(j.status).toBe("closed");
      expect(j.fulfilled_at).toBeNull();
    });
    it("can only happen once, whoever asks", async () => {
      const id = await endedWeek({ spins: 1, entries: [[ALICE, 2], [BOB, 2]] });
      await asAdmin();
      await db.exec(`SELECT public.run_weekly_raffle()`);
      const first = (await rows<J>(`SELECT winner_user_id, draw_ticket FROM public.weekly_jackpots WHERE id = '${id}'`))[0];
      await asUser(ADMIN);
      expect(await call(`public.select_jackpot_winner('${id}')`)).toEqual({ success: false, error: "This raffle was already drawn" });
      await asAdmin();
      expect(await call(`public.run_weekly_raffle()`)).toBe(0);
      expect((await rows<J>(`SELECT winner_user_id, draw_ticket FROM public.weekly_jackpots WHERE id = '${id}'`))[0]).toEqual(first);
    });
    it("waits for a prize and never draws a week that has not ended", async () => {
      const noPrize = await endedWeek({ prize: "Prize to be announced", entries: [[ALICE, 1]] });
      await asAdmin();
      const future = (await db.query<{ id: string }>(`INSERT INTO public.weekly_jackpots (prize_name, starts_at, ends_at, status) VALUES ('P', now() - interval '1 day', now() + interval '6 days', 'active') RETURNING id`)).rows[0].id;
      expect(await call(`public.run_weekly_raffle()`)).toBe(0);
      await asUser(ADMIN);
      expect((await call(`public.select_jackpot_winner('${noPrize}')`)).error).toBe("Add a prize before drawing");
      expect((await call(`public.select_jackpot_winner('${future}')`)).error).toBe("This raffle has not ended yet");
    });
    it("closes a week with no entries without a winner", async () => {
      const id = await endedWeek({ credit: 5 });
      await asAdmin();
      await db.exec(`SELECT public.run_weekly_raffle()`);
      const j = (await rows<J>(`SELECT status, winner_user_id, draw_total FROM public.weekly_jackpots WHERE id = '${id}'`))[0];
      expect(j).toMatchObject({ status: "closed", winner_user_id: null });
      expect(Number(j.draw_total)).toBe(0);
    });
    it("gives the winner in proportion to entries", async () => {
      await asAdmin();
      const wins: Record<string, number> = { [ALICE]: 0, [BOB]: 0 };
      for (let i = 0; i < 60; i++) {
        const id = await endedWeek({ spins: 1, entries: [[ALICE, 9], [BOB, 1]] });
        await asAdmin();
        await db.exec(`SELECT public.run_weekly_raffle()`);
        const w = (await rows<{ winner_user_id: string }>(`SELECT winner_user_id FROM public.weekly_jackpots WHERE id = '${id}'`))[0].winner_user_id;
        wins[w]++;
      }
      expect(wins[ALICE]).toBeGreaterThan(wins[BOB]);
      expect(wins[ALICE] + wins[BOB]).toBe(60);
    });
    it("is closed to players and anonymous callers", async () => {
      const id = await endedWeek({ spins: 1, entries: [[ALICE, 1]] });
      await asUser(ALICE);
      await expect(db.query(`SELECT public.run_weekly_raffle()`)).rejects.toThrow(/permission denied/i);
      await expect(db.query(`SELECT public._raffle_draw('${id}', NULL)`)).rejects.toThrow(/permission denied/i);
      expect(await call(`public.select_jackpot_winner('${id}')`)).toEqual({ success: false, error: "Unauthorized" });
      await asAnon();
      await expect(db.query(`SELECT public.select_jackpot_winner('${id}')`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe("the prize queue", () => {
    const item = (week: string, extra: J = {}) => ({ week_start: week, prize_name: "Pro shop bundle", prize_credit: 20, prize_spins: 5, prize_products: "Hat", ...extra });
    it("lets only admin queue prizes", async () => {
      const [w] = await nextSundays(1);
      await asUser(ALICE);
      expect(await call(`public.admin_queue_raffle_prizes('${JSON.stringify([item(w)])}'::jsonb)`)).toEqual({ success: false, error: "Unauthorized" });
    });
    it("queues three months at once and updates a week instead of duplicating it", async () => {
      const weeks = await nextSundays(8);
      await asUser(ADMIN);
      const res = await call(`public.admin_queue_raffle_prizes('${JSON.stringify(weeks.map((w) => item(w)))}'::jsonb)`);
      expect(res).toMatchObject({ success: true, saved: 8, errors: [] });
      await asUser(ADMIN);
      await call(`public.admin_queue_raffle_prizes('${JSON.stringify([item(weeks[0], { prize_name: "Changed" })])}'::jsonb)`);
      const r = await rows<{ prize_name: string; status: string }>(`SELECT prize_name, status FROM public.weekly_jackpots ORDER BY starts_at`);
      expect(r).toHaveLength(8);
      expect(r[0].prize_name).toBe("Changed");
      expect(r.every((x) => x.status === "draft")).toBe(true);
    });
    it("starts each queued week at Sunday 8 pm Eastern and ends it a week later", async () => {
      const [w] = await nextSundays(1);
      await asUser(ADMIN);
      await call(`public.admin_queue_raffle_prizes('${JSON.stringify([item(w)])}'::jsonb)`);
      const r = await rows<{ s: string; e: string }>(`SELECT to_char(starts_at AT TIME ZONE 'America/New_York', 'Dy HH24:MI') AS s, to_char(ends_at AT TIME ZONE 'America/New_York', 'Dy HH24:MI') AS e FROM public.weekly_jackpots`);
      expect(r[0]).toEqual({ s: "Sun 20:00", e: "Sun 20:00" });
    });
    it("reports bad rows without losing the good ones", async () => {
      const [w] = await nextSundays(1);
      await asUser(ADMIN);
      const res = await call(`public.admin_queue_raffle_prizes('${JSON.stringify([item(w), item("2026-10-13"), item("2020-01-05"), item(w, { prize_name: "" }), item(w, { prize_credit: -5 })])}'::jsonb)`);
      expect(res.saved).toBe(1);
      expect(res.errors).toHaveLength(4);
      expect(res.errors[0].error).toMatch(/not a Sunday/);
      expect(res.errors[1].error).toMatch(/already ended/);
    });
    it("will not change a week that was already drawn, or take more than 20 weeks", async () => {
      const id = await endedWeek({ spins: 1, entries: [[ALICE, 1]] });
      await asAdmin();
      await db.exec(`SELECT public.run_weekly_raffle()`);
      await asUser(ADMIN);
      expect((await call(`public.admin_queue_raffle_prizes('[]'::jsonb)`)).success).toBe(false);
      const many = Array.from({ length: 21 }, (_, i) => item(`2030-01-${String(6 + 7 * i).padStart(2, "0")}`));
      expect((await call(`public.admin_queue_raffle_prizes('${JSON.stringify(many)}'::jsonb)`)).success).toBe(false);
      expect(id).toBeTruthy();
    });
    it("a queued prize becomes the running week when its time comes", async () => {
      await asAdmin();
      const cur = (await db.query<{ s: string }>(`SELECT to_char(public._raffle_week_start(now()) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS s`)).rows[0].s;
      await asUser(ADMIN);
      await call(`public.admin_queue_raffle_prizes('${JSON.stringify([item(cur, { prize_name: "This week prize" })])}'::jsonb)`);
      await asUser(ALICE);
      const home = await call(`public.get_raffle_home()`);
      expect(home.this_week.prize_name).toBe("This week prize");
      expect(home.this_week.my_entries).toBe(0);
    });
  });

  describe("what players see", () => {
    it("shows my entries this week and last week's winner by name", async () => {
      const id = await endedWeek({ spins: 1, entries: [[BOB, 3]] });
      await asAdmin();
      await db.exec(`SELECT public.run_weekly_raffle()`);
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 6, total_clovers = 6 WHERE user_id = '${ALICE}'`);
      await asUser(ALICE);
      const home = await call(`public.get_raffle_home()`);
      expect(home.this_week.my_entries).toBe(6);
      expect(home.this_week.prize_name).toBeNull(); // placeholder hides "Prize to be announced"
      expect(home.last_result).toMatchObject({ winner_name: "Bob", i_won: false, prize_name: "Prize" });
      await asUser(BOB);
      expect((await call(`public.get_raffle_home()`)).last_result.i_won).toBe(true);
      expect(id).toBeTruthy();
    });
    it("is closed to anonymous callers", async () => {
      await asAnon();
      await expect(db.query(`SELECT public.get_raffle_home()`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe("safety check", () => {
    it("refuses to apply without the jackpot tables", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + PAYMENTS_LIVE);
      await expect(d.exec(sql)).rejects.toThrow(/not found/);
      await d.close();
    });
  });
});
