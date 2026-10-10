import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, JACKPOTS_LIVE, LIVE, PAYMENTS_LIVE, migrationSql } from "./fixtures";

const ADMIN = "55555555-5555-5555-5555-555555555555";

describe("raffle names and beta survey", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string | null) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  const asAnon = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE anon;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const call = async (s: string): Promise<J> => (await db.query<{ r: J }>(`SELECT ${s} AS r`)).rows[0].r;
  const name = async (n: string | null) => { await asAdmin(); return (await db.query<{ r: string }>(`SELECT public._public_name($1) AS r`, [n])).rows[0].r; };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE + PAYMENTS_LIVE + JACKPOTS_LIVE);
    await db.exec(migrationSql("20261015120000_weekly_raffle.sql"));
    await db.exec(migrationSql("20261015130000_raffle_names_and_survey.sql"));
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      TRUNCATE public.beta_survey_answers, public.jackpot_entries, public.weekly_jackpots;
      DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}'), ('${ADMIN}');
      INSERT INTO public.golfer_profiles (user_id, display_name, role) VALUES ('${ALICE}', 'Alice Anderson', NULL), ('${BOB}', 'bob', NULL), ('${ADMIN}', 'Boss', 'admin');
    `);
  });

  it("shows winners as first name and last initial", async () => {
    expect(await name("Cole Matthews")).toBe("Cole M.");
    expect(await name("  mary  jane  van der berg ")).toBe("Mary B.");
    expect(await name("Tiger")).toBe("Tiger");
    expect(await name("")).toBe("A lucky golfer");
    expect(await name(null)).toBe("A lucky golfer");
  });

  it("the Home view uses that format, never the full name, and keeps the latest winner on show", async () => {
    await asAdmin();
    await db.exec(`INSERT INTO public.weekly_jackpots (prize_name, prize_spins, starts_at, ends_at, status) VALUES ('Old prize', 1, now() - interval '20 days', now() - interval '13 days', 'active')`);
    const id = (await db.query<{ id: string }>(`SELECT id FROM public.weekly_jackpots`)).rows[0].id;
    await db.exec(`INSERT INTO public.jackpot_entries (jackpot_id, user_id, entry_count) VALUES ('${id}', '${ALICE}', 2)`);
    await db.exec(`SELECT public.run_weekly_raffle()`);
    await asUser(BOB);
    const r = (await call(`public.get_raffle_home()`)).last_result;
    expect(r).toMatchObject({ winner_name: "Alice A.", i_won: false, prize_name: "Old prize" });
    expect(JSON.stringify(r)).not.toContain("Anderson");
  });

  describe("survey", () => {
    it("saves one answer per question and ignores a second try", async () => {
      await asUser(ALICE);
      expect(await call(`public.answer_beta_survey('prize_style', 'weekly_smaller')`)).toEqual({ success: true });
      await asUser(ALICE);
      await call(`public.answer_beta_survey('prize_style', 'monthly_bigger')`);
      await asUser(ALICE);
      const mine = (await db.query<{ answer: string }>(`SELECT answer FROM public.beta_survey_answers`)).rows;
      expect(mine).toEqual([{ answer: "weekly_smaller" }]);
    });
    it("rejects unknown questions and answers, and anonymous callers", async () => {
      await asUser(ALICE);
      expect((await call(`public.answer_beta_survey('prize_style', 'free money')`)).success).toBe(false);
      expect((await call(`public.answer_beta_survey('other', 'weekly_smaller')`)).success).toBe(false);
      await asUser(null);
      expect(await call(`public.answer_beta_survey('prize_style', 'weekly_smaller')`)).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(db.query(`SELECT public.answer_beta_survey('prize_style', 'weekly_smaller')`)).rejects.toThrow(/permission denied/i);
    });
    it("is private to its owner and cannot be written directly", async () => {
      await asUser(ALICE);
      await call(`public.answer_beta_survey('prize_style', 'weekly_smaller')`);
      await asUser(BOB);
      expect((await db.query(`SELECT * FROM public.beta_survey_answers`)).rows).toHaveLength(0);
      await expect(db.exec(`INSERT INTO public.beta_survey_answers (user_id, question_key, answer) VALUES ('${BOB}', 'prize_style', 'x')`)).rejects.toThrow(/permission denied/i);
    });
    it("lets only admin read the tallies", async () => {
      await asUser(ALICE); await call(`public.answer_beta_survey('prize_style', 'weekly_smaller')`);
      await asUser(BOB); await call(`public.answer_beta_survey('prize_style', 'weekly_smaller')`);
      await asUser(ALICE);
      expect(await call(`public.admin_survey_results()`)).toEqual({ success: false, error: "Unauthorized" });
      await asUser(ADMIN);
      expect((await call(`public.admin_survey_results()`)).results).toEqual([{ question_key: "prize_style", answer: "weekly_smaller", n: 2 }]);
    });
  });

  it("refuses to apply before the weekly raffle migration", async () => {
    const d = new PGlite();
    await d.exec(BASE + LIVE + PAYMENTS_LIVE + JACKPOTS_LIVE);
    await expect(d.exec(migrationSql("20261015130000_raffle_names_and_survey.sql"))).rejects.toThrow(/weekly raffle migration/);
    await d.close();
  });
});
