import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Runs the real Monocle migration against an in-process Postgres (pglite) with
 * minimal stand-ins for the Supabase pieces it depends on (auth.users, auth.uid(),
 * golfer_profiles and the app's add_clovers function). This exercises the clover rules
 * exactly as written in SQL, without touching any live database.
 */

const MIGRATION = resolve(__dirname, "../../../../supabase/migrations/20261006180000_monocle.sql");

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

const PRELUDE = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  -- Supabase grants new public tables to the API roles by default; the migration's REVOKEs
  -- (and RLS) are what restrict them, so mirror that default here.
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;

  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

  CREATE TABLE public.golfer_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    clovers INTEGER NOT NULL DEFAULT 0,
    total_clovers INTEGER NOT NULL DEFAULT 0
  );
  ALTER TABLE public.golfer_profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY profiles_select ON public.golfer_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
  GRANT SELECT ON public.golfer_profiles TO authenticated;

  -- Stand-in for the app's own add_clovers RPC: acts for the signed-in user only.
  CREATE FUNCTION public.add_clovers(p_user_id UUID, p_amount INTEGER) RETURNS JSONB
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE v_new INTEGER;
  BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'not allowed'; END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'bad amount'; END IF;
    UPDATE public.golfer_profiles SET clovers = clovers + p_amount, total_clovers = total_clovers + p_amount
    WHERE user_id = p_user_id RETURNING clovers INTO v_new;
    RETURN jsonb_build_object('success', true, 'new_balance', v_new);
  END; $$;
  REVOKE ALL ON FUNCTION public.add_clovers(UUID, INTEGER) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.add_clovers(UUID, INTEGER) TO authenticated;
`;

let db: PGlite;

async function asUser(uid: string | null) {
  await db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false);`);
  await db.exec(uid ? "SET ROLE authenticated;" : "SET ROLE anon;");
}
async function asAdmin() {
  await db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpc<T = Record<string, any>>(sql: string): Promise<T> {
  const r = await db.query<{ r: T }>(`SELECT ${sql} AS r`);
  return r.rows[0].r;
}
const request = () => rpc("public.monocle_request_clover()");
const collect = (id: string) => rpc(`public.monocle_collect_clover('${id}')`);

async function setCampaign(patch: string) {
  await asAdmin();
  await db.exec(`UPDATE public.clover_campaigns SET ${patch} WHERE slug = 'default'`);
}
/** Make a spawned clover old enough to tap, as a human would. */
async function age(id: string, seconds = 5) {
  await asAdmin();
  await db.exec(
    `UPDATE public.monocle_clovers SET spawned_at = now() - interval '${seconds} seconds',
       expires_at = expires_at - interval '${seconds} seconds' WHERE id = '${id}'`,
  );
}
async function balance(uid: string) {
  await asAdmin();
  const r = await db.query<{ clovers: number }>(`SELECT clovers FROM public.golfer_profiles WHERE user_id = '${uid}'`);
  return r.rows[0].clovers;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(PRELUDE);
  await db.exec(readFileSync(MIGRATION, "utf8"));
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await asAdmin();
  await db.exec(`
    TRUNCATE public.monocle_clovers, public.monocle_sessions, public.monocle_settings CASCADE;
    DELETE FROM public.clover_campaigns WHERE slug <> 'default';
    DELETE FROM public.golfer_profiles;
    DELETE FROM auth.users;
    INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}');
    INSERT INTO public.golfer_profiles (user_id) VALUES ('${ALICE}'), ('${BOB}');
    UPDATE public.clover_campaigns SET is_active = true, starts_at = NULL, ends_at = NULL, priority = 0,
      spawn_chance = 1, min_interval_seconds = 0, lifetime_seconds = 25, daily_cap = 10, reward = 1,
      multiplier = 1, rare_chance = 0, rare_reward_multiplier = 5 WHERE slug = 'default';
  `);
});

describe("monocle_request_clover", () => {
  it("rejects signed-out callers", async () => {
    await asUser(null);
    await expect(request()).rejects.toThrow();
  });

  it("is not executable by the anon role at all", async () => {
    await asUser(null);
    await expect(db.query("SELECT public.monocle_request_clover()")).rejects.toThrow(/permission denied/i);
  });

  it("spawns a clover with an expiry from the campaign", async () => {
    await asUser(ALICE);
    const r = await request();
    expect(r.spawned).toBe(true);
    expect(r.clover.kind).toBe("standard");
    expect(r.clover.reward).toBe(1);
    const ttl = (new Date(r.clover.expires_at).getTime() - Date.now()) / 1000;
    expect(ttl).toBeGreaterThan(20);
    expect(ttl).toBeLessThanOrEqual(25.5);
  });

  it("hands back the live clover instead of spawning a second one", async () => {
    await asUser(ALICE);
    const a = await request();
    const b = await request();
    expect(b.clover.id).toBe(a.clover.id);
    await asAdmin();
    const n = await db.query<{ c: number }>("SELECT count(*)::int AS c FROM public.monocle_clovers");
    expect(n.rows[0].c).toBe(1);
  });

  it("respects the spawn chance", async () => {
    await setCampaign("spawn_chance = 0");
    await asUser(ALICE);
    const r = await request();
    expect(r.spawned).toBe(false);
    expect(r.reason).toBe("no_roll");
    expect(r.retry_in_seconds).toBeGreaterThanOrEqual(10);
  });

  it("enforces the minimum gap between clovers", async () => {
    await setCampaign("min_interval_seconds = 120");
    await asUser(ALICE);
    const a = await request();
    await age(a.clover.id);
    await asUser(ALICE);
    expect((await collect(a.clover.id)).success).toBe(true);
    const next = await request();
    expect(next.spawned).toBe(false);
    expect(next.reason).toBe("too_soon");
    expect(next.retry_in_seconds).toBeGreaterThan(100);
    expect(next.retry_in_seconds).toBeLessThanOrEqual(121);
  });

  it("stops at the daily cap", async () => {
    await setCampaign("daily_cap = 1");
    await asUser(ALICE);
    const a = await request();
    await age(a.clover.id);
    await asUser(ALICE);
    await collect(a.clover.id);
    const next = await request();
    expect(next.spawned).toBe(false);
    expect(next.reason).toBe("daily_cap");
  });

  it("does nothing outside a campaign window or when none is active", async () => {
    await setCampaign("ends_at = now() - interval '1 hour'");
    await asUser(ALICE);
    expect((await request()).reason).toBe("no_campaign");
    await setCampaign("ends_at = NULL, starts_at = now() + interval '1 hour'");
    await asUser(ALICE);
    expect((await request()).reason).toBe("no_campaign");
    await setCampaign("starts_at = NULL, is_active = false");
    await asUser(ALICE);
    expect((await request()).reason).toBe("no_campaign");
  });

  it("applies the bonus multiplier and rare-clover multiplier to the reward", async () => {
    await setCampaign("reward = 2, multiplier = 1.5, rare_chance = 1, rare_reward_multiplier = 5");
    await asUser(ALICE);
    const r = await request();
    expect(r.clover.kind).toBe("rare");
    expect(r.clover.reward).toBe(15); // floor(2 * 1.5 * 5)
  });

  it("picks the highest-priority running campaign", async () => {
    await asAdmin();
    await db.exec(
      `INSERT INTO public.clover_campaigns (slug, name, priority, spawn_chance, min_interval_seconds, reward, rare_chance)
       VALUES ('weekend', 'Double clover weekend', 10, 1, 0, 7, 0)`,
    );
    await asUser(ALICE);
    expect((await request()).clover.reward).toBe(7);
  });
});

describe("monocle_collect_clover", () => {
  it("credits the player's clovers once, through add_clovers", async () => {
    await asUser(ALICE);
    const { clover } = await request();
    await age(clover.id);
    await asUser(ALICE);
    const r = await collect(clover.id);
    expect(r).toMatchObject({ success: true, clovers_awarded: 1, new_balance: 1 });
    expect(await balance(ALICE)).toBe(1);
    await asAdmin();
    const t = await db.query<{ total_clovers: number }>(`SELECT total_clovers FROM public.golfer_profiles WHERE user_id = '${ALICE}'`);
    expect(t.rows[0].total_clovers).toBe(1);
    const row = await db.query<{ status: string }>(`SELECT status FROM public.monocle_clovers WHERE id = '${clover.id}'`);
    expect(row.rows[0].status).toBe("collected");
  });

  it("does not mark a clover collected when the player has no profile", async () => {
    await asUser(ALICE);
    const { clover } = await request();
    await age(clover.id);
    await asAdmin();
    await db.exec(`DELETE FROM public.golfer_profiles WHERE user_id = '${ALICE}'`);
    await asUser(ALICE);
    expect(await collect(clover.id)).toEqual({ success: false, error: "no_profile" });
    await asAdmin();
    const row = await db.query<{ status: string }>(`SELECT status FROM public.monocle_clovers WHERE id = '${clover.id}'`);
    expect(row.rows[0].status).toBe("spawned");
  });

  it("rolls the whole collect back if add_clovers refuses", async () => {
    await asUser(ALICE);
    const { clover } = await request();
    await age(clover.id);
    await asAdmin();
    await db.exec(`CREATE OR REPLACE FUNCTION public.add_clovers(p_user_id UUID, p_amount INTEGER) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RAISE EXCEPTION 'cap reached'; END; $$`);
    await asUser(ALICE);
    await expect(collect(clover.id)).rejects.toThrow(/cap reached/);
    await asAdmin();
    const row = await db.query<{ status: string }>(`SELECT status FROM public.monocle_clovers WHERE id = '${clover.id}'`);
    expect(row.rows[0].status).toBe("spawned");
    expect(await balance(ALICE)).toBe(0);
    // restore the stand-in for later tests
    await db.exec(`CREATE OR REPLACE FUNCTION public.add_clovers(p_user_id UUID, p_amount INTEGER) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
      DECLARE v_new INTEGER; BEGIN
      IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN RAISE EXCEPTION 'not allowed'; END IF;
      UPDATE public.golfer_profiles SET clovers = clovers + p_amount, total_clovers = total_clovers + p_amount WHERE user_id = p_user_id RETURNING clovers INTO v_new;
      RETURN jsonb_build_object('success', true, 'new_balance', v_new); END; $$`);
  });

  it("cannot be collected twice", async () => {
    await asUser(ALICE);
    const { clover } = await request();
    await age(clover.id);
    await asUser(ALICE);
    expect((await collect(clover.id)).success).toBe(true);
    const again = await collect(clover.id);
    expect(again).toEqual({ success: false, error: "already_collected" });
    expect(await balance(ALICE)).toBe(1);
  });

  it("cannot be collected by someone else", async () => {
    await asUser(ALICE);
    const { clover } = await request();
    await age(clover.id);
    await asUser(BOB);
    expect(await collect(clover.id)).toEqual({ success: false, error: "not_found" });
    expect(await balance(BOB)).toBe(0);
    expect(await balance(ALICE)).toBe(0);
  });

  it("cannot be collected after it expires", async () => {
    await asUser(ALICE);
    const { clover } = await request();
    await age(clover.id, 60);
    await asUser(ALICE);
    expect(await collect(clover.id)).toEqual({ success: false, error: "expired" });
    expect(await balance(ALICE)).toBe(0);
  });

  it("rejects a tap faster than a person could make it", async () => {
    await asUser(ALICE);
    const { clover } = await request();
    expect(await collect(clover.id)).toEqual({ success: false, error: "too_fast" });
    expect(await balance(ALICE)).toBe(0);
  });

  it("enforces the daily cap even if several clovers were already out", async () => {
    await setCampaign("daily_cap = 1");
    await asUser(ALICE);
    const first = await request();
    await age(first.clover.id);
    await asAdmin();
    // A second clover that somehow exists (e.g. cap lowered mid-day): it still cannot be cashed.
    const camp = await db.query<{ id: string }>("SELECT id FROM public.clover_campaigns WHERE slug='default'");
    const second = await db.query<{ id: string }>(
      `INSERT INTO public.monocle_clovers (user_id, campaign_id, kind, reward, spawned_at, expires_at)
       VALUES ('${ALICE}', '${camp.rows[0].id}', 'standard', 1, now() - interval '5 seconds', now() + interval '20 seconds') RETURNING id`,
    );
    await asUser(ALICE);
    expect((await collect(first.clover.id)).success).toBe(true);
    expect(await collect(second.rows[0].id)).toEqual({ success: false, error: "daily_cap" });
    expect(await balance(ALICE)).toBe(1);
  });

  it("credits the rare reward", async () => {
    await setCampaign("rare_chance = 1, reward = 1, rare_reward_multiplier = 5");
    await asUser(ALICE);
    const { clover } = await request();
    await age(clover.id);
    await asUser(ALICE);
    expect(await collect(clover.id)).toMatchObject({ success: true, clovers_awarded: 5, kind: "rare" });
    expect(await balance(ALICE)).toBe(5);
  });

  it("an unknown id is just not found", async () => {
    await asUser(ALICE);
    expect(await collect("33333333-3333-3333-3333-333333333333")).toEqual({ success: false, error: "not_found" });
  });
});

describe("row level security and direct writes", () => {
  it("users see only their own clovers", async () => {
    await asUser(ALICE);
    await request();
    await asUser(BOB);
    const r = await db.query("SELECT * FROM public.monocle_clovers");
    expect(r.rows).toHaveLength(0);
  });

  it("clients cannot insert or edit clovers or campaigns directly", async () => {
    await asUser(ALICE);
    await expect(
      db.exec(`INSERT INTO public.monocle_clovers (user_id, kind, reward, expires_at)
               VALUES ('${ALICE}', 'rare', 999, now() + interval '1 hour')`),
    ).rejects.toThrow(/permission denied/i);
    const { clover } = await request();
    await expect(db.exec(`UPDATE public.monocle_clovers SET status = 'collected' WHERE id = '${clover.id}'`)).rejects.toThrow(
      /permission denied/i,
    );
    await expect(db.exec(`UPDATE public.clover_campaigns SET reward = 9999`)).rejects.toThrow(/permission denied/i);
    await expect(db.exec(`INSERT INTO public.clover_campaigns (slug, name) VALUES ('x','x')`)).rejects.toThrow(/permission denied/i);
  });

  it("settings are private to their owner and constrained", async () => {
    await asUser(ALICE);
    await db.exec(`INSERT INTO public.monocle_settings (user_id, stick_height_in) VALUES ('${ALICE}', 96)`);
    await expect(db.exec(`INSERT INTO public.monocle_settings (user_id) VALUES ('${BOB}')`)).rejects.toThrow(/row-level security/i);
    await expect(db.exec(`UPDATE public.monocle_settings SET stick_height_in = 5`)).rejects.toThrow(/check constraint/i);
    await asUser(BOB);
    expect((await db.query("SELECT * FROM public.monocle_settings")).rows).toHaveLength(0);
  });

  it("users can log their own sessions but not someone else's, and not edit them", async () => {
    await asUser(ALICE);
    await db.exec(`INSERT INTO public.monocle_sessions (user_id, duration_seconds, device_tier, frames) VALUES ('${ALICE}', 120, 'ok', 1400)`);
    await expect(
      db.exec(`INSERT INTO public.monocle_sessions (user_id, duration_seconds) VALUES ('${BOB}', 1)`),
    ).rejects.toThrow(/row-level security/i);
    await expect(db.exec(`UPDATE public.monocle_sessions SET frames = 0`)).rejects.toThrow(/permission denied/i);
    await expect(db.exec(`INSERT INTO public.monocle_sessions (user_id, duration_seconds) VALUES ('${ALICE}', -5)`)).rejects.toThrow(
      /check constraint/i,
    );
  });
});

describe("schema guard", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const base = `
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  `;

  it("refuses to apply when golfer_profiles is missing", async () => {
    const empty = new PGlite();
    await empty.exec(base);
    await expect(empty.exec(sql)).rejects.toThrow(/golfer_profiles not found/);
    await empty.close();
  });

  it("refuses to apply when golfer_profiles lacks the clover columns", async () => {
    const odd = new PGlite();
    await odd.exec(base + "CREATE TABLE public.golfer_profiles (user_id UUID PRIMARY KEY);");
    await expect(odd.exec(sql)).rejects.toThrow(/user_id, clovers and total_clovers/);
    await odd.close();
  });

  it("refuses to apply when add_clovers is missing, and leaves nothing behind", async () => {
    const noFn = new PGlite();
    await noFn.exec(base + "CREATE TABLE public.golfer_profiles (user_id UUID PRIMARY KEY, clovers INT, total_clovers INT);");
    await expect(noFn.exec(sql)).rejects.toThrow(/add_clovers/);
    const left = await noFn.query<{ n: number }>("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name LIKE 'monocle_%' OR table_name = 'clover_campaigns'");
    expect(left.rows[0].n).toBe(0);
    await noFn.close();
  });
});
