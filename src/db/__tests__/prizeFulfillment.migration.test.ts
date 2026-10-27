import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, CLOVERS_LIVE, JACKPOTS_LIVE, LIVE, ROUNDS_LIVE, migrationSql } from "./fixtures";

const ADMIN = "55555555-5555-5555-5555-555555555555";

describe("spin prize fulfillment", () => {
  let db: PGlite;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const asUser = async (uid: string) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false); SET ROLE authenticated;`);
  const call = async (sql: string): Promise<J> => (await db.query<{ r: J }>(`SELECT ${sql} AS r`)).rows[0].r;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE + CLOVERS_LIVE + ROUNDS_LIVE + JACKPOTS_LIVE);
    await db.exec(migrationSql("20261007120000_putt_spins.sql"));
    await db.exec(migrationSql("20261010120000_server_side_clovers.sql"));
    await db.exec(`
      ALTER TABLE auth.users ADD COLUMN email TEXT;
      ALTER TABLE public.golfer_profiles ADD COLUMN membership_tier TEXT DEFAULT 'free';
      INSERT INTO auth.users (id, email) VALUES ('${ALICE}', 'a@x.com'), ('${BOB}', 'b@x.com'), ('${ADMIN}', 'boss@x.com');
      INSERT INTO public.golfer_profiles (user_id, role, display_name) VALUES ('${ALICE}', NULL, 'Alice'), ('${BOB}', NULL, 'Bob'), ('${ADMIN}', 'admin', 'Boss');
      INSERT INTO public.spin_log (user_id, slice_idx, kind, label) VALUES
        ('${ALICE}', 1, 'prize', 'Lucky Wedge'), ('${BOB}', 27, 'membership', '1mo Clover Club'), ('${BOB}', 2, 'clovers', '+5');
    `);
    await db.exec(migrationSql("20261027160000_prize_fulfillment.sql"));
  });
  afterAll(async () => { await db.close(); });

  it("lists open prizes with contact details, marks one done", async () => {
    await asUser(ADMIN);
    const open = await call(`public.admin_spin_prizes('open')`);
    expect(open.prizes.map((p: J) => [p.label, p.email])).toEqual([["Lucky Wedge", "a@x.com"], ["1mo Clover Club", "b@x.com"]]);
    const wedge = open.prizes[0].id;
    expect(await call(`public.admin_fulfill_spin_prize(${wedge}, 'shipped UPS 1Z')`)).toEqual({ success: true });
    expect(await call(`public.admin_fulfill_spin_prize(${wedge}, 'again')`)).toMatchObject({ success: false });
    expect((await call(`public.admin_spin_prizes('open')`)).prizes).toHaveLength(1);
    expect((await call(`public.admin_spin_prizes('done')`)).prizes[0]).toMatchObject({ label: "Lucky Wedge", fulfillment_note: "shipped UPS 1Z" });
  });

  it("admins set a tier; players can't use any of it", async () => {
    await asUser(ADMIN);
    expect(await call(`public.admin_set_membership_tier('${BOB}', 'clover')`)).toEqual({ success: true, tier: "clover" });
    expect(await call(`public.admin_set_membership_tier('${BOB}', 'platinum')`)).toMatchObject({ success: false });
    await asUser(BOB);
    expect(await call(`public.admin_set_membership_tier('${BOB}', 'gold')`)).toEqual({ success: false, error: "Unauthorized" });
    expect(await call(`public.admin_spin_prizes('open')`)).toEqual({ success: false, error: "Unauthorized" });
  });
});
