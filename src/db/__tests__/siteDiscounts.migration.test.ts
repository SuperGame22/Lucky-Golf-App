import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, CLOVERS_LIVE, LIVE, PAYMENTS_LIVE, ROUNDS_LIVE, migrationSql } from "./fixtures";

const files = [
  "20261007120000_putt_spins.sql",
  "20261009120000_home_clover_state.sql",
  "20261010120000_server_side_clovers.sql",
  "20261011120000_spend_carry.sql",
  "20261014120000_site_purchases_and_discounts.sql",
];
const newSql = migrationSql(files[4]);
const CAROL = "33333333-3333-3333-3333-333333333333";

const fresh = async (upTo = files.length) => {
  const d = new PGlite();
  await d.exec(BASE + LIVE + CLOVERS_LIVE + ROUNDS_LIVE + PAYMENTS_LIVE);
  await d.exec("ALTER TABLE auth.users ADD COLUMN email TEXT, ADD COLUMN email_confirmed_at TIMESTAMPTZ;");
  for (const f of files.slice(0, upTo)) await d.exec(migrationSql(f));
  return d;
};

describe("site purchases and discounts", () => {
  let db: PGlite;
  const asRole = async (role: "postgres" | "service_role" | "authenticated" | "anon", uid = "") => {
    await db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false);`);
    if (role !== "postgres") await db.exec(`SET ROLE ${role};`);
  };
  const asAdmin = () => asRole("postgres");
  const asService = () => asRole("service_role");
  const asUser = (uid: string) => asRole("authenticated", uid);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const call = async (sql: string): Promise<J> => (await db.query<{ r: J }>(`SELECT ${sql} AS r`)).rows[0].r;
  const record = async (email: string, ref: string, dollars: number) => {
    await asService();
    return call(`public.record_site_purchase('${email}', '${ref}', ${dollars})`);
  };
  const clovers = async (uid: string) => {
    await asAdmin();
    return (await db.query<{ clovers: number }>(`SELECT clovers FROM public.golfer_profiles WHERE user_id = '${uid}'`)).rows[0].clovers;
  };
  const cents = async (uid: string) => {
    await asAdmin();
    return Number((await db.query<{ c: string }>(`SELECT coalesce(max(cents_total), 0) AS c FROM public.spend_progress WHERE user_id = '${uid}'`)).rows[0].c);
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
      DELETE FROM public.player_discounts; DELETE FROM public.site_purchases; DELETE FROM public.spin_log;
      DELETE FROM public.spend_progress; DELETE FROM public.transactions; DELETE FROM public.wallets;
      DELETE FROM public.home_clover_state; DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
        ('${ALICE}', 'alice@example.com', now()), ('${BOB}', 'Bob@Example.com', NULL), ('${CAROL}', 'carol@example.com', now());
      INSERT INTO public.golfer_profiles (user_id, spins) VALUES ('${ALICE}', 50), ('${BOB}', 5), ('${CAROL}', 5);
    `);
  });

  describe("site purchases", () => {
    it("a paid order for a verified email adds clovers the same way as any spend", async () => {
      expect(await record("alice@example.com", "shopify:1001", 10)).toMatchObject({ success: true, applied: true, clovers: 2 });
      expect(await clovers(ALICE)).toBe(2);
      expect(await cents(ALICE)).toBe(1000);
      await asAdmin();
      expect((await db.query<{ user_id: string; applied_at: string | null; clovers_awarded: number }>("SELECT user_id, applied_at, clovers_awarded FROM public.site_purchases")).rows[0])
        .toMatchObject({ user_id: ALICE, clovers_awarded: 2 });
    });

    it("leftover dollars carry across orders and across the app and the site", async () => {
      await record("alice@example.com", "shopify:1", 3); // 3 -> 0 clovers
      expect(await clovers(ALICE)).toBe(0);
      await record("alice@example.com", "shopify:2", 3); // 6 -> 1 clover
      expect(await clovers(ALICE)).toBe(1);
      // $2 of putts in the app completes the next one
      await asAdmin();
      await db.query(`SELECT public.credit_putts('${ALICE}', 2, 0, 2, 'stripe-x')`);
      expect(await clovers(ALICE)).toBe(2);
      expect(await cents(ALICE)).toBe(800);
    });

    it("ignores email case and spaces, and counts each order once", async () => {
      await record("  ALICE@Example.COM ", "shopify:7", 8);
      expect(await clovers(ALICE)).toBe(2);
      expect(await record("alice@example.com", "shopify:7", 8)).toEqual({ success: true, duplicate: true });
      expect(await clovers(ALICE)).toBe(2);
      expect(await cents(ALICE)).toBe(800);
    });

    it("an email that is not verified yet only holds the purchase", async () => {
      expect(await record("bob@example.com", "shopify:9", 12)).toEqual({ success: true, pending: true });
      expect(await clovers(BOB)).toBe(0);
    });

    it("pays pending purchases when the player has a verified email and signs in", async () => {
      await record("bob@example.com", "shopify:9", 12);
      await record("bob@example.com", "shopify:10", 4);
      await asUser(BOB);
      expect(await call("public.claim_my_purchases()")).toMatchObject({ success: true, claimed: 0, unverified: true });
      await asAdmin();
      await db.exec(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = '${BOB}'`);
      await asUser(BOB);
      expect(await call("public.claim_my_purchases()")).toEqual({ success: true, claimed: 2, clovers: 4 });
      expect(await clovers(BOB)).toBe(4);
      await asUser(BOB);
      expect(await call("public.claim_my_purchases()")).toEqual({ success: true, claimed: 0, clovers: 0 });
      expect(await clovers(BOB)).toBe(4);
    });

    it("a purchase made before the player signed up waits for them", async () => {
      await record("newperson@example.com", "shopify:55", 20);
      await asAdmin();
      const NEW = "44444444-4444-4444-4444-444444444444";
      await db.exec(`INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ('${NEW}', 'NewPerson@example.com', now()); INSERT INTO public.golfer_profiles (user_id) VALUES ('${NEW}');`);
      await asUser(NEW);
      expect(await call("public.claim_my_purchases()")).toMatchObject({ claimed: 1, clovers: 5 });
    });

    it("nobody can claim someone else's pending purchase", async () => {
      await record("nobody@example.com", "shopify:77", 40);
      await asUser(ALICE);
      expect(await call("public.claim_my_purchases()")).toMatchObject({ claimed: 0 });
      await asUser(CAROL);
      expect(await call("public.claim_my_purchases()")).toMatchObject({ claimed: 0 });
      expect(await clovers(ALICE) + (await clovers(CAROL))).toBe(0);
    });

    it("refuses bad input", async () => {
      expect(await record("not-an-email", "x", 5)).toMatchObject({ success: false, error: "Invalid email" });
      expect(await record("alice@example.com", " ", 5)).toMatchObject({ success: false, error: "Missing order reference" });
      expect(await record("alice@example.com", "r1", 0)).toMatchObject({ success: false, error: "Invalid amount" });
      expect(await record("alice@example.com", "r2", -4)).toMatchObject({ success: false, error: "Invalid amount" });
      expect(await clovers(ALICE)).toBe(0);
    });

    it("only the service key can record an order; players see only their own", async () => {
      await asUser(ALICE);
      await expect(db.exec(`SELECT public.record_site_purchase('alice@example.com', 'z', 400)`)).rejects.toThrow(/permission denied/i);
      await asRole("anon");
      await expect(db.exec(`SELECT public.record_site_purchase('alice@example.com', 'z', 400)`)).rejects.toThrow(/permission denied/i);
      await asRole("anon");
      await expect(db.exec(`SELECT public.claim_my_purchases()`)).rejects.toThrow(/permission denied/i);
      await record("alice@example.com", "shopify:a", 8);
      await record("carol@example.com", "shopify:c", 8);
      await asUser(ALICE);
      expect((await db.query("SELECT ref FROM public.site_purchases")).rows).toEqual([{ ref: "shopify:a" }]);
      await expect(db.exec(`UPDATE public.site_purchases SET dollars = 1`)).rejects.toThrow(/permission denied/i);
    });

    it("putt purchases still earn clovers through the shared spend function", async () => {
      await asAdmin();
      for (let i = 0; i < 4; i++) await db.query(`SELECT public.credit_putts('${ALICE}', 1, 0, 1, 'p${i}')`);
      expect(await clovers(ALICE)).toBe(1);
    });
  });

  describe("discounts", () => {
    const onlySlice = async (kind: string, label: string, clovers = 0) => {
      await asAdmin();
      await db.exec(`DELETE FROM public.spin_wheel_slices; INSERT INTO public.spin_wheel_slices VALUES (0, '${kind}', '${label}', ${clovers}, 1)`);
    };
    const spin = async (uid: string) => {
      await asUser(uid);
      return call("public.consume_spin(true)");
    };
    const statuses = async (uid: string) => {
      await asAdmin();
      return (await db.query<{ percent: number; status: string }>(`SELECT percent, status FROM public.player_discounts WHERE user_id = '${uid}' ORDER BY id`)).rows;
    };

    it("winning a discount puts it on the account for a month", async () => {
      await onlySlice("discount", "15% Off");
      const r = await spin(ALICE);
      expect(r).toMatchObject({ success: true, kind: "discount", discount_percent: 15 });
      await asUser(ALICE);
      const d = await call("public.get_my_discount()");
      expect(d).toMatchObject({ success: true, active: true, percent: 15, needs_code: true, code: null });
      const days = (new Date(d.expires_at).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(27);
      expect(days).toBeLessThan(32);
    });

    it("a new discount replaces the old one, even a smaller one (secret Santa)", async () => {
      await onlySlice("discount", "15% Off");
      await spin(ALICE);
      await onlySlice("discount", "10% Off");
      await spin(ALICE);
      expect(await statuses(ALICE)).toEqual([{ percent: 15, status: "replaced" }, { percent: 10, status: "active" }]);
      await asUser(ALICE);
      expect(await call("public.get_my_discount()")).toMatchObject({ active: true, percent: 10 });
    });

    it("an expired discount stops showing and can be replaced", async () => {
      await onlySlice("discount", "25% Off");
      await spin(ALICE);
      await asAdmin();
      await db.exec(`UPDATE public.player_discounts SET expires_at = now() - interval '1 minute'`);
      await asUser(ALICE);
      expect(await call("public.get_my_discount()")).toEqual({ success: true, active: false });
      expect(await statuses(ALICE)).toEqual([{ percent: 25, status: "expired" }]);
      await onlySlice("discount", "20% Off");
      await spin(ALICE);
      expect((await statuses(ALICE)).map((s) => s.status)).toEqual(["expired", "active"]);
    });

    it("other prizes do not touch the discount, and players are separate", async () => {
      await onlySlice("discount", "30% Off");
      await spin(ALICE);
      await onlySlice("clovers", "+2 Clovers", 2);
      await spin(ALICE);
      expect((await statuses(ALICE)).map((s) => s.status)).toEqual(["active"]);
      await asUser(CAROL);
      expect(await call("public.get_my_discount()")).toEqual({ success: true, active: false });
      await asUser(CAROL);
      expect((await db.query("SELECT * FROM public.player_discounts")).rows).toHaveLength(0);
    });

    it("the database allows only one active discount per player", async () => {
      await onlySlice("discount", "10% Off");
      await spin(ALICE);
      await asAdmin();
      await expect(db.exec(`INSERT INTO public.player_discounts (user_id, percent, expires_at) VALUES ('${ALICE}', 5, now() + interval '1 day')`)).rejects.toThrow(/player_discounts_one_active|unique/i);
    });

    it("the Shopify code is recorded once, by the service key only, and a used code stops being active", async () => {
      await onlySlice("discount", "15% Off");
      await spin(ALICE);
      await asUser(ALICE);
      const id = (await call("public.get_my_discount()")).id;
      await expect(db.exec(`SELECT public.set_discount_code(${id}, 'LG-FAKE', '1')`)).rejects.toThrow(/permission denied/i);
      await asService();
      expect(await call(`public.set_discount_code(${id}, 'LG-ABC123', 'rule1')`)).toEqual({ success: true });
      expect(await call(`public.set_discount_code(${id}, 'LG-OTHER', 'rule2')`)).toMatchObject({ success: false });
      await asUser(ALICE);
      expect(await call("public.get_my_discount()")).toMatchObject({ code: "LG-ABC123", needs_code: false });
      await asService();
      expect(await call("public.mark_discount_used('LG-ABC123')")).toEqual({ success: true });
      expect(await call("public.mark_discount_used('LG-ABC123')")).toEqual({ success: false });
      await asUser(ALICE);
      expect(await call("public.get_my_discount()")).toEqual({ success: true, active: false });
      await onlySlice("discount", "10% Off");
      await spin(ALICE);
      expect((await statuses(ALICE)).map((s) => s.status)).toEqual(["used", "active"]);
    });

    it("clover and free-putt prizes still work after this change", async () => {
      await onlySlice("clovers", "+4 Clovers", 4);
      expect(await spin(ALICE)).toMatchObject({ kind: "clovers", clovers: 4 });
      expect(await clovers(ALICE)).toBe(4);
      await onlySlice("free_putt", "Free Putt");
      expect(await spin(ALICE)).toMatchObject({ kind: "free_putt" });
    });

    it("needs a signed-in player", async () => {
      await asRole("anon");
      await expect(db.exec("SELECT public.get_my_discount()")).rejects.toThrow(/permission denied/i);
      await asRole("authenticated", "");
      expect(await call("public.get_my_discount()")).toEqual({ success: false, error: "Not authenticated" });
    });
  });

  describe("safety check", () => {
    it("refuses to apply before the earlier migrations", async () => {
      const d = await fresh(2);
      await expect(d.exec(newSql)).rejects.toThrow(/apply 20261010120000 and 20261011120000/);
      await d.close();
    });
  });
});
