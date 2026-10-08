import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, LIVE, migrationSql } from "./fixtures";

/**
 * Runs the real putt-spins migration against an in-process Postgres (pglite) with
 * stand-ins for the live pieces it changes: golfer_profiles, the old
 * award_spins_from_clovers trigger, the protected-columns trigger and the current
 * spend_putt(). Nothing here touches a real database.
 */

const sql = migrationSql("20261007120000_putt_spins.sql");

async function setup(withMigration: boolean) {
  const db = new PGlite();
  await db.exec(BASE + LIVE);
  if (withMigration) await db.exec(sql);
  return db;
}

describe("putt spins migration", () => {
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
  const rpc = async (call: string): Promise<Record<string, any>> => (await db.query<{ r: Record<string, any> }>(`SELECT ${call} AS r`)).rows[0].r;
  const spend = () => rpc("public.spend_putt()");
  const award = () => rpc("public.award_putt_spin()");
  const consume = () => rpc("public.consume_spin()");
  const spins = async (uid: string) => {
    await asAdmin();
    return (await db.query<{ spins: number }>(`SELECT spins FROM public.golfer_profiles WHERE user_id = '${uid}'`)).rows[0].spins;
  };
  const ledger = async (uid: string) => {
    await asAdmin();
    const r = await db.query<{ paid: number; claimed: number }>(`SELECT paid, claimed FROM public.putt_ledger WHERE user_id = '${uid}'`);
    return r.rows[0] ?? { paid: 0, claimed: 0 };
  };
  const giveCredits = async (uid: string, n: number) => {
    await asAdmin();
    await db.exec(`UPDATE public.golfer_profiles SET putt_credits = ${n} WHERE user_id = '${uid}'`);
  };

  beforeAll(async () => {
    db = await setup(true);
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

  describe("the old rule", () => {
    it("is real before the migration: 25 clovers used to hand out 2 spins", async () => {
      const before = await setup(false);
      await before.exec(`INSERT INTO auth.users (id) VALUES ('${ALICE}'); INSERT INTO public.golfer_profiles (user_id) VALUES ('${ALICE}');`);
      await before.exec(`UPDATE public.golfer_profiles SET total_clovers = 25 WHERE user_id = '${ALICE}'`);
      const r = await before.query<{ spins: number }>(`SELECT spins FROM public.golfer_profiles WHERE user_id = '${ALICE}'`);
      expect(r.rows[0].spins).toBe(5);
      await before.close();
    });

    it("is gone after it: earning clovers no longer grants spins", async () => {
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET clovers = 40, total_clovers = 40 WHERE user_id = '${ALICE}'`);
      expect(await spins(ALICE)).toBe(3);
    });

    it("removes the function and the trigger", async () => {
      await asAdmin();
      const f = await db.query("SELECT 1 FROM pg_proc WHERE proname = 'award_spins_from_clovers'");
      const t = await db.query("SELECT 1 FROM pg_trigger WHERE tgname = 'trg_award_spins'");
      expect(f.rows).toHaveLength(0);
      expect(t.rows).toHaveLength(0);
    });

    it("leaves the other profile trigger (protected columns) in place", async () => {
      await asUser(ALICE);
      await expect(db.exec(`UPDATE public.golfer_profiles SET spins = 999 WHERE user_id = '${ALICE}'`)).rejects.toThrow(/Protected columns/);
    });
  });

  describe("spend_putt", () => {
    it("still spends one credit, and now records a paid putt", async () => {
      await asUser(ALICE);
      expect(await spend()).toEqual({ success: true, credits: 4 });
      expect(await ledger(ALICE)).toEqual({ paid: 1, claimed: 0 });
    });

    it("records nothing when there are no putts left", async () => {
      await giveCredits(ALICE, 0);
      await asUser(ALICE);
      expect(await spend()).toEqual({ success: false, error: "No putts left" });
      expect(await ledger(ALICE)).toEqual({ paid: 0, claimed: 0 });
    });

    it("needs a signed-in user", async () => {
      await asUser(null);
      expect(await spend()).toEqual({ success: false, error: "Not authenticated" });
    });
  });

  describe("award_putt_spin", () => {
    it("cannot be claimed without a paid putt", async () => {
      await asUser(ALICE);
      expect(await award()).toEqual({ success: false, error: "No paid putt to claim" });
      expect(await spins(ALICE)).toBe(3);
    });

    it("gives exactly one spin per paid putt", async () => {
      await asUser(ALICE);
      await spend();
      await asUser(ALICE);
      expect(await award()).toEqual({ success: true, spins: 4 });
      expect(await spins(ALICE)).toBe(4);
      expect(await ledger(ALICE)).toEqual({ paid: 1, claimed: 1 });
      // The same putt cannot be claimed twice, however fast the taps.
      await asUser(ALICE);
      expect(await award()).toEqual({ success: false, error: "No paid putt to claim" });
      expect(await spins(ALICE)).toBe(4);
    });

    it("never lets spins won exceed putts paid", async () => {
      await asUser(ALICE);
      for (let i = 0; i < 3; i++) await spend();
      let won = 0;
      for (let i = 0; i < 10; i++) {
        await asUser(ALICE);
        if ((await award()).success) won++;
      }
      expect(won).toBe(3);
      expect(await spins(ALICE)).toBe(6);
      expect(await ledger(ALICE)).toEqual({ paid: 3, claimed: 3 });
    });

    it("keeps players separate", async () => {
      await asUser(ALICE);
      await spend();
      await asUser(BOB);
      expect(await award()).toEqual({ success: false, error: "No paid putt to claim" });
      expect(await spins(BOB)).toBe(3);
    });

    it("rolls the claim back if the profile is missing", async () => {
      await asUser(ALICE);
      await spend();
      await asAdmin();
      await db.exec(`DELETE FROM public.golfer_profiles WHERE user_id = '${ALICE}'`);
      await asUser(ALICE);
      await expect(award()).rejects.toThrow(/Profile not found/);
      expect(await ledger(ALICE)).toEqual({ paid: 1, claimed: 0 });
    });

    it("needs a signed-in user and is closed to anonymous callers", async () => {
      await asUser(null);
      expect(await award()).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(award()).rejects.toThrow(/permission denied/i);
    });
  });

  describe("consume_spin", () => {
    it("spends one saved spin", async () => {
      await asUser(ALICE);
      expect(await consume()).toEqual({ success: true, spins: 2 });
      expect(await spins(ALICE)).toBe(2);
    });

    it("stops at zero and never goes negative", async () => {
      await asUser(ALICE);
      expect((await consume()).success).toBe(true);
      expect((await consume()).success).toBe(true);
      expect((await consume()).success).toBe(true);
      expect(await consume()).toEqual({ success: false, error: "No spins remaining" });
      expect(await spins(ALICE)).toBe(0);
    });

    it("only touches the caller's own spins, and needs sign-in", async () => {
      await asUser(ALICE);
      await consume();
      expect(await spins(BOB)).toBe(3);
      await asUser(null);
      expect(await consume()).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(consume()).rejects.toThrow(/permission denied/i);
    });
  });

  describe("the ledger", () => {
    it("is readable by its owner only", async () => {
      await asUser(ALICE);
      await spend();
      await asUser(ALICE);
      expect((await db.query("SELECT * FROM public.putt_ledger")).rows).toHaveLength(1);
      await asUser(BOB);
      expect((await db.query("SELECT * FROM public.putt_ledger")).rows).toHaveLength(0);
    });

    it("cannot be written directly by a player", async () => {
      await asUser(ALICE);
      await expect(db.exec(`INSERT INTO public.putt_ledger (user_id, paid) VALUES ('${ALICE}', 1000)`)).rejects.toThrow(/permission denied/i);
      await spend();
      await asUser(ALICE);
      await expect(db.exec(`UPDATE public.putt_ledger SET paid = 1000 WHERE user_id = '${ALICE}'`)).rejects.toThrow(/permission denied/i);
      await expect(db.exec(`DELETE FROM public.putt_ledger WHERE user_id = '${ALICE}'`)).rejects.toThrow(/permission denied/i);
    });

    it("cannot be put into a state with more claims than paid putts", async () => {
      await asAdmin();
      await db.exec(`INSERT INTO public.putt_ledger (user_id, paid, claimed) VALUES ('${ALICE}', 1, 1)`);
      await expect(db.exec(`UPDATE public.putt_ledger SET claimed = 2 WHERE user_id = '${ALICE}'`)).rejects.toThrow(/claimed_le_paid|check constraint/i);
    });
  });

  describe("safety check", () => {
    const shell = BASE;

    it("refuses to apply when golfer_profiles is missing", async () => {
      const d = new PGlite();
      await d.exec(shell);
      await expect(d.exec(sql)).rejects.toThrow(/golfer_profiles not found/);
      await d.close();
    });

    it("refuses to apply when the profile columns are missing", async () => {
      const d = new PGlite();
      await d.exec(shell + "CREATE TABLE public.golfer_profiles (user_id UUID PRIMARY KEY);");
      await expect(d.exec(sql)).rejects.toThrow(/user_id, spins and putt_credits/);
      await d.close();
    });

    it("refuses to apply when spend_putt is missing, and leaves nothing behind", async () => {
      const d = new PGlite();
      await d.exec(shell + "CREATE TABLE public.golfer_profiles (user_id UUID PRIMARY KEY, spins INT, putt_credits INT);");
      await expect(d.exec(sql)).rejects.toThrow(/spend_putt/);
      const left = await d.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'putt_ledger'");
      expect(left.rows[0].n).toBe(0);
      await d.close();
    });
  });
});
