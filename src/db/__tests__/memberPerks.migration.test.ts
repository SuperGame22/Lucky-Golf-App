import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, LIVE, migrationSql } from "./fixtures";

const CAROL = "33333333-3333-3333-3333-333333333333";

describe("member perks", () => {
  let db: PGlite;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false); SET ROLE authenticated;`);
  const claim = async (): Promise<J> => (await db.query<{ r: J }>(`SELECT public.claim_member_putts() AS r`)).rows[0].r;
  const take = async (limit = 3): Promise<boolean> => (await db.query<{ r: boolean }>(`SELECT public.coach_chat_take(${limit}) AS r`)).rows[0].r;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE);
    await db.exec(`ALTER TABLE public.golfer_profiles ADD COLUMN membership_tier TEXT DEFAULT 'free';`);
    await db.exec(migrationSql("20261027140000_member_perks.sql"));
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      DELETE FROM public.member_putt_grants; DELETE FROM public.coach_chat_usage; DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}'), ('${CAROL}');
      INSERT INTO public.golfer_profiles (user_id, membership_tier, putt_credits) VALUES ('${ALICE}', 'clover', 1), ('${BOB}', 'gold', 0), ('${CAROL}', 'free', 0);
    `);
  });

  it("Clover Club gets 3 putts once a month, Gold 7, free nothing", async () => {
    await asUser(ALICE);
    expect(await claim()).toMatchObject({ success: true, granted: 3, credits: 4 });
    expect(await claim()).toMatchObject({ success: true, granted: 0, reason: "already_claimed" });
    await asUser(BOB);
    expect(await claim()).toMatchObject({ granted: 7, credits: 7 });
    await asUser(CAROL);
    expect(await claim()).toMatchObject({ granted: 0, reason: "not_member" });
  });

  it("a new month gives a new allowance", async () => {
    await asUser(ALICE);
    await claim();
    await asAdmin();
    await db.exec(`UPDATE public.member_putt_grants SET month = month - interval '1 month'`);
    await asUser(ALICE);
    expect(await claim()).toMatchObject({ granted: 3, credits: 7 });
  });

  it("players can't grant themselves rows", async () => {
    await asUser(ALICE);
    await expect(db.exec(`INSERT INTO public.member_putt_grants (user_id, month, tier, putts) VALUES ('${ALICE}', '2020-01-01', 'gold', 99)`)).rejects.toThrow(/permission denied/);
  });

  it("Coach Ace allowance runs out for the day", async () => {
    await asUser(ALICE);
    expect([await take(), await take(), await take(), await take()]).toEqual([true, true, true, false]);
    await asUser(BOB);
    expect(await take()).toBe(true);
    await db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE authenticated;`);
    expect(await take()).toBe(false);
  });
});
