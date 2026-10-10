import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, COURSES_LIVE, JACKPOTS_LIVE, LIVE, PAYMENTS_LIVE, migrationSql } from "./fixtures";

const ADMIN = "55555555-5555-5555-5555-555555555555";
const sql = migrationSql("20261016120000_course_requests.sql");
const holes = (n: number, par = 4, yards: number | null = 350) => Array.from({ length: n }, (_, i) => ({ hole: i + 1, par, yards_est: yards }));

describe("course requests", () => {
  let db: PGlite;
  const asAdmin = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false);`);
  const asUser = async (uid: string | null) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid ?? ""}', false); SET ROLE authenticated;`);
  const asAnon = async () => db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE anon;`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const call = async (s: string, params: unknown[] = []): Promise<J> => (await db.query<{ r: J }>(`SELECT ${s} AS r`, params)).rows[0].r;
  const submit = async (uid: string, name = "Hidden Valley", photo?: string) => {
    await asUser(uid);
    return call(`public.submit_course_request($1, 'Waco', 'TX', 'par 71', $2)`, [name, photo ?? `${uid}/card.jpg`]);
  };
  const approve = async (id: string, data: unknown[] = holes(18), name = "Hidden Valley") => {
    await asUser(ADMIN);
    return call(`public.admin_approve_course_request($1::uuid, $2, 'Waco', 'TX', $3::jsonb)`, [id, name, JSON.stringify(data)]);
  };
  const q = async <T extends object>(s: string) => { await asAdmin(); return (await db.query<T>(s)).rows; };

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE + PAYMENTS_LIVE + JACKPOTS_LIVE + COURSES_LIVE);
    await db.exec(sql);
  });
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await asAdmin();
    await db.exec(`
      TRUNCATE public.course_requests, public.admin_audit_log;
      DELETE FROM public.courses WHERE id <> 41;
      DELETE FROM public.golfer_profiles; DELETE FROM auth.users;
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}'), ('${ADMIN}');
      INSERT INTO public.golfer_profiles (user_id, display_name, role) VALUES ('${ALICE}', 'Alice', NULL), ('${BOB}', 'Bob', NULL), ('${ADMIN}', 'Boss', 'admin');
    `);
  });

  describe("sending a request", () => {
    it("saves it as pending for the player", async () => {
      expect((await submit(ALICE)).success).toBe(true);
      const r = await q<J>(`SELECT course_name, status, user_id FROM public.course_requests`);
      expect(r).toEqual([{ course_name: "Hidden Valley", status: "pending", user_id: ALICE }]);
    });
    it("needs a name, a state and a photo from the player's own folder", async () => {
      await asUser(ALICE);
      expect((await call(`public.submit_course_request('', 'Waco', 'TX', NULL, '${ALICE}/a.jpg')`)).success).toBe(false);
      expect((await call(`public.submit_course_request('Name', 'Waco', '', NULL, '${ALICE}/a.jpg')`)).success).toBe(false);
      expect((await call(`public.submit_course_request('Name', 'Waco', 'TX', NULL, '${BOB}/a.jpg')`)).success).toBe(false); // someone else's folder
      expect((await call(`public.submit_course_request('Name', 'Waco', 'TX', NULL, '${ALICE}/../${BOB}/a.jpg')`)).success).toBe(false);
      expect((await call(`public.submit_course_request('Name', 'Waco', 'TX', NULL, NULL)`)).success).toBe(false);
    });
    it("limits waiting requests to 5 per player", async () => {
      for (let i = 0; i < 5; i++) expect((await submit(ALICE, `Course ${i}`)).success).toBe(true);
      expect((await submit(ALICE, "One more")).success).toBe(false);
      expect((await submit(BOB, "Bob's")).success).toBe(true);
    });
    it("is closed to anonymous callers, and players cannot write the table directly", async () => {
      await asAnon();
      await expect(db.query(`SELECT public.submit_course_request('X', 'Y', 'TX', NULL, 'p')`)).rejects.toThrow(/permission denied/i);
      await asUser(ALICE);
      await expect(db.exec(`INSERT INTO public.course_requests (user_id, course_name, state, photo_path) VALUES ('${ALICE}', 'Sneaky', 'TX', 'p')`)).rejects.toThrow(/permission denied/i);
    });
    it("is private: players only see their own", async () => {
      await submit(ALICE);
      await asUser(BOB);
      expect((await db.query(`SELECT * FROM public.course_requests`)).rows).toHaveLength(0);
      await asUser(ALICE);
      expect((await db.query(`SELECT * FROM public.course_requests`)).rows).toHaveLength(1);
    });
  });

  describe("approving", () => {
    it("creates the course with computed par and gives the player one clover", async () => {
      const id = (await submit(ALICE)).id;
      expect(await approve(id, holes(18, 4, 380))).toMatchObject({ success: true });
      const c = (await q<J>(`SELECT id, name, city, state, holes, par FROM public.courses WHERE name = 'Hidden Valley'`))[0];
      expect(c).toMatchObject({ name: "Hidden Valley", city: "Waco", state: "TX", holes: 18, par: 72 });
      expect(Number(c.id)).toBe(42);
      expect((await q<J>(`SELECT clovers, total_clovers FROM public.golfer_profiles WHERE user_id = '${ALICE}'`))[0]).toEqual({ clovers: 1, total_clovers: 1 });
      expect((await q<J>(`SELECT status, course_id, clover_awarded FROM public.course_requests`))[0]).toMatchObject({ status: "approved", clover_awarded: true });
    });
    it("takes 9-hole courses and yardage left blank", async () => {
      const id = (await submit(ALICE, "Nine Holer")).id;
      expect((await approve(id, holes(9, 3, null), "Nine Holer")).success).toBe(true);
      expect((await q<J>(`SELECT holes, par FROM public.courses WHERE name = 'Nine Holer'`))[0]).toEqual({ holes: 9, par: 27 });
    });
    it("can only be done once: no second clover, no second course", async () => {
      const id = (await submit(ALICE)).id;
      await approve(id);
      expect(await approve(id)).toEqual({ success: false, error: "This request was already approved" });
      expect((await q<J>(`SELECT count(*)::int AS n FROM public.courses WHERE name = 'Hidden Valley'`))[0].n).toBe(1);
      expect((await q<J>(`SELECT clovers FROM public.golfer_profiles WHERE user_id = '${ALICE}'`))[0].clovers).toBe(1);
    });
    it("rejects bad hole data and duplicates, creating nothing", async () => {
      const id = (await submit(ALICE)).id;
      expect((await approve(id, holes(10))).error).toMatch(/9 or 18/);
      expect((await approve(id, holes(18, 9))).error).toMatch(/par must be 3 to 6/);
      expect((await approve(id, holes(18, 4, 5000))).error).toMatch(/yards/);
      expect((await approve(id, holes(18).map((h, i) => ({ ...h, hole: i === 3 ? 9 : h.hole })))).error).toMatch(/numbered/);
      await asUser(ADMIN);
      expect((await call(`public.admin_approve_course_request($1::uuid, 'EXISTING links', 'austin', 'tx', $2::jsonb)`, [id, JSON.stringify(holes(18))])).error).toMatch(/already in the finder/);
      expect((await q<J>(`SELECT count(*)::int AS n FROM public.courses`))[0].n).toBe(1);
      expect((await q<J>(`SELECT clovers FROM public.golfer_profiles WHERE user_id = '${ALICE}'`))[0].clovers).toBe(0);
    });
    it("is admin-only", async () => {
      const id = (await submit(ALICE)).id;
      await asUser(ALICE);
      expect(await call(`public.admin_approve_course_request($1::uuid, 'X', 'Y', 'TX', $2::jsonb)`, [id, JSON.stringify(holes(18))])).toEqual({ success: false, error: "Unauthorized" });
      await asUser(ALICE);
      expect(await call(`public.admin_reject_course_request($1::uuid, 'no')`, [id])).toEqual({ success: false, error: "Unauthorized" });
      await asUser(ALICE);
      expect(await call(`public.admin_list_course_requests('pending')`)).toEqual({ success: false, error: "Unauthorized" });
      await asAnon();
      await expect(db.query(`SELECT public.admin_list_course_requests('pending')`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe("rejecting and listing", () => {
    it("rejects with a reason, no clover, and cannot then be approved", async () => {
      const id = (await submit(ALICE)).id;
      await asUser(ADMIN);
      expect((await call(`public.admin_reject_course_request($1::uuid, 'Photo is blurry')`, [id])).success).toBe(true);
      expect((await q<J>(`SELECT status, reject_reason FROM public.course_requests`))[0]).toEqual({ status: "rejected", reject_reason: "Photo is blurry" });
      expect((await approve(id)).error).toMatch(/already rejected/);
      expect((await q<J>(`SELECT clovers FROM public.golfer_profiles WHERE user_id = '${ALICE}'`))[0].clovers).toBe(0);
    });
    it("lets admin list pending requests with the submitter's name, oldest first", async () => {
      await submit(ALICE, "First");
      await submit(BOB, "Second");
      await asUser(ADMIN);
      const list = (await call(`public.admin_list_course_requests('pending')`)).requests;
      expect(list.map((r: J) => [r.course_name, r.submitted_by])).toEqual([["First", "Alice"], ["Second", "Bob"]]);
    });
  });

  describe("safety check", () => {
    it("refuses to apply when courses has other required columns, and says which", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + PAYMENTS_LIVE + JACKPOTS_LIVE + COURSES_LIVE + "ALTER TABLE public.courses ADD COLUMN osm_ref TEXT NOT NULL DEFAULT 'x'; ALTER TABLE public.courses ALTER COLUMN osm_ref DROP DEFAULT;");
      await expect(d.exec(sql)).rejects.toThrow(/osm_ref/);
      await d.close();
    });
    it("refuses to apply without the courses table", async () => {
      const d = new PGlite();
      await d.exec(BASE + LIVE + PAYMENTS_LIVE + JACKPOTS_LIVE);
      await expect(d.exec(sql)).rejects.toThrow(/courses table not found/);
      await d.close();
    });
  });
});
