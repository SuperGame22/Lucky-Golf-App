import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, CLOVERS_LIVE, COMPETITIONS_LIVE, LIVE, PAYMENTS_LIVE, ROUNDS_LIVE, migrationSql } from "./fixtures";

const CAROL = "33333333-3333-3333-3333-333333333333";
const PARS = [4, 3, 5, 4, 4, 3, 5, 4, 4];

const files = [
  "20261007120000_putt_spins.sql",
  "20261009120000_home_clover_state.sql",
  "20261010120000_server_side_clovers.sql",
  "20261010130000_lock_clover_minting.sql",
  "20261011120000_spend_carry.sql",
  "20261011130000_lock_wheel_and_settle.sql",
  "20261012120000_wager_results.sql",
  "20261012130000_close_legacy_settle.sql",
  "20261014120000_site_purchases_and_discounts.sql",
  "20261027120000_security_hardening.sql",
];

const fresh = async () => {
  const d = new PGlite();
  await d.exec(BASE + LIVE + CLOVERS_LIVE + ROUNDS_LIVE + PAYMENTS_LIVE + COMPETITIONS_LIVE);
  await d.exec(`
    ALTER TABLE auth.users ADD COLUMN email TEXT, ADD COLUMN email_confirmed_at TIMESTAMPTZ, ADD COLUMN raw_user_meta_data JSONB;
    ALTER TABLE public.golfer_profiles ADD COLUMN role TEXT, ADD COLUMN display_name TEXT,
      ADD COLUMN membership_tier TEXT DEFAULT 'free', ADD COLUMN gold_balance NUMERIC DEFAULT 0;
    -- the app creates its own row at sign-up (live has an own-row insert policy)
    CREATE POLICY own_insert ON public.golfer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  `);
  for (const f of files) await d.exec(migrationSql(f));
  return d;
};

describe("security hardening", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false); SET ROLE authenticated;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const call = async (sql: string): Promise<J> => (await db.query<{ r: J }>(`SELECT ${sql} AS r`)).rows[0].r;
  const prof = async (uid: string) => {
    await asAdmin();
    return (await db.query<J>(`SELECT * FROM public.golfer_profiles WHERE user_id = '${uid}'`)).rows[0];
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
      DELETE FROM public.wager_confirmations; DELETE FROM public.wager_scores; DELETE FROM public.wager_games;
      DELETE FROM public.round_awards; DELETE FROM public.rounds; DELETE FROM public.spend_progress;
      DELETE FROM public.transactions; DELETE FROM public.wallets; DELETE FROM public.competition_players; DELETE FROM public.competitions;
      DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id, raw_user_meta_data) VALUES ('${ALICE}', '{"display_name":"Alice"}'), ('${BOB}', NULL), ('${CAROL}', '{}');
    `);
  });

  describe("profiles", () => {
    it("sign-up creates the profile row with the display name", async () => {
      expect((await prof(ALICE)).display_name).toBe("Alice");
      expect((await prof(BOB)).display_name).toBeNull();
      expect((await prof(ALICE)).membership_tier).toBe("free");
    });

    it("players can edit their own name but not role, tier, gold or clovers", async () => {
      await asUser(ALICE);
      await db.exec(`UPDATE public.golfer_profiles SET display_name = 'Al' WHERE user_id = '${ALICE}'`);
      expect((await prof(ALICE)).display_name).toBe("Al");

      for (const set of ["role = 'super_admin'", "membership_tier = 'gold'", "gold_balance = 999", "clovers = 9999"]) {
        await asUser(ALICE);
        await expect(db.exec(`UPDATE public.golfer_profiles SET ${set} WHERE user_id = '${ALICE}'`)).rejects.toThrow(/Protected columns/);
      }
      const p = await prof(ALICE);
      expect(p.role).toBeNull();
      expect(p.membership_tier).toBe("free");
    });

    it("players cannot insert a profile as admin or member; a plain row is fine", async () => {
      await asAdmin();
      await db.exec(`DELETE FROM public.golfer_profiles WHERE user_id = '${CAROL}'`);
      await asUser(CAROL);
      await expect(db.exec(`INSERT INTO public.golfer_profiles (user_id, role) VALUES ('${CAROL}', 'admin')`)).rejects.toThrow(/Protected/);
      await expect(db.exec(`INSERT INTO public.golfer_profiles (user_id, membership_tier) VALUES ('${CAROL}', 'gold')`)).rejects.toThrow(/Protected/);
      await db.exec(`INSERT INTO public.golfer_profiles (user_id, display_name) VALUES ('${CAROL}', 'Carol')`);
      expect((await prof(CAROL)).display_name).toBe("Carol");
    });

    it("the server can still change a tier or role", async () => {
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET membership_tier = 'clover', role = 'admin' WHERE user_id = '${BOB}'`);
      expect(await prof(BOB)).toMatchObject({ membership_tier: "clover", role: "admin" });
    });
  });

  describe("clovers", () => {
    it("a big spend grants every clover, in chunks of 500", async () => {
      await asAdmin();
      // $3,000 = 300,000 cents -> 750 clovers (old code: add_clovers refused >500 and nothing was granted)
      expect((await db.query<{ r: number }>(`SELECT public._apply_spend('${ALICE}', 300000) AS r`)).rows[0].r).toBe(750);
      expect((await prof(ALICE)).clovers).toBe(750);
      expect((await db.query<J>(`SELECT clovers_given FROM public.spend_progress WHERE user_id = '${ALICE}'`)).rows[0].clovers_given).toBe(750);
    });

    it("round clovers still pay 5 and respect the daily cap", async () => {
      await asAdmin();
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        ids.push((await db.query<{ id: string }>(`INSERT INTO public.rounds (user_id, completed) VALUES ('${ALICE}', true) RETURNING id`)).rows[0].id);
      }
      await asUser(ALICE);
      const got: number[] = [];
      for (const id of ids) got.push((await call(`public.award_round_clovers('${id}')`)).clovers);
      expect(got).toEqual([5, 5, 5, 0]);
      expect((await prof(ALICE)).clovers).toBe(15);
    });
  });

  describe("payments", () => {
    it("a Stripe reference is recorded only once", async () => {
      await asAdmin();
      await db.exec(`INSERT INTO public.transactions (user_id, type, amount, metadata) VALUES ('${ALICE}', 'purchase', 5, '{"stripe_ref":"pi_1"}')`);
      await expect(db.exec(`INSERT INTO public.transactions (user_id, type, amount, metadata) VALUES ('${ALICE}', 'purchase', 5, '{"stripe_ref":"pi_1"}')`)).rejects.toThrow(/unique|duplicate/i);
      await db.exec(`INSERT INTO public.transactions (user_id, type, amount, metadata) VALUES ('${ALICE}', 'purchase', 5, '{"stripe_ref":"pi_2"}')`);
    });

    it("players cannot write money tables directly", async () => {
      await asUser(ALICE);
      await expect(db.exec(`INSERT INTO public.wallets (user_id, balance) VALUES ('${ALICE}', 1000)`)).rejects.toThrow(/permission denied/);
      await expect(db.exec(`INSERT INTO public.transactions (user_id, type, amount) VALUES ('${ALICE}', 'deposit', 1000)`)).rejects.toThrow(/permission denied/);
      await expect(db.exec(`INSERT INTO public.competitions (creator_id, pot_total) VALUES ('${ALICE}', 1000)`)).rejects.toThrow(/permission denied/);
    });
  });

  describe("wagers need every partner", () => {
    const makeGame = async (players: string[]) => {
      await asAdmin();
      const comp = (await db.query<{ id: string }>(
        `INSERT INTO public.competitions (creator_id, buy_in, pot_total, status) VALUES ('${players[0]}', 10, ${10 * players.length}, 'active') RETURNING id`,
      )).rows[0].id;
      for (const [i, u] of players.entries()) {
        await db.exec(`INSERT INTO public.competition_players (competition_id, user_id, has_paid, created_at) VALUES ('${comp}', '${u}', true, now() + interval '${i} seconds')`);
      }
      await asUser(players[0]);
      await call(`public.wager_set_mode('${comp}', 'winner-takes-all')`);
      for (const u of players) {
        await asUser(u);
        for (const [h, s] of PARS.entries()) await call(`public.wager_submit_score('${comp}', ${h + 1}, ${u === BOB ? s - 1 : s})`);
      }
      await asUser(players[0]);
      await call(`public.wager_propose_result('${comp}')`);
      return comp;
    };
    const confirm = async (comp: string, uid: string, agrees: boolean) => {
      await asUser(uid);
      return call(`public.wager_confirm_result('${comp}', ${agrees})`);
    };
    const state = async (comp: string) => {
      await asAdmin();
      return (await db.query<{ state: string }>(`SELECT state FROM public.wager_games WHERE competition_id = '${comp}'`)).rows[0].state;
    };

    it("3 players: one partner's yes is not enough; both pay out", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL]);
      await confirm(comp, BOB, true);
      expect(await state(comp)).toBe("awaiting");
      await asUser(ALICE);
      expect((await call(`public.wager_status('${comp}')`)).partners_needed).toBe(2);
      await confirm(comp, CAROL, true);
      expect(await state(comp)).toBe("paid");
    });

    it("any no goes to admin review, even after a yes", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL]);
      await confirm(comp, BOB, true);
      await confirm(comp, CAROL, false);
      expect(await state(comp)).toBe("review");
    });

    it("2 players: the one partner decides", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await confirm(comp, BOB, true);
      expect(await state(comp)).toBe("paid");
    });
  });
});
