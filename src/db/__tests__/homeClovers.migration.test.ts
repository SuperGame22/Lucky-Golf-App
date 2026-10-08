import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, LIVE, migrationSql } from "./fixtures";

const sql = migrationSql("20261009120000_home_clover_state.sql");

describe("home clover state migration", () => {
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
  const get = async (): Promise<Record<string, any>> => (await db.query<{ r: Record<string, any> }>("SELECT public.get_home_clovers() AS r")).rows[0].r;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ack = async (n: number): Promise<Record<string, any>> => (await db.query<{ r: Record<string, any> }>(`SELECT public.ack_home_clovers(${n}) AS r`)).rows[0].r;
  /** Money is spent: the server credits clovers straight away (as the real credit functions do). */
  const earn = async (uid: string, n: number) => {
    await asAdmin();
    await db.exec(`UPDATE public.golfer_profiles SET clovers = clovers + ${n}, total_clovers = total_clovers + ${n} WHERE user_id = '${uid}'`);
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE);
    await db.exec(sql);
  });
  afterAll(async () => {
    await db.close();
  });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      DELETE FROM public.home_clover_state;
      DELETE FROM public.golfer_profiles;
      DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}');
      INSERT INTO public.golfer_profiles (user_id, clovers, total_clovers) VALUES ('${ALICE}', 12, 20), ('${BOB}', 0, 0);
    `);
  });

  it("starts an existing player with nothing to replay", async () => {
    await asUser(ALICE);
    expect(await get()).toEqual({ success: true, clovers: 12, total: 20, seen_total: 20, pending: 0, week_count: 0 });
  });

  it("holds new clovers back until the Home page acknowledges them", async () => {
    await asUser(ALICE);
    await get();
    await earn(ALICE, 10); // $40 spent
    await asUser(ALICE);
    // However many times the page is opened, the pending clovers are still there to be animated.
    expect(await get()).toEqual({ success: true, clovers: 22, total: 30, seen_total: 20, pending: 10, week_count: 0 });
    expect((await get()).pending).toBe(10);
  });

  it("an acknowledged reveal adds those clovers to the weekly count, once", async () => {
    await asUser(ALICE);
    await get();
    await earn(ALICE, 4);
    await asUser(ALICE);
    expect(await ack(24)).toEqual({ success: true, clovers: 16, total: 24, seen_total: 24, pending: 0, week_count: 4 });
    // a second tab or a retry changes nothing
    expect((await ack(24)).week_count).toBe(4);
    expect((await get()).pending).toBe(0);
  });

  it("can be acknowledged in steps and keeps adding up", async () => {
    await asUser(ALICE);
    await get();
    await earn(ALICE, 6);
    await asUser(ALICE);
    expect(await ack(23)).toMatchObject({ pending: 3, week_count: 3 });
    expect(await ack(26)).toMatchObject({ pending: 0, week_count: 6 });
  });

  it("never lets a player acknowledge more than they have, or go backwards", async () => {
    await asUser(ALICE);
    await get();
    await earn(ALICE, 2);
    await asUser(ALICE);
    expect(await ack(1000)).toMatchObject({ seen_total: 22, pending: 0, week_count: 2 });
    expect(await ack(0)).toMatchObject({ seen_total: 22, week_count: 2 });
    expect(await ack(-5)).toEqual({ success: false, error: "Invalid amount" });
  });

  it("is not thrown off by spending clovers, which lowers the balance but not the total", async () => {
    await asUser(ALICE);
    await get();
    await asAdmin();
    await db.exec(`UPDATE public.golfer_profiles SET clovers = 0 WHERE user_id = '${ALICE}'`);
    await asUser(ALICE);
    expect(await get()).toMatchObject({ clovers: 0, pending: 0 });
  });

  it("starts the weekly count over each week", async () => {
    await asUser(ALICE);
    await get();
    await earn(ALICE, 3);
    await asUser(ALICE);
    await ack(23);
    await asAdmin();
    await db.exec(`UPDATE public.home_clover_state SET week_start = week_start - 7 WHERE user_id = '${ALICE}'`);
    await asUser(ALICE);
    expect(await get()).toMatchObject({ week_count: 0, pending: 0 });
  });

  it("keeps players separate", async () => {
    await asUser(ALICE);
    await get();
    await earn(ALICE, 5);
    await asUser(BOB);
    expect(await get()).toMatchObject({ total: 0, pending: 0, week_count: 0 });
    await asUser(ALICE);
    expect((await get()).pending).toBe(5);
  });

  it("is closed to signed-out and anonymous callers, and the table is read-only for players", async () => {
    await asUser(null);
    expect(await get()).toEqual({ success: false, error: "Not authenticated" });
    expect(await ack(1)).toEqual({ success: false, error: "Not authenticated" });
    await asAnon();
    await expect(get()).rejects.toThrow(/permission denied/i);
    await asUser(ALICE);
    await get();
    await expect(db.exec(`UPDATE public.home_clover_state SET seen_total = 0 WHERE user_id = '${ALICE}'`)).rejects.toThrow(/permission denied/i);
    await expect(db.exec(`INSERT INTO public.home_clover_state (user_id) VALUES ('${BOB}')`)).rejects.toThrow(/permission denied/i);
    await expect(db.exec(`SELECT public._home_clover_state('${ALICE}'::uuid)`)).rejects.toThrow(/permission denied/i);
    expect((await db.query("SELECT * FROM public.home_clover_state")).rows).toHaveLength(1);
  });

  it("refuses to apply to a database without the profile columns", async () => {
    const d = new PGlite();
    await d.exec(BASE + "CREATE TABLE public.golfer_profiles (user_id UUID PRIMARY KEY);");
    await expect(d.exec(sql)).rejects.toThrow(/clovers and total_clovers/);
    await d.close();
  });
});
