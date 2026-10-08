import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, LIVE, migrationSql } from "./fixtures";

const sql = migrationSql("20261013120000_invites_and_phone.sql");

describe("invites and phone numbers", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string | null) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  const asAnon = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE anon;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const call = async (s: string): Promise<Record<string, any>> => (await db.query<{ r: Record<string, any> }>(`SELECT ${s} AS r`)).rows[0].r;
  const contact = async (uid: string) => {
    await asAdmin();
    return (await db.query<{ phone: string | null; phone_consent_at: string | null; referred_by: string | null }>(
      `SELECT phone, phone_consent_at, referred_by FROM public.player_contacts WHERE user_id = '${uid}'`,
    )).rows[0];
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
      DELETE FROM public.wager_invites; DELETE FROM public.player_contacts; DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}');
    `);
  });

  describe("set_my_phone", () => {
    it.each(["(415) 555-0132", "415-555-0132", "4155550132", "1 415 555 0132", "+1 415.555.0132"])("saves %s as +14155550132", async (raw) => {
      await asUser(BOB);
      expect(await call(`public.set_my_phone('${raw}', true)`)).toEqual({ success: true, phone: "+14155550132" });
      const c = await contact(BOB);
      expect(c.phone).toBe("+14155550132");
      expect(c.phone_consent_at).not.toBeNull();
    });

    it.each(["", "555-0132", "0155550132", "1155550132", "41555501321", "not a number"])("refuses %j", async (raw) => {
      await asUser(BOB);
      expect(await call(`public.set_my_phone('${raw}', true)`)).toEqual({ success: false, error: "Enter a 10-digit US mobile number" });
      expect(await contact(BOB)).toBeUndefined();
    });

    it("never saves a number without a yes to being texted", async () => {
      await asUser(BOB);
      expect(await call("public.set_my_phone('4155550132', false)")).toMatchObject({ success: false });
      expect(await call("public.set_my_phone('4155550132', NULL)")).toMatchObject({ success: false });
      expect(await contact(BOB)).toBeUndefined();
    });

    it("changing the number records fresh consent; saving the same one does not", async () => {
      await asUser(BOB);
      await call("public.set_my_phone('4155550132', true)");
      const first = (await contact(BOB)).phone_consent_at;
      await asAdmin();
      await db.exec(`UPDATE public.player_contacts SET phone_consent_at = now() - interval '1 day' WHERE user_id = '${BOB}'`);
      const old = (await contact(BOB)).phone_consent_at;
      await asUser(BOB);
      await call("public.set_my_phone('415-555-0132', true)");
      expect((await contact(BOB)).phone_consent_at).toEqual(old);
      await asUser(BOB);
      await call("public.set_my_phone('212-555-0188', true)");
      const changed = await contact(BOB);
      expect(changed.phone).toBe("+12125550188");
      expect(new Date(changed.phone_consent_at!).getTime()).toBeGreaterThan(new Date(old!).getTime());
      expect(first).not.toBeNull();
    });

    it("cannot be called signed out or anonymously, and the table cannot be written directly", async () => {
      await asUser(null);
      expect(await call("public.set_my_phone('4155550132', true)")).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(call("public.set_my_phone('4155550132', true)")).rejects.toThrow(/permission denied/i);
      await asUser(BOB);
      await expect(db.exec(`INSERT INTO public.player_contacts (user_id, phone, phone_consent_at) VALUES ('${BOB}', '+14155550132', now())`)).rejects.toThrow(/permission denied/i);
    });

    it("the database itself refuses a number without consent or in the wrong shape", async () => {
      await asAdmin();
      await expect(db.exec(`INSERT INTO public.player_contacts (user_id, phone) VALUES ('${BOB}', '+14155550132')`)).rejects.toThrow(/phone_needs_consent/);
      await expect(db.exec(`INSERT INTO public.player_contacts (user_id, phone, phone_consent_at) VALUES ('${BOB}', '4155550132', now())`)).rejects.toThrow(/check constraint/i);
    });

    it("players can read only their own contact row", async () => {
      await asUser(BOB);
      await call("public.set_my_phone('4155550132', true)");
      await asUser(ALICE);
      expect((await db.query("SELECT * FROM public.player_contacts")).rows).toHaveLength(0);
      await asUser(BOB);
      expect((await db.query("SELECT * FROM public.player_contacts")).rows).toHaveLength(1);
    });
  });

  describe("accept_wager_invite", () => {
    it("records the invite and who invited the player", async () => {
      await asUser(BOB);
      expect(await call(`public.accept_wager_invite('abc123', '${ALICE}')`)).toEqual({ success: true });
      expect((await contact(BOB)).referred_by).toBe(ALICE);
      await asAdmin();
      expect((await db.query("SELECT code, inviter_id, invitee_id FROM public.wager_invites")).rows).toEqual([{ code: "ABC123", inviter_id: ALICE, invitee_id: BOB }]);
    });

    it("is safe to repeat, and the first inviter is the one remembered", async () => {
      await asUser(BOB);
      await call(`public.accept_wager_invite('ABC123', '${ALICE}')`);
      await call(`public.accept_wager_invite('ABC123', '${ALICE}')`);
      await asAdmin();
      await db.exec(`INSERT INTO auth.users (id) VALUES ('33333333-3333-3333-3333-333333333333')`);
      await asUser(BOB);
      await call(`public.accept_wager_invite('ZZZ999', '33333333-3333-3333-3333-333333333333')`);
      expect((await contact(BOB)).referred_by).toBe(ALICE);
      await asAdmin();
      expect((await db.query("SELECT 1 FROM public.wager_invites")).rows).toHaveLength(2);
    });

    it("keeps a saved phone number when an invite is recorded", async () => {
      await asUser(BOB);
      await call("public.set_my_phone('4155550132', true)");
      await call(`public.accept_wager_invite('ABC123', '${ALICE}')`);
      expect(await contact(BOB)).toMatchObject({ phone: "+14155550132", referred_by: ALICE });
    });

    it("refuses bad codes, yourself, unknown inviters and signed-out callers", async () => {
      await asUser(BOB);
      expect(await call(`public.accept_wager_invite('nope', '${ALICE}')`)).toMatchObject({ success: false, error: "Invalid invite code" });
      expect(await call(`public.accept_wager_invite('ABC123', '${BOB}')`)).toMatchObject({ success: false, error: "Invalid inviter" });
      expect(await call(`public.accept_wager_invite('ABC123', '99999999-9999-9999-9999-999999999999')`)).toMatchObject({ success: false, error: "Invalid inviter" });
      expect(await call(`public.accept_wager_invite('ABC123', NULL)`)).toMatchObject({ success: false });
      await asUser(null);
      expect(await call(`public.accept_wager_invite('ABC123', '${ALICE}')`)).toEqual({ success: false, error: "Not authenticated" });
      await asAnon();
      await expect(call(`public.accept_wager_invite('ABC123', '${ALICE}')`)).rejects.toThrow(/permission denied/i);
    });

    it("the inviter sees who joined through their link; others do not", async () => {
      await asUser(BOB);
      await call(`public.accept_wager_invite('ABC123', '${ALICE}')`);
      await asUser(ALICE);
      expect((await db.query("SELECT invitee_id FROM public.wager_invites")).rows).toEqual([{ invitee_id: BOB }]);
      await asAdmin();
      await db.exec(`INSERT INTO auth.users (id) VALUES ('33333333-3333-3333-3333-333333333333')`);
      await asUser("33333333-3333-3333-3333-333333333333");
      expect((await db.query("SELECT * FROM public.wager_invites")).rows).toHaveLength(0);
      await expect(db.exec(`UPDATE public.wager_invites SET inviter_id = '33333333-3333-3333-3333-333333333333'`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe("get_my_contact", () => {
    it("says whether a number is saved without revealing it", async () => {
      await asUser(BOB);
      expect(await call("public.get_my_contact()")).toEqual({ success: true, has_phone: false, invited: false });
      await call("public.set_my_phone('4155550132', true)");
      await call(`public.accept_wager_invite('ABC123', '${ALICE}')`);
      const r = await call("public.get_my_contact()");
      expect(r).toEqual({ success: true, has_phone: true, invited: true });
      expect(JSON.stringify(r)).not.toContain("415");
    });
  });

  describe("safety check", () => {
    it("refuses to apply without golfer_profiles", async () => {
      const d = new PGlite();
      await d.exec(BASE);
      await expect(d.exec(sql)).rejects.toThrow(/golfer_profiles not found/);
      await d.close();
    });
  });
});
