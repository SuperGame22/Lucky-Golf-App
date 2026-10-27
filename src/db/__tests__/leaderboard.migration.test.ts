import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALICE, BASE, BOB, LIVE, ROUNDS_LIVE, migrationSql } from "./fixtures";

const CAROL = "33333333-3333-3333-3333-333333333333";

describe("leaderboard", () => {
  let db: PGlite;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type J = Record<string, any>;
  const asUser = async (uid: string) => db.exec(`RESET ROLE; SELECT set_config('test.uid', '${uid}', false); SET ROLE authenticated;`);
  const board = async (): Promise<J> => (await db.query<{ r: J }>(`SELECT public.get_leaderboard(90) AS r`)).rows[0].r;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BASE + LIVE + ROUNDS_LIVE);
    await db.exec(`
      ALTER TABLE public.golfer_profiles ADD COLUMN display_name TEXT;
      ALTER TABLE public.rounds ADD COLUMN score_diff INTEGER, ADD COLUMN holes_played INTEGER, ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
      INSERT INTO auth.users (id) VALUES ('${ALICE}'), ('${BOB}'), ('${CAROL}');
      INSERT INTO public.golfer_profiles (user_id, display_name) VALUES ('${ALICE}', 'alice smith'), ('${BOB}', 'Bob'), ('${CAROL}', 'Carol Jones');
      -- Alice: +4 over 18 and +1 over 9 (= +2 at 18 scale) -> best +2
      INSERT INTO public.rounds (user_id, completed, score_diff, holes_played) VALUES ('${ALICE}', true, 4, 18), ('${ALICE}', true, 1, 9);
      -- Bob: +3 over 18; an unfinished -10 doesn't count; neither does an old round
      INSERT INTO public.rounds (user_id, completed, score_diff, holes_played) VALUES ('${BOB}', true, 3, 18), ('${BOB}', false, -10, 5);
      INSERT INTO public.rounds (user_id, completed, score_diff, holes_played, created_at) VALUES ('${BOB}', true, -20, 18, now() - interval '200 days');
      -- Carol: no rounds
    `);
    await db.exec(migrationSql("20261027130000_leaderboard.sql"));
  });
  afterAll(async () => { await db.close(); });

  it("ranks by best to-par at 18-hole scale, public names, marks you", async () => {
    await asUser(BOB);
    const r = await board();
    expect(r.success).toBe(true);
    expect(r.leaders).toEqual([
      { rank: 1, name: "Alice S.", best_to_par: 2, rounds: 2, is_you: false },
      { rank: 2, name: "Bob", best_to_par: 3, rounds: 1, is_you: true },
    ]);
  });

  it("signed-in only", async () => {
    await db.exec(`RESET ROLE; SELECT set_config('test.uid', '', false); SET ROLE authenticated;`);
    expect(await board()).toMatchObject({ success: false });
    await db.exec(`RESET ROLE; SET ROLE anon;`);
    await expect(board()).rejects.toThrow(/permission denied/);
  });
});
