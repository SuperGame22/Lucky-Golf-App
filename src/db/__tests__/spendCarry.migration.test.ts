import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, CLOVERS_LIVE, LIVE, PAYMENTS_LIVE, ROUNDS_LIVE, migrationSql } from "./fixtures";

const files = [
  "20261007120000_putt_spins.sql",
  "20261009120000_home_clover_state.sql",
  "20261010120000_server_side_clovers.sql",
  "20261011120000_spend_carry.sql",
];
const carrySql = migrationSql(files[3]);

const fresh = async (upTo = files.length) => {
  const d = new PGlite();
  await d.exec(BASE + LIVE + CLOVERS_LIVE + ROUNDS_LIVE + PAYMENTS_LIVE);
  for (const f of files.slice(0, upTo)) await d.exec(migrationSql(f));
  return d;
};

describe("spend carry-over", () => {
  let db: PGlite;

  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false); SET ROLE authenticated;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = async (call: string): Promise<Record<string, any>> => (await db.query<{ r: Record<string, any> }>(`SELECT ${call} AS r`)).rows[0].r;
  /** What the Stripe functions do: credit a putt purchase, with the clovers the old rule gave (1 per $4, rounded down). */
  const buy = async (uid: string, dollars: number, ref: string, putts = 1) => {
    await asAdmin();
    return rpc(`public.credit_putts('${uid}', ${putts}, ${Math.floor(dollars / 4)}, ${dollars}, '${ref}')`);
  };
  const clovers = async (uid: string) => {
    await asAdmin();
    return (await db.query<{ clovers: number; total_clovers: number; putt_credits: number }>(
      `SELECT clovers, total_clovers, putt_credits FROM public.golfer_profiles WHERE user_id = '${uid}'`,
    )).rows[0];
  };
  const home = async (uid: string) => {
    await asUser(uid);
    return rpc("public.get_home_clovers()");
  };

  beforeAll(async () => {
    db = await fresh();
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      DELETE FROM public.spend_progress; DELETE FROM public.transactions; DELETE FROM public.wallets;
      DELETE FROM public.home_clover_state; DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}');
      INSERT INTO public.golfer_profiles (user_id) VALUES ('${ALICE}'), ('${BOB}');
    `);
  });

  describe("clovers", () => {
    it("four $1 putts earn a clover on the fourth (they used to earn none)", async () => {
      for (let i = 1; i <= 3; i++) {
        await buy(ALICE, 1, `r${i}`);
        expect((await clovers(ALICE)).clovers).toBe(0);
      }
      await buy(ALICE, 1, "r4");
      expect(await clovers(ALICE)).toMatchObject({ clovers: 1, total_clovers: 1, putt_credits: 4 });
    });

    it("a $6 spend is 1 clover with 2 dollars carried; $2 more completes another", async () => {
      await buy(ALICE, 6, "a", 5);
      expect((await clovers(ALICE)).clovers).toBe(1);
      await buy(ALICE, 2, "b", 2);
      expect((await clovers(ALICE)).clovers).toBe(2);
    });

    it("never pays twice for what the payment function already gave", async () => {
      await buy(ALICE, 7, "pack", 10); // credit_putts gives 1 (floor(7/4))
      expect((await clovers(ALICE)).clovers).toBe(1);
      await buy(ALICE, 1, "x"); // 8 total -> 2
      expect((await clovers(ALICE)).clovers).toBe(2);
      await asAdmin();
      expect((await db.query<{ cents_total: number; clovers_given: number }>("SELECT cents_total, clovers_given FROM public.spend_progress")).rows[0]).toEqual({ cents_total: 800, clovers_given: 2 });
    });

    it("total clovers always equal floor(total spend / $4)", async () => {
      const spends = [1, 3, 4, 1, 7, 2, 18, 1, 1, 1, 10, 5];
      let sum = 0;
      for (const [i, d] of spends.entries()) {
        await buy(ALICE, d, `p${i}`);
        sum += d;
        expect((await clovers(ALICE)).clovers).toBe(Math.floor(sum / 4));
      }
    });

    it("a repeated payment reference changes nothing", async () => {
      await buy(ALICE, 8, "same", 5);
      const again = await buy(ALICE, 8, "same", 5);
      expect(again).toMatchObject({ duplicate: true });
      expect(await clovers(ALICE)).toMatchObject({ clovers: 2, putt_credits: 5 });
    });

    it("keeps players separate", async () => {
      await buy(ALICE, 4, "a");
      expect((await clovers(BOB)).clovers).toBe(0);
    });

    it("ignores things that are not putt purchases", async () => {
      await asAdmin();
      await db.exec(`INSERT INTO public.transactions (user_id, type, amount, metadata) VALUES
        ('${ALICE}', 'deposit', 40, '{"stripe_session_id":"s1"}'),
        ('${ALICE}', 'purchase', 40, '{"stripe_session_id":"s2","clovers":10}')`);
      expect((await db.query("SELECT * FROM public.spend_progress")).rows).toHaveLength(0);
      expect((await clovers(ALICE)).clovers).toBe(0);
    });

    it("also adds the clovers to the raffle entries path (via add_clovers)", async () => {
      await buy(ALICE, 4, "a");
      expect((await clovers(ALICE)).total_clovers).toBe(1);
    });

    it("a failure in the top-up never undoes the purchase", async () => {
      const d = await fresh();
      await d.exec(`
        INSERT INTO auth.users (id) VALUES ('${ALICE}'); INSERT INTO public.golfer_profiles (user_id) VALUES ('${ALICE}');
        CREATE OR REPLACE FUNCTION public.add_clovers(p_user_id UUID, p_amount INTEGER) RETURNS JSONB LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'boom'; END; $f$;
      `);
      const r = await d.query<{ r: { success: boolean } }>(`SELECT public.credit_putts('${ALICE}', 4, 0, 4, 'z') AS r`);
      expect(r.rows[0].r.success).toBe(true);
      const p = await d.query<{ putt_credits: number }>("SELECT putt_credits FROM public.golfer_profiles");
      expect(p.rows[0].putt_credits).toBe(4);
      await d.close();
    });

    it("players cannot read or change anyone's spend, or call the trigger function", async () => {
      await buy(ALICE, 3, "a");
      await asUser(BOB);
      expect((await db.query("SELECT * FROM public.spend_progress")).rows).toHaveLength(0);
      await expect(db.exec(`UPDATE public.spend_progress SET cents_total = 99999999`)).rejects.toThrow(/permission denied/i);
      await expect(db.exec("SELECT public.spend_carry_on_purchase()")).rejects.toThrow(/permission denied/i);
      await asUser(ALICE);
      expect((await db.query("SELECT cents_total FROM public.spend_progress")).rows).toEqual([{ cents_total: 300 }]);
    });
  });

  describe("Home leaves", () => {
    it("a new player starts with no leaves and nothing to replay", async () => {
      expect(await home(ALICE)).toMatchObject({ pending: 0, pending_leaves: 0, rest_leaves: 0, spend_pending_clovers: 0 });
    });

    it("$6 spent: 6 new leaves, 1 clover; after the reveal 2 leaves stay lit", async () => {
      await home(ALICE);
      await buy(ALICE, 6, "a", 5);
      expect(await home(ALICE)).toMatchObject({ pending: 1, pending_leaves: 6, rest_leaves: 0, spend_pending_clovers: 1, cents: 600 });
      await asUser(ALICE);
      const done = await rpc("public.ack_home_clovers(1, 600)");
      expect(done).toMatchObject({ pending: 0, pending_leaves: 0, rest_leaves: 2, week_count: 1 });
      // $2 later: 2 new leaves, which complete the next clover
      await buy(ALICE, 2, "b", 2);
      expect(await home(ALICE)).toMatchObject({ pending_leaves: 2, rest_leaves: 2, spend_pending_clovers: 1, pending: 1 });
    });

    it("clovers that did not come from spending are still reported as pending", async () => {
      await home(ALICE);
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET clovers = clovers + 5, total_clovers = total_clovers + 5 WHERE user_id = '${ALICE}'`);
      expect(await home(ALICE)).toMatchObject({ pending: 5, pending_leaves: 0, spend_pending_clovers: 0 });
    });

    it("the older app (acknowledges only the clover total) clears the leaves too", async () => {
      await home(ALICE);
      await buy(ALICE, 3, "a");
      await asUser(ALICE);
      expect(await rpc("public.ack_home_clovers(0)")).toMatchObject({ pending_leaves: 0, rest_leaves: 3 });
    });

    it("cannot acknowledge more spend than there is, or go backwards", async () => {
      await home(ALICE);
      await buy(ALICE, 2, "a");
      await asUser(ALICE);
      expect(await rpc("public.ack_home_clovers(0, 999999)")).toMatchObject({ seen_cents: 200, rest_leaves: 2 });
      expect(await rpc("public.ack_home_clovers(0, 0)")).toMatchObject({ seen_cents: 200 });
      expect(await rpc("public.ack_home_clovers(0, -1)")).toEqual({ success: false, error: "Invalid amount" });
    });
  });

  describe("safety checks", () => {
    it("refuses to apply before the home clover migration", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + CLOVERS_LIVE + ROUNDS_LIVE + PAYMENTS_LIVE);
      await expect(d.exec(carrySql)).rejects.toThrow(/apply 20261009120000/);
      await d.close();
    });
    it("refuses to apply without the transactions table", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + CLOVERS_LIVE);
      await expect(d.exec(carrySql)).rejects.toThrow(/transactions not found/);
      await d.close();
    });
  });
});
