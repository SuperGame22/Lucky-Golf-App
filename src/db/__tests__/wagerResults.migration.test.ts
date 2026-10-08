import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, COMPETITIONS_LIVE, LIVE, PAYMENTS_LIVE, migrationSql } from "./fixtures";

const CAROL = "33333333-3333-3333-3333-333333333333";
const DAVE = "44444444-4444-4444-4444-444444444444";
const ADMIN = "55555555-5555-5555-5555-555555555555";
const PARS = [4, 3, 5, 4, 4, 3, 5, 4, 4];

const wagerSql = migrationSql("20261012120000_wager_results.sql");
const legacySql = migrationSql("20261012130000_close_legacy_settle.sql");
const settleGuardSql = migrationSql("20261011130000_lock_wheel_and_settle.sql");

const fresh = async () => {
  const d = new PGlite();
  await d.exec(BASE + LIVE + PAYMENTS_LIVE + COMPETITIONS_LIVE);
  await d.exec("ALTER TABLE public.golfer_profiles ADD COLUMN role TEXT, ADD COLUMN display_name TEXT;");
  await d.exec(settleGuardSql);
  await d.exec(wagerSql);
  return d;
};

describe("wager results", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string | null) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  const asAnon = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE anon;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const call = async (sql: string): Promise<J> => (await db.query<{ r: J }>(`SELECT ${sql} AS r`)).rows[0].r;
  const balance = async (uid: string) => {
    await asAdmin();
    return Number((await db.query<{ balance: string }>(`SELECT balance FROM public.wallets WHERE user_id = '${uid}'`)).rows[0]?.balance ?? 0);
  };
  const state = async (comp: string) => {
    await asAdmin();
    return (await db.query<{ state: string }>(`SELECT state FROM public.wager_games WHERE competition_id = '${comp}'`)).rows[0].state;
  };
  const compStatus = async (comp: string) => {
    await asAdmin();
    return (await db.query<{ status: string; winner_id: string | null }>(`SELECT status, winner_id FROM public.competitions WHERE id = '${comp}'`)).rows[0];
  };

  /** A wager with `players` paying in (first is the host), a mode, and each player's 9 scores. */
  const makeGame = async (players: string[], opts: { mode?: string; buyIn?: number; scores?: Record<string, number[]> } = {}) => {
    const buyIn = opts.buyIn ?? 10;
    await asAdmin();
    const comp = (await db.query<{ id: string }>(
      `INSERT INTO public.competitions (creator_id, buy_in, pot_total, status) VALUES ('${players[0]}', ${buyIn}, ${buyIn * players.length}, 'active') RETURNING id`,
    )).rows[0].id;
    for (const [i, u] of players.entries()) {
      await db.exec(`INSERT INTO public.competition_players (competition_id, user_id, has_paid, created_at) VALUES ('${comp}', '${u}', true, now() + interval '${i} seconds')`);
    }
    await asUser(players[0]);
    await call(`public.wager_set_mode('${comp}', '${opts.mode ?? "winner-takes-all"}')`);
    for (const u of players) {
      const sc = opts.scores?.[u] ?? PARS;
      await asUser(u);
      for (const [h, s] of sc.entries()) await call(`public.wager_submit_score('${comp}', ${h + 1}, ${s})`);
    }
    return comp;
  };
  const propose = async (comp: string, host = ALICE) => {
    await asUser(host);
    return call(`public.wager_propose_result('${comp}')`);
  };
  const confirm = async (comp: string, uid: string, agrees: boolean) => {
    await asUser(uid);
    return call(`public.wager_confirm_result('${comp}', ${agrees})`);
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
      DELETE FROM public.transactions; DELETE FROM public.wallets; DELETE FROM public.competition_players; DELETE FROM public.competitions;
      DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}'), ('${CAROL}'), ('${DAVE}'), ('${ADMIN}');
      INSERT INTO public.golfer_profiles (user_id, role, display_name) VALUES ('${ADMIN}', 'admin', 'Admin'), ('${ALICE}', NULL, 'Alice'), ('${BOB}', NULL, 'Bob');
    `);
  });

  describe("scores and the result", () => {
    it("works out a stroke-play winner from the saved scores, nobody names one", async () => {
      const comp = await makeGame([ALICE, BOB], { scores: { [ALICE]: PARS.map((p) => p + 1), [BOB]: PARS } });
      const r = await propose(comp);
      expect(r).toMatchObject({ success: true, state: "awaiting" });
      expect(r.standings.winners).toEqual([BOB]);
      expect(r.standings.players).toHaveLength(2);
    });

    it("king of the pars: most holes at or under par", async () => {
      const bogeyEverywhere = PARS.map((p) => p + 1);
      const fiveClean = PARS.map((p, i) => (i < 5 ? p : p + 2));
      const comp = await makeGame([ALICE, BOB], { mode: "king-of-pars", scores: { [ALICE]: bogeyEverywhere, [BOB]: fiveClean } });
      expect((await propose(comp)).standings.winners).toEqual([BOB]);
    });

    it("a tie lists every tied player", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL], { scores: { [CAROL]: PARS.map((p) => p + 2) } });
      expect((await propose(comp)).standings.winners).toEqual([ALICE, BOB]);
    });

    it("only the host can set the mode or ask for the result, and only once all scores are in", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await asUser(BOB);
      expect(await call(`public.wager_set_mode('${comp}', 'king-of-pars')`)).toMatchObject({ success: false });
      expect(await call(`public.wager_propose_result('${comp}')`)).toMatchObject({ success: false, error: "Only the host can finish the wager" });

      await asAdmin();
      await db.exec(`DELETE FROM public.wager_scores WHERE user_id = '${BOB}' AND hole = 9`);
      const r = await propose(comp);
      expect(r).toMatchObject({ success: false });
      expect(r.error).toMatch(/all their scores/);
      expect(await state(comp)).toBe("playing");
    });

    it("scores: paying players only, valid values only, correctable until the result is asked for", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await asUser(CAROL);
      expect(await call(`public.wager_submit_score('${comp}', 1, 4)`)).toMatchObject({ success: false });
      await asUser(BOB);
      expect(await call(`public.wager_submit_score('${comp}', 0, 4)`)).toMatchObject({ success: false });
      expect(await call(`public.wager_submit_score('${comp}', 10, 4)`)).toMatchObject({ success: false });
      expect(await call(`public.wager_submit_score('${comp}', 1, 0)`)).toMatchObject({ success: false });
      expect(await call(`public.wager_submit_score('${comp}', 1, 16)`)).toMatchObject({ success: false });
      expect(await call(`public.wager_submit_score('${comp}', 1, 2)`)).toMatchObject({ success: true });
      await propose(comp);
      await asUser(BOB);
      expect(await call(`public.wager_submit_score('${comp}', 1, 1)`)).toEqual({ success: false, error: "Scores are closed" });
    });

    it("players cannot write the tables directly or read other wagers", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await asUser(BOB);
      await expect(db.exec(`UPDATE public.wager_scores SET score = 1`)).rejects.toThrow(/permission denied/i);
      await expect(db.exec(`UPDATE public.wager_games SET state = 'paid'`)).rejects.toThrow(/permission denied/i);
      await expect(db.exec(`INSERT INTO public.wager_confirmations VALUES ('${comp}', '${BOB}', true)`)).rejects.toThrow(/permission denied/i);
      await asUser(CAROL);
      expect((await db.query("SELECT * FROM public.wager_scores")).rows).toHaveLength(0);
      expect((await db.query("SELECT * FROM public.wager_games")).rows).toHaveLength(0);
    });
  });

  describe("confirmation by majority", () => {
    it("2 players: the partner confirms and the winner is paid the pot", async () => {
      const comp = await makeGame([ALICE, BOB], { scores: { [ALICE]: PARS.map((p) => p + 1) } });
      await propose(comp);
      expect(await state(comp)).toBe("awaiting");
      expect(await balance(BOB)).toBe(0);
      const r = await confirm(comp, BOB, true);
      expect(r).toMatchObject({ success: true, state: "paid" });
      expect(await balance(BOB)).toBe(20);
      expect(await balance(ALICE)).toBe(0);
      expect(await compStatus(comp)).toMatchObject({ status: "completed", winner_id: BOB });
    });

    it("2 players: a partner who disputes sends it to review, and nothing is paid", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await propose(comp);
      expect(await confirm(comp, BOB, false)).toMatchObject({ success: true, state: "review" });
      expect(await balance(ALICE)).toBe(0);
      expect(await balance(BOB)).toBe(0);
    });

    it("2 players: a partner who never answers leaves it waiting (and it shows up for admins after 48 hours)", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await propose(comp);
      expect(await state(comp)).toBe("awaiting");
      await asUser(ADMIN);
      expect((await call("public.admin_wager_review_list()")).wagers).toHaveLength(0);
      await asAdmin();
      await db.exec(`UPDATE public.wager_games SET proposed_at = now() - interval '49 hours'`);
      await asUser(ADMIN);
      expect((await call("public.admin_wager_review_list()")).wagers.map((w: J) => w.competition_id)).toEqual([comp]);
    });

    it("3 players: the host needs just one partner", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL], { scores: { [ALICE]: PARS.map((p) => p + 1), [CAROL]: PARS.map((p) => p + 2) } });
      await propose(comp);
      expect(await confirm(comp, CAROL, true)).toMatchObject({ success: true, state: "paid" });
      expect(await balance(BOB)).toBe(30);
    });

    it("3 players: one dispute is not enough to stop it, two are", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL]);
      await propose(comp);
      expect(await confirm(comp, BOB, false)).toMatchObject({ state: "awaiting" });
      expect(await confirm(comp, CAROL, false)).toMatchObject({ state: "review" });
    });

    it("4 players: the host needs two partners; one is not enough", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL, DAVE], { scores: { [DAVE]: PARS.map((p) => p - 1) } });
      await propose(comp);
      expect(await confirm(comp, BOB, true)).toMatchObject({ state: "awaiting", confirmed: 1, needed: 2 });
      expect(await balance(DAVE)).toBe(0);
      expect(await confirm(comp, CAROL, true)).toMatchObject({ state: "paid" });
      expect(await balance(DAVE)).toBe(40);
    });

    it("4 players: two disputes make a majority impossible", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL, DAVE]);
      await propose(comp);
      expect(await confirm(comp, BOB, false)).toMatchObject({ state: "awaiting" });
      expect(await confirm(comp, CAROL, false)).toMatchObject({ state: "review" });
    });

    it("4 players: one dispute does not stop the other two from confirming", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL, DAVE]);
      await propose(comp);
      await confirm(comp, BOB, false);
      await confirm(comp, CAROL, true);
      expect(await confirm(comp, DAVE, true)).toMatchObject({ state: "paid" });
    });

    it("a partner can change their mind until it is settled", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL]);
      await propose(comp);
      await confirm(comp, BOB, false);
      expect(await confirm(comp, BOB, true)).toMatchObject({ state: "paid" });
    });

    it("the host cannot confirm their own result, strangers cannot confirm, and it cannot be paid twice", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await propose(comp);
      expect(await confirm(comp, ALICE, true)).toMatchObject({ success: false });
      expect(await confirm(comp, CAROL, true)).toMatchObject({ success: false });
      await confirm(comp, BOB, true);
      const again = await confirm(comp, BOB, true);
      expect(again).toMatchObject({ success: false });
      expect(await balance(ALICE) + (await balance(BOB))).toBe(20);
    });

    it("cannot be confirmed before the host has asked for the result", async () => {
      const comp = await makeGame([ALICE, BOB]);
      expect(await confirm(comp, BOB, true)).toMatchObject({ success: false });
    });
  });

  describe("payout", () => {
    it("a tie splits the pot evenly", async () => {
      const comp = await makeGame([ALICE, BOB], { buyIn: 20 });
      await propose(comp);
      await confirm(comp, BOB, true);
      expect(await balance(ALICE)).toBe(20);
      expect(await balance(BOB)).toBe(20);
    });

    it("an odd cent goes to the earliest-joined tied player and the total always equals the pot", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL], { buyIn: 3.34 });
      await propose(comp); // pot 10.02 split 3 ways = 3.34 each
      await confirm(comp, BOB, true);
      expect(await balance(ALICE) + (await balance(BOB)) + (await balance(CAROL))).toBeCloseTo(10.02, 2);
      const comp2 = await makeGame([ALICE, BOB, CAROL], { buyIn: 3.33, scores: {} });
      await asAdmin();
      await db.exec(`DELETE FROM public.transactions; DELETE FROM public.wallets;`);
      await propose(comp2);
      await confirm(comp2, BOB, true); // pot 9.99 split 3 ways
      await asAdmin();
      const t = (await db.query<{ user_id: string; amount: string }>(`SELECT user_id, amount FROM public.transactions WHERE metadata->>'competition_id' = '${comp2}' ORDER BY created_at, user_id`)).rows;
      expect(t.reduce((a, r) => a + Number(r.amount), 0)).toBeCloseTo(9.99, 2);
      const t2 = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.transactions WHERE type = 'winnings'`);
      expect(t2.rows[0].n).toBe(3);
    });

    it("splits an uneven pot cent by cent", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL], { buyIn: 3.34 });
      await asAdmin();
      await db.exec(`UPDATE public.competitions SET pot_total = 10.00 WHERE id = '${comp}'`);
      await propose(comp);
      await confirm(comp, BOB, true);
      expect([await balance(ALICE), await balance(BOB), await balance(CAROL)]).toEqual([3.34, 3.33, 3.33]);
    });

    it("records the winnings as transactions", async () => {
      const comp = await makeGame([ALICE, BOB], { scores: { [ALICE]: PARS.map((p) => p + 1) } });
      await propose(comp);
      await confirm(comp, BOB, true);
      await asAdmin();
      const t = (await db.query<{ type: string; amount: string; user_id: string }>(`SELECT type, amount, user_id FROM public.transactions`)).rows;
      expect(t.map((r) => ({ ...r, amount: Number(r.amount) }))).toEqual([{ type: "winnings", amount: 20, user_id: BOB }]);
    });
  });

  describe("status, pending list, review", () => {
    it("a partner sees the wager waiting for them until they answer", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL]);
      await propose(comp);
      await asUser(BOB);
      expect((await call("public.wager_pending_for_me()")).map((p: J) => p.competition_id)).toEqual([comp]);
      await asUser(ALICE);
      expect(await call("public.wager_pending_for_me()")).toEqual([]);
      await confirm(comp, BOB, true);
      await asUser(CAROL);
      expect(await call("public.wager_pending_for_me()")).toEqual([]); // already paid
    });

    it("status shows the rule for the group size", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL, DAVE]);
      await propose(comp);
      await asUser(BOB);
      expect(await call(`public.wager_status('${comp}')`)).toMatchObject({ state: "awaiting", players: 4, partners_needed: 2, is_host: false, host_id: ALICE });
      const full = await call(`public.wager_status('${comp}')`);
      expect(full.names).toMatchObject({ [ALICE]: "Alice", [BOB]: "Bob" });
      expect(Object.keys(full.names)).toHaveLength(4);
      expect(full.scores[ALICE]["1"]).toBe(4);
      expect(Object.keys(full.scores[ALICE])).toHaveLength(9);
      await asUser("66666666-6666-6666-6666-666666666666");
      expect(await call(`public.wager_status('${comp}')`)).toMatchObject({ success: false });
    });

    it("anyone in the wager can flag it for review; strangers cannot", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await asUser(CAROL);
      expect(await call(`public.wager_send_to_review('${comp}')`)).toMatchObject({ success: false });
      await asUser(BOB);
      expect(await call(`public.wager_send_to_review('${comp}')`)).toMatchObject({ success: true, state: "review" });
    });
  });

  describe("admin", () => {
    it("pushes a reviewed wager through: pays the winner the scores give", async () => {
      const comp = await makeGame([ALICE, BOB], { scores: { [ALICE]: PARS.map((p) => p + 1) } });
      await propose(comp);
      await confirm(comp, BOB, false);
      expect(await state(comp)).toBe("review");
      await asUser(ADMIN);
      const list = (await call("public.admin_wager_review_list()")).wagers;
      expect(list).toHaveLength(1);
      expect(list[0].players.map((p: J) => p.name).sort()).toEqual(["Alice", "Bob"]);
      expect(await call(`public.admin_resolve_wager('${comp}', 'pay')`)).toMatchObject({ success: true, winners: [BOB] });
      expect(await balance(BOB)).toBe(20);
      expect(await state(comp)).toBe("paid");
      await asUser(ADMIN);
      expect(await call(`public.admin_resolve_wager('${comp}', 'pay')`)).toMatchObject({ duplicate: true });
      expect(await balance(BOB)).toBe(20);
    });

    it("or refunds every buy-in", async () => {
      const comp = await makeGame([ALICE, BOB, CAROL], { buyIn: 15 });
      await asUser(BOB);
      await call(`public.wager_send_to_review('${comp}')`);
      await asUser(ADMIN);
      expect(await call(`public.admin_resolve_wager('${comp}', 'refund')`)).toMatchObject({ success: true, refunded: 3, buy_in: 15 });
      expect([await balance(ALICE), await balance(BOB), await balance(CAROL)]).toEqual([15, 15, 15]);
      expect(await compStatus(comp)).toMatchObject({ status: "cancelled" });
      expect(await state(comp)).toBe("refunded");
      await asAdmin();
      expect((await db.query("SELECT 1 FROM public.transactions WHERE type = 'refund'")).rows).toHaveLength(3);
      await asUser(ADMIN);
      expect(await call(`public.admin_resolve_wager('${comp}', 'refund')`)).toMatchObject({ duplicate: true });
      expect(await balance(ALICE)).toBe(15);
    });

    it("cannot pay a wager whose scores are incomplete", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await asAdmin();
      await db.exec(`DELETE FROM public.wager_scores WHERE user_id = '${BOB}' AND hole > 5`);
      await asUser(ADMIN);
      expect(await call(`public.admin_resolve_wager('${comp}', 'pay')`)).toMatchObject({ success: false });
      expect(await call(`public.admin_resolve_wager('${comp}', 'refund')`)).toMatchObject({ success: true });
    });

    it("is for admins only", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await asUser(ALICE);
      expect(await call("public.admin_wager_review_list()")).toMatchObject({ success: false, error: "Unauthorized" });
      expect(await call(`public.admin_resolve_wager('${comp}', 'refund')`)).toMatchObject({ success: false, error: "Unauthorized" });
      await asAnon();
      await expect(call("public.admin_wager_review_list()")).rejects.toThrow(/permission denied/i);
    });
  });

  describe("signed-out and internal access", () => {
    it("refuses signed-out and anonymous callers, and hides the internals", async () => {
      const comp = await makeGame([ALICE, BOB]);
      await asUser(null);
      expect(await call(`public.wager_submit_score('${comp}', 1, 4)`)).toMatchObject({ success: false, error: "Not authenticated" });
      expect(await call(`public.wager_confirm_result('${comp}', true)`)).toMatchObject({ success: false });
      await asAnon();
      await expect(call(`public.wager_submit_score('${comp}', 1, 4)`)).rejects.toThrow(/permission denied/i);
      await asUser(ALICE);
      for (const f of ["_wager_pay", "_wager_refund"]) {
        await expect(db.exec(`SELECT public.${f}('${comp}', NULL)`)).rejects.toThrow(/permission denied/i);
      }
      await expect(db.exec(`SELECT public._wager_standings('${comp}')`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe("closing the old settle path", () => {
    it("after the second step settle_competition only refunds a host nobody joined", async () => {
      const d = await fresh();
      await d.exec(legacySql);
      await d.exec(`INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}')`);
      const solo = (await d.query<{ id: string }>(`INSERT INTO public.competitions (creator_id, buy_in, pot_total, status) VALUES ('${ALICE}', 10, 10, 'pending') RETURNING id`)).rows[0].id;
      await d.exec(`INSERT INTO public.competition_players (competition_id, user_id, has_paid) VALUES ('${solo}', '${ALICE}', true)`);
      const duo = (await d.query<{ id: string }>(`INSERT INTO public.competitions (creator_id, buy_in, pot_total, status) VALUES ('${ALICE}', 10, 20, 'active') RETURNING id`)).rows[0].id;
      await d.exec(`INSERT INTO public.competition_players (competition_id, user_id, has_paid) VALUES ('${duo}', '${ALICE}', true), ('${duo}', '${BOB}', true)`);
      await d.exec(`RESET ROLE; SELECT set_config('test.uid', '${ALICE}', false); SET ROLE authenticated;`);
      await expect(d.exec(`SELECT public.settle_competition('${duo}', '${ALICE}')`)).rejects.toThrow(/confirmation flow/);
      await expect(d.exec(`SELECT public.settle_competition('${duo}', '${BOB}')`)).rejects.toThrow(/confirmation flow/);
      await expect(d.exec(`SELECT public.settle_competition('${solo}', '${BOB}')`)).rejects.toThrow(/confirmation flow/);
      const ok = await d.query<{ r: { success: boolean } }>(`SELECT public.settle_competition('${solo}', '${ALICE}') AS r`);
      expect(ok.rows[0].r.success).toBe(true);
      await d.close();
    });
    it("refuses to run before the wager migration", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + PAYMENTS_LIVE + COMPETITIONS_LIVE);
      await d.exec(settleGuardSql);
      await expect(d.exec(legacySql)).rejects.toThrow(/apply 20261011130000 and 20261012120000/);
      await d.close();
    });
  });

  describe("safety check", () => {
    it("refuses to apply without the wallet tables", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE);
      await expect(d.exec(wagerSql)).rejects.toThrow(/competitions needs/);
      await d.close();
    });
  });
});
