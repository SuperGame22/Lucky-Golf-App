import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, CLOVERS_LIVE, JACKPOTS_LIVE, LIVE, migrationSql } from "./fixtures";

const ADMIN = "55555555-5555-5555-5555-555555555555";

describe("AMOE free entries", () => {
  let db: PGlite;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const asUser = async (uid: string) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false); SET ROLE authenticated;`);
  const grant = async (email: string): Promise<J> => (await db.query<{ r: J }>(`SELECT public.admin_grant_amoe_entry('${email}') AS r`)).rows[0].r;
  const clovers = async (uid: string) => {
    await db.exec(`RESET ROLE;`);
    return (await db.query<{ c: number }>(`SELECT clovers AS c FROM public.golfer_profiles WHERE user_id = '${uid}'`)).rows[0].c;
  };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE + CLOVERS_LIVE + JACKPOTS_LIVE);
    await db.exec(`
      ALTER TABLE auth.users ADD COLUMN email TEXT;
      INSERT INTO auth.users (id, email) VALUES ('${ALICE}', 'alice@example.com'), ('${BOB}', 'bob@example.com'), ('${ADMIN}', 'boss@example.com');
      INSERT INTO public.golfer_profiles (user_id, role) VALUES ('${ALICE}', NULL), ('${BOB}', NULL), ('${ADMIN}', 'admin');
    `);
    await db.exec(migrationSql("20261027150000_amoe_entries.sql"));
  });
  afterAll(async () => { await db.close(); });

  it("an admin grants 1 clover per player per week", async () => {
    await asUser(ADMIN);
    expect(await grant("Alice@Example.com ")).toMatchObject({ success: true });
    expect(await clovers(ALICE)).toBe(1);
    await asUser(ADMIN);
    expect(await grant("alice@example.com")).toMatchObject({ success: false });
    expect(await clovers(ALICE)).toBe(1);
    await asUser(ADMIN);
    expect(await grant("nobody@example.com")).toMatchObject({ success: false });
  });

  it("players can't grant entries", async () => {
    await asUser(BOB);
    expect(await grant("bob@example.com")).toEqual({ success: false, error: "Unauthorized" });
    expect(await clovers(BOB)).toBe(0);
  });
});
