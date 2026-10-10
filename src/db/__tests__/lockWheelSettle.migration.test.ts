import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, COMPETITIONS_LIVE, LIVE, PAYMENTS_LIVE, migrationSql } from "./fixtures";

const sql = migrationSql("20261011130000_lock_wheel_and_settle.sql");
const CAROL = "33333333-3333-3333-3333-333333333333";

const fresh = async () => {
  const d = new PGlite();
  await d.exec(BASE + LIVE + PAYMENTS_LIVE + COMPETITIONS_LIVE);
  return d;
};

describe("lock wheel and settle", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string | null) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  const asAnon = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE anon;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settle = async (comp: string, winner: string): Promise<Record<string, any>> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (await db.query<{ r: Record<string, any> }>(`SELECT public.settle_competition('${comp}', '${winner}') AS r`)).rows[0].r;
  const balance = async (uid: string) => {
    await asAdmin();
    return Number((await db.query<{ balance: string }>(`SELECT balance FROM public.wallets WHERE user_id = '${uid}'`)).rows[0]?.balance ?? 0);
  };

  beforeAll(async () => {
    db = await fresh();
    await db.exec(sql);
  });
  afterAll(async () => {
    await db.close();
  });

  let comp = "";
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      DELETE FROM public.transactions; DELETE FROM public.wallets; DELETE FROM public.competition_players; DELETE FROM public.competitions;
      DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}'), ('${CAROL}');
    `);
    comp = (await db.query<{ id: string }>(`INSERT INTO public.competitions (creator_id, pot_total, status) VALUES ('${ALICE}', 40, 'active') RETURNING id`)).rows[0].id;
    await db.exec(`INSERT INTO public.competition_players (competition_id, user_id, has_paid) VALUES
      ('${comp}', '${ALICE}', true), ('${comp}', '${BOB}', true), ('${comp}', '${CAROL}', false)`);
  });

  describe("settle_competition", () => {
    it("the creator can settle and the winner is paid the pot once", async () => {
      await asUser(ALICE);
      expect(await settle(comp, BOB)).toMatchObject({ success: true, winner_id: BOB, amount: 40 });
      expect(await balance(BOB)).toBe(40);
      await asUser(ALICE);
      expect(await settle(comp, BOB)).toEqual({ success: true, duplicate: true });
      expect(await balance(BOB)).toBe(40);
    });

    it("a paid player who is not the creator can no longer name themselves the winner", async () => {
      await asUser(BOB);
      await expect(settle(comp, BOB)).rejects.toThrow(/Only the player who created/);
      expect(await balance(BOB)).toBe(0);
      await asAdmin();
      expect((await db.query<{ status: string }>(`SELECT status FROM public.competitions WHERE id = '${comp}'`)).rows[0].status).toBe("active");
    });

    it("still refuses a winner who did not pay, and strangers", async () => {
      await asUser(ALICE);
      await expect(settle(comp, CAROL)).rejects.toThrow(/not a paid participant/);
      await db.exec(`RESET ROLE; SELECT set_config('test.uid', '${CAROL}', false); SET ROLE authenticated;`);
      await expect(settle(comp, ALICE)).rejects.toThrow(/Only the player who created/);
    });

    it("the host can still cancel and refund themselves when nobody else paid", async () => {
      await asAdmin();
      await db.exec(`DELETE FROM public.competition_players WHERE user_id <> '${ALICE}'`);
      await asUser(ALICE);
      expect(await settle(comp, ALICE)).toMatchObject({ success: true, winner_id: ALICE });
      expect(await balance(ALICE)).toBe(40);
    });

    it("needs a signed-in player and an existing competition; anonymous callers are refused", async () => {
      await asUser(null);
      await expect(settle(comp, ALICE)).rejects.toThrow(/Not authenticated/);
      await asUser(ALICE);
      await expect(settle("99999999-9999-9999-9999-999999999999", ALICE)).rejects.toThrow(/Competition not found/);
      await asAnon();
      await expect(settle(comp, ALICE)).rejects.toThrow(/permission denied/i);
    });

    it("the paying function underneath cannot be called directly", async () => {
      await asUser(BOB);
      await expect(db.exec(`SELECT public._settle_competition_pay('${comp}', '${BOB}')`)).rejects.toThrow(/permission denied/i);
      await asAnon();
      await expect(db.exec(`SELECT public._settle_competition_pay('${comp}', '${BOB}')`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe("old spin wheel", () => {
    it("removes spin_wheel() and the empty prize tables", async () => {
      await asAdmin();
      expect((await db.query("SELECT 1 FROM pg_proc WHERE proname = 'spin_wheel'")).rows).toHaveLength(0);
      expect(await db.query("SELECT to_regclass('public.spin_prizes') AS a, to_regclass('public.spin_results') AS b").then((r) => r.rows[0])).toEqual({ a: null, b: null });
    });

    it("keeps a table that has rows in it", async () => {
      const d = await fresh();
      await d.exec(`INSERT INTO public.spin_prizes (label, weight) VALUES ('Putter', 1)`);
      await d.exec(sql);
      const r = await d.query<{ a: string | null; b: string | null }>("SELECT to_regclass('public.spin_prizes')::text AS a, to_regclass('public.spin_results')::text AS b");
      expect(r.rows[0].a).toBe("spin_prizes");
      expect(r.rows[0].b).toBeNull();
      await d.close();
    });

    it("can be run twice without harm", async () => {
      await asAdmin();
      await db.exec(sql);
      await asUser(ALICE);
      expect(await settle(comp, BOB)).toMatchObject({ success: true });
    });
  });

  describe("safety check", () => {
    it("refuses to apply without settle_competition", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + PAYMENTS_LIVE);
      await d.exec("CREATE TABLE public.competitions (id UUID PRIMARY KEY, creator_id UUID, status TEXT);");
      await expect(d.exec(sql)).rejects.toThrow(/settle_competition\(uuid, uuid\) not found/);
      await d.close();
    });
  });
});
