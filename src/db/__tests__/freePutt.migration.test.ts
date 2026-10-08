import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, LIVE, migrationSql } from "./fixtures";

/**
 * Runs the Free Putt migration (on top of the putt-spins one) against an in-process Postgres.
 * The roll itself is swapped for a fixed answer in most tests so each branch is deterministic.
 */

const spinsSql = migrationSql("20261007120000_putt_spins.sql");
const freePuttSql = migrationSql("20261008120000_free_putt_spin.sql");

const forceRoll = (hit: boolean) =>
  `CREATE OR REPLACE FUNCTION public.free_putt_roll() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT ${hit} $$;`;

describe("free putt migration", () => {
  let db: PGlite;

  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string | null) => {
    await db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false);`);
    await db.exec("SET ROLE authenticated;");
  };
  const asAnon = async () => {
    await db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
    await db.exec("SET ROLE anon;");
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const consume = async (): Promise<Record<string, any>> => (await db.query<{ r: Record<string, any> }>("SELECT public.consume_spin() AS r")).rows[0].r;
  const profile = async (uid: string) => {
    await asAdmin();
    return (await db.query<{ spins: number; putt_credits: number }>(`SELECT spins, putt_credits FROM public.golfer_profiles WHERE user_id = '${uid}'`)).rows[0];
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE);
    await db.exec(spinsSql);
    await db.exec(freePuttSql);
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      TRUNCATE public.putt_ledger;
      DELETE FROM public.golfer_profiles;
      DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}');
      INSERT INTO public.golfer_profiles (user_id, putt_credits) VALUES ('${ALICE}', 5), ('${BOB}', 5);
    `);
  });

  describe("a spin that wins the Free Putt", () => {
    beforeEach(async () => {
      await asAdmin();
      await db.exec(forceRoll(true));
    });

    it("adds one putt in the same step and says so", async () => {
      await asUser(ALICE);
      expect(await consume()).toEqual({ success: true, spins: 2, free_putt: true, credits: 6 });
      expect(await profile(ALICE)).toEqual({ spins: 2, putt_credits: 6 });
    });

    it("is the putt count Lucky Putts reads (putt_credits), and only for the spinner", async () => {
      await asUser(ALICE);
      await consume();
      await consume();
      expect((await profile(ALICE)).putt_credits).toBe(7);
      expect(await profile(BOB)).toEqual({ spins: 3, putt_credits: 5 });
    });

    it("never goes past the spins a player has", async () => {
      await asUser(ALICE);
      for (let i = 0; i < 3; i++) expect((await consume()).free_putt).toBe(true);
      expect(await consume()).toEqual({ success: false, error: "No spins remaining" });
      expect(await profile(ALICE)).toEqual({ spins: 0, putt_credits: 8 });
    });

    it("gives nothing when there is no spin to spend", async () => {
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET spins = 0 WHERE user_id = '${ALICE}'`);
      await asUser(ALICE);
      expect(await consume()).toEqual({ success: false, error: "No spins remaining" });
      expect((await profile(ALICE)).putt_credits).toBe(5);
    });

    it("gives nothing to a signed-out or anonymous caller", async () => {
      await asUser(null);
      expect(await consume()).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(consume()).rejects.toThrow(/permission denied/i);
      expect(await profile(ALICE)).toEqual({ spins: 3, putt_credits: 5 });
    });
  });

  describe("a spin that misses", () => {
    it("spends the spin and adds no putt", async () => {
      await asAdmin();
      await db.exec(forceRoll(false));
      await asUser(ALICE);
      expect(await consume()).toEqual({ success: true, spins: 2, free_putt: false });
      expect(await profile(ALICE)).toEqual({ spins: 2, putt_credits: 5 });
    });
  });

  describe("access", () => {
    it("players cannot call the roll or add putts themselves", async () => {
      await asUser(ALICE);
      await expect(db.query("SELECT public.free_putt_roll()")).rejects.toThrow(/permission denied/i);
      await expect(db.exec(`UPDATE public.golfer_profiles SET putt_credits = 999 WHERE user_id = '${ALICE}'`)).rejects.toThrow(/Protected columns/);
      await asAnon();
      await expect(db.query("SELECT public.free_putt_roll()")).rejects.toThrow(/permission denied/i);
    });
  });

  describe("the real roll", () => {
    it("hits about 3% of the time, and credits exactly one putt per hit", async () => {
      // A fresh database with the real free_putt_roll() (the other tests replace it).
      const real = new PGlite();
      await real.exec(BASE + LIVE);
      await real.exec(spinsSql);
      await real.exec(freePuttSql);
      await real.exec(`
        INSERT INTO auth.users (id) VALUES ('${ALICE}');
        INSERT INTO public.golfer_profiles (user_id, spins, putt_credits) VALUES ('${ALICE}', 4000, 0);
        SELECT set_config('test.uid', '${ALICE}', false);
        SELECT setseed(0.42);
        SET ROLE authenticated;
      `);
      const r = await real.query<{ hits: number }>(
        "SELECT count(*) FILTER (WHERE (public.consume_spin()->>'free_putt')::boolean)::int AS hits FROM generate_series(1, 4000)",
      );
      await real.exec("RESET ROLE");
      const p = await real.query<{ spins: number; putt_credits: number }>("SELECT spins, putt_credits FROM public.golfer_profiles");
      const hits = r.rows[0].hits;
      // Expected 118 of 4000 (sd about 10.7): stay well inside 5 sd.
      expect(hits).toBeGreaterThan(65);
      expect(hits).toBeLessThan(171);
      expect(p.rows[0]).toEqual({ spins: 0, putt_credits: hits });
      await real.close();
    }, 60000);
  });

  describe("safety check", () => {
    it("refuses to apply before the putt-spins migration", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE);
      await expect(d.exec(freePuttSql)).rejects.toThrow(/consume_spin\(\) not found/);
      await d.close();
    });
  });
});
