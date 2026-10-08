import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SELECTION_WEIGHTS, prizes } from "@/features/spinz/prizes";
import { ALICE, BASE, BOB, CLOVERS_LIVE, LIVE, ROUNDS_LIVE, migrationSql } from "./fixtures";

const spinsSql = migrationSql("20261007120000_putt_spins.sql");
const serverSql = migrationSql("20261010120000_server_side_clovers.sql");
const lockSql = migrationSql("20261010130000_lock_clover_minting.sql");

const base = async (withServer: boolean, withLock = false) => {
  const d = new PGlite();
  await d.exec(BASE + LIVE + CLOVERS_LIVE + ROUNDS_LIVE);
  await d.exec(spinsSql);
  if (withServer) await d.exec(serverSql);
  if (withLock) await d.exec(lockSql);
  return d;
};

describe("server-side clovers", () => {
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
  const spin = () => rpc("public.consume_spin(true)");
  const profile = async (uid: string) => {
    await asAdmin();
    return (await db.query<{ clovers: number; total_clovers: number; spins: number; putt_credits: number }>(
      `SELECT clovers, total_clovers, spins, putt_credits FROM public.golfer_profiles WHERE user_id = '${uid}'`,
    )).rows[0];
  };
  /** Make every spin land on one slice, so each prize type can be checked on its own. */
  const onlySlice = async (kind: string, clovers = 0) => {
    await asAdmin();
    await db.exec(`DELETE FROM public.spin_wheel_slices; INSERT INTO public.spin_wheel_slices VALUES (0, '${kind}', 'Test ${kind}', ${clovers}, 1)`);
  };

  beforeAll(async () => {
    db = await base(true);
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      DELETE FROM public.spin_log; DELETE FROM public.round_awards; DELETE FROM public.rounds;
      DELETE FROM public.putt_ledger;
      DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}');
      INSERT INTO public.golfer_profiles (user_id, putt_credits) VALUES ('${ALICE}', 5), ('${BOB}', 5);
    `);
  });

  describe("the wheel table", () => {
    it("is the same wheel as the page draws (kind, label, clovers, odds, order)", async () => {
      const fresh = await base(true);
      const rows = (await fresh.query<{ idx: number; kind: string; label: string; clovers: number; weight: string }>(
        "SELECT idx, kind, label, clovers, weight FROM public.spin_wheel_slices ORDER BY idx",
      )).rows;
      await fresh.close();
      expect(rows).toHaveLength(prizes.length);
      rows.forEach((r, i) => {
        expect(r.idx).toBe(i);
        expect(r.kind).toBe(prizes[i].type);
        expect(r.label).toBe(prizes[i].label);
        expect(r.clovers).toBe(prizes[i].clovers);
        expect(Math.abs(Number(r.weight) - SELECTION_WEIGHTS[i])).toBeLessThan(1e-9);
      });
    });

    it("cannot be read or changed by players", async () => {
      await asUser(ALICE);
      await expect(db.exec("SELECT * FROM public.spin_wheel_slices")).rejects.toThrow(/permission denied/i);
      await expect(db.exec("UPDATE public.spin_wheel_slices SET clovers = 500")).rejects.toThrow(/permission denied/i);
    });
  });

  describe("Spinz prize draw", () => {
    it("credits clovers itself and logs the spin", async () => {
      await onlySlice("clovers", 7);
      await asUser(ALICE);
      expect(await spin()).toEqual({ success: true, slice: 0, kind: "clovers", clovers: 7, spins: 2 });
      expect(await profile(ALICE)).toEqual({ clovers: 7, total_clovers: 7, spins: 2, putt_credits: 5 });
      await asAdmin();
      expect((await db.query("SELECT user_id, slice_idx, kind, clovers FROM public.spin_log")).rows).toEqual([
        { user_id: ALICE, slice_idx: 0, kind: "clovers", clovers: 7 },
      ]);
    });

    it("a Free Putt adds one putt to the count Lucky Putts shows", async () => {
      await onlySlice("free_putt");
      await asUser(ALICE);
      expect(await spin()).toMatchObject({ success: true, kind: "free_putt", credits: 6, spins: 2 });
      expect((await profile(ALICE)).putt_credits).toBe(6);
    });

    it("a Free Spin hands the spin back", async () => {
      await onlySlice("free_spin");
      await asUser(ALICE);
      expect(await spin()).toMatchObject({ success: true, kind: "free_spin", spins: 3 });
      expect((await profile(ALICE)).spins).toBe(3);
    });

    it.each(["none", "prize", "discount", "membership"])("a %s result only costs the spin", async (kind) => {
      await onlySlice(kind);
      await asUser(ALICE);
      expect(await spin()).toMatchObject({ success: true, kind, spins: 2 });
      expect(await profile(ALICE)).toEqual({ clovers: 0, total_clovers: 0, spins: 2, putt_credits: 5 });
    });

    it("needs a spin, a signed-in player, and does not log a refused spin", async () => {
      await onlySlice("clovers", 7);
      await asAdmin();
      await db.exec(`UPDATE public.golfer_profiles SET spins = 0 WHERE user_id = '${ALICE}'`);
      await asUser(ALICE);
      expect(await spin()).toEqual({ success: false, error: "No spins remaining" });
      await asUser(null);
      expect(await spin()).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(spin()).rejects.toThrow(/permission denied/i);
      expect((await profile(ALICE)).clovers).toBe(0);
      await asAdmin();
      expect((await db.query("SELECT 1 FROM public.spin_log")).rows).toHaveLength(0);
    });

    it("does not lose the spin if the wheel is somehow empty", async () => {
      await asAdmin();
      await db.exec("DELETE FROM public.spin_wheel_slices");
      await asUser(ALICE);
      await expect(spin()).rejects.toThrow(/not configured/);
      expect((await profile(ALICE)).spins).toBe(3);
    });

    it("only touches the spinner", async () => {
      await onlySlice("clovers", 9);
      await asUser(ALICE);
      await spin();
      expect(await profile(BOB)).toEqual({ clovers: 0, total_clovers: 0, spins: 3, putt_credits: 5 });
    });

    it("draws in proportion to the wheel's odds over many spins", async () => {
      const real = await base(true);
      await real.exec(`
        INSERT INTO auth.users (id) VALUES ('${ALICE}');
        INSERT INTO public.golfer_profiles (user_id, spins) VALUES ('${ALICE}', 6000);
        SELECT set_config('test.uid', '${ALICE}', false);
        SELECT setseed(0.31);
        SET ROLE authenticated;
      `);
      await real.exec("SELECT count(public.consume_spin(true)) FROM generate_series(1, 6000)");
      await real.exec("RESET ROLE");
      const counts = (await real.query<{ slice_idx: number; n: number }>("SELECT slice_idx, count(*)::int AS n FROM public.spin_log GROUP BY slice_idx")).rows;
      await real.close();
      const total = SELECTION_WEIGHTS.reduce((a, b) => a + b, 0);
      const byIdx = new Map(counts.map((c) => [c.slice_idx, c.n]));
      let seen = 0;
      SELECTION_WEIGHTS.forEach((w, i) => {
        const expected = (6000 * w) / total;
        const got = byIdx.get(i) ?? 0;
        seen += got;
        expect(Math.abs(got - expected)).toBeLessThan(5 * Math.sqrt(expected) + 2);
      });
      expect(seen).toBe(6000);
    }, 120000);
  });

  describe("the spin the live app makes today", () => {
    it("still works with no argument, including the Free Putt roll", async () => {
      await asAdmin();
      await db.exec("CREATE OR REPLACE FUNCTION public.free_putt_roll() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT true $$;");
      await asUser(ALICE);
      expect(await rpc("public.consume_spin()")).toEqual({ success: true, spins: 2, free_putt: true, credits: 6 });
      await asAdmin();
      await db.exec("CREATE OR REPLACE FUNCTION public.free_putt_roll() RETURNS BOOLEAN LANGUAGE sql AS $$ SELECT false $$;");
      await asUser(ALICE);
      expect(await rpc("public.consume_spin()")).toEqual({ success: true, spins: 1, free_putt: false });
      expect((await profile(ALICE)).clovers).toBe(0);
    });

    it("players cannot call the roll", async () => {
      await asUser(ALICE);
      await expect(db.exec("SELECT public.free_putt_roll()")).rejects.toThrow(/permission denied/i);
    });
  });

  describe("round clovers", () => {
    const newRound = async (uid: string, completed = true) => {
      await asAdmin();
      return (await db.query<{ id: string }>(`INSERT INTO public.rounds (user_id, completed) VALUES ('${uid}', ${completed}) RETURNING id`)).rows[0].id;
    };
    const award = (id: string) => rpc(`public.award_round_clovers('${id}')`);

    it("pays 5 clovers for a completed round, once", async () => {
      const id = await newRound(ALICE);
      await asUser(ALICE);
      expect(await award(id)).toEqual({ success: true, clovers: 5 });
      expect(await award(id)).toEqual({ success: true, clovers: 0, already_awarded: true });
      expect(await profile(ALICE)).toMatchObject({ clovers: 5, total_clovers: 5 });
      await asAdmin();
      expect((await db.query<{ clovers_earned: number }>(`SELECT clovers_earned FROM public.rounds WHERE id = '${id}'`)).rows[0].clovers_earned).toBe(5);
    });

    it("refuses another player's round, an unfinished round and unknown rounds", async () => {
      const bobs = await newRound(BOB);
      const open = await newRound(ALICE, false);
      await asUser(ALICE);
      expect(await award(bobs)).toEqual({ success: false, error: "Round not found" });
      expect(await award(open)).toEqual({ success: false, error: "Round not complete" });
      expect(await award("99999999-9999-9999-9999-999999999999")).toEqual({ success: false, error: "Round not found" });
      expect((await profile(ALICE)).clovers).toBe(0);
      expect((await profile(BOB)).clovers).toBe(0);
    });

    it("pays at most 3 rounds per 24 hours, and a refused round stays refused", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) ids.push(await newRound(ALICE));
      await asUser(ALICE);
      const results = [];
      for (const id of ids) results.push((await award(id)).clovers);
      expect(results).toEqual([5, 5, 5, 0, 0]);
      expect((await award(ids[3])).already_awarded).toBe(true);
      expect((await profile(ALICE)).clovers).toBe(15);
      // a day later new rounds pay again
      await asAdmin();
      await db.exec("UPDATE public.round_awards SET created_at = now() - interval '25 hours'");
      const later = await newRound(ALICE);
      await asUser(ALICE);
      expect(await award(later)).toEqual({ success: true, clovers: 5 });
    });

    it("needs a signed-in player and cannot be written to directly", async () => {
      const id = await newRound(ALICE);
      await asUser(null);
      expect(await award(id)).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(award(id)).rejects.toThrow(/permission denied/i);
      await asUser(ALICE);
      await expect(db.exec(`INSERT INTO public.round_awards (round_id, user_id, clovers) VALUES ('${id}', '${ALICE}', 500)`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe("safety checks", () => {
    it("refuses to apply without the rounds table", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + CLOVERS_LIVE);
      await d.exec(spinsSql);
      await expect(d.exec(serverSql)).rejects.toThrow(/rounds needs/);
      await d.close();
    });

    it("refuses to apply before the putt-spins migration", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + CLOVERS_LIVE + ROUNDS_LIVE);
      await expect(d.exec(serverSql)).rejects.toThrow(/consume_spin\(\) not found/);
      await d.close();
    });

    it("the old Free Putt file can no longer be run by mistake", async () => {
      const d = await base(true);
      await expect(d.exec(migrationSql("20261008120000_free_putt_spin.sql"))).rejects.toThrow(/Superseded/);
      await d.close();
    });
  });
});

describe("locking the minting functions", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string) => {
    await db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false); SET ROLE authenticated;`);
  };
  const asAnon = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE anon;`);
  const clovers = async (uid: string) => {
    await asAdmin();
    return (await db.query<{ clovers: number }>(`SELECT clovers FROM public.golfer_profiles WHERE user_id = '${uid}'`)).rows[0].clovers;
  };

  beforeAll(async () => {
    db = await base(true);
    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('${ALICE}');
      INSERT INTO public.golfer_profiles (user_id, putt_credits, spins) VALUES ('${ALICE}', 5, 50);
      -- Same shape as monocle_collect_clover(): a definer function that calls add_clovers for the caller.
      CREATE FUNCTION public.fake_monocle_collect() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
      BEGIN PERFORM public.add_clovers(p_user_id := auth.uid(), p_amount := 3); RETURN jsonb_build_object('success', true); END; $f$;
    `);
  });
  afterAll(async () => {
    await db.close();
  });

  it("before the lock a player can mint clovers by calling add_clovers (the hole)", async () => {
    await asUser(ALICE);
    await db.query(`SELECT public.add_clovers('${ALICE}', 500)`);
    expect(await clovers(ALICE)).toBe(500);
    await asAdmin();
    await db.exec(`UPDATE public.golfer_profiles SET clovers = 0, total_clovers = 0 WHERE user_id = '${ALICE}'`);
  });

  it("after the lock players and anonymous callers cannot call add_clovers or award_clovers", async () => {
    await asAdmin();
    await db.exec(lockSql);
    await asUser(ALICE);
    await expect(db.exec(`SELECT public.add_clovers('${ALICE}', 500)`)).rejects.toThrow(/permission denied/i);
    await expect(db.exec(`SELECT public.award_clovers('${ALICE}', 1000)`)).rejects.toThrow(/permission denied/i);
    await asAnon();
    await expect(db.exec(`SELECT public.add_clovers('${ALICE}', 1)`)).rejects.toThrow(/permission denied/i);
    expect(await clovers(ALICE)).toBe(0);
  });

  it("everything that earns clovers legitimately still works after the lock", async () => {
    // Spinz prize
    await asAdmin();
    await db.exec("DELETE FROM public.spin_wheel_slices; INSERT INTO public.spin_wheel_slices VALUES (0, 'clovers', '+4', 4, 1)");
    await asUser(ALICE);
    expect((await db.query<{ r: { clovers: number } }>("SELECT public.consume_spin(true) AS r")).rows[0].r.clovers).toBe(4);
    expect(await clovers(ALICE)).toBe(4);
    // round
    await asAdmin();
    const round = (await db.query<{ id: string }>(`INSERT INTO public.rounds (user_id, completed) VALUES ('${ALICE}', true) RETURNING id`)).rows[0].id;
    await asUser(ALICE);
    await db.query(`SELECT public.award_round_clovers('${round}')`);
    expect(await clovers(ALICE)).toBe(9);
    // Monocle-style definer call
    await asUser(ALICE);
    await db.query("SELECT public.fake_monocle_collect()");
    expect(await clovers(ALICE)).toBe(12);
  });

  it("the payment side (service key) can still call add_clovers", async () => {
    await asAdmin();
    await db.exec("SET ROLE service_role");
    await db.query(`SELECT public.add_clovers('${ALICE}', 10)`);
    await db.exec("RESET ROLE");
    expect(await clovers(ALICE)).toBe(22);
  });

  it("refuses to run before the server-side step", async () => {
    const d = await base(false);
    await expect(d.exec(lockSql)).rejects.toThrow(/apply 20261010120000/);
    await d.close();
  });
});
