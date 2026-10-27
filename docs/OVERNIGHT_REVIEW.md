# Overnight review: 2026-10-27

Branch `overnight-review`. Nothing here is on production until the PR is merged and the database steps below are run.

## 0. Check first: the live database didn't respond

During the review, `vmhlultqlwligbfoqhwf.supabase.co` did not resolve in DNS (NXDOMAIN). If the live app can't sign in, open
the Supabase dashboard. A free-tier project is **paused** after about 7 days without activity; press **Restore**.
Nothing in this branch changes that.

## 1. How to ship (in this order)

1. **Database:** in the Supabase SQL editor, run these new migrations in order. Each is idempotent and has rollback
   notes at the top.
   - `supabase/migrations/20261027120000_security_hardening.sql`
   - `supabase/migrations/20261027130000_leaderboard.sql`
   - `supabase/migrations/20261027140000_member_perks.sql`
   - `supabase/migrations/20261027150000_amoe_entries.sql`
   - `supabase/migrations/20261027160000_prize_fulfillment.sql`

   **Before step 1, check the older repo migrations.** If any of `20261006` to `20261017` were never applied, run them
   first, in filename order. Run this to see which exist:
   `select proname from pg_proc where pronamespace='public'::regnamespace order by 1;`
   Example: `award_round_clovers` and `wager_status` should be in the list.
2. **Edge functions:** `supabase functions deploy coach-chat analyze-swing create-checkout shopify-webhook issue-discount`.
   Optionally add the secret `APP_URL=https://lucky-golf-app.vercel.app`.
3. **Merge the PR.** Vercel deploys main. Players get a "new version ready, Reload" prompt instead of a surprise reload.

The app keeps working if step 1 is late. The leaderboard falls back to the player's own rounds, and the new RPC calls
fail quietly.

## 2. What was wrong, and what changed

### Security (critical)

| Problem | Fix |
|---|---|
| Any signed-in player could make themselves **admin** or **Gold**, or set their own gold balance, with one update to `golfer_profiles` | DB trigger blocks players changing `role`, `membership_tier`, `gold_balance`, `clovers`, `spins` and `putt_credits`; only the server can |
| Coach Ace (`coach-chat`) was an **open OpenAI proxy**: no login check, no membership check, any prompt | Members only (Clover/Gold), only user/assistant messages, length caps, 40 questions/day |
| `analyze-swing` callable by anyone | Sign-in required |
| Shopify orders over ~$2,000 recorded their clovers as given but **granted none** (500-per-call cap) | Granted in chunks of 500 |
| A Stripe retry could double-credit putts | Unique Stripe reference |
| Players could possibly write wallets/transactions/competitions directly | Insert/update/delete revoked (the app only reads them) |
| Round clovers' daily cap could be raced | Per-player lock |
| Shopify **deposits** (partially paid) earned full clovers | Only paid orders count |

### Integrity / money

- **Wagers now pay only when every partner confirms.** Before, with 3 players, the host plus one partner could settle
  over the third. Any "no" goes to admin review. This is a decision: to go back to majority, re-run `_wager_evaluate`
  from `20261012120000_wager_results.sql`.
- A double tap on Start can no longer create two wagers and charge twice.
- Real-money competitions from the scorecard no longer say "Pebble Beach, 9am tomorrow"; they use the round's course.

### Things that showed fake or broken data

- **Scorecard:**
  - "Finish Round" after 1 hole used to fill the rest with par and save a full round. It now saves only the holes
    scored; unfinished rounds don't earn clovers or count in stats.
  - The to-par number now compares against the par of the holes played. It used to read -32 after hole 1.
  - The round in progress survives a refresh.
- **Round history:** tapping a recent round opened a blank scorecard. There are now a Scorecard History list and a
  read-only round page.
- **Enhanced Stats** (a paid page) showed only "—". It now shows real numbers from rounds: scoring average, best,
  putts, 1- and 3-putt %, and trend.
- **Leaderboard:** each player could only ever see themself (privacy rules hid other rounds). It now uses a server
  ranking by best to par, with 9-hole rounds scaled to 18, and names shown as "Cole M.".
- **Achievements:** spending clovers re-locked badges, and "Ace" could never unlock. Fixed; two not-built badges now
  say "Coming soon".
- **Home:**
  - "+3 this week" was a hardcoded placeholder; it is now hidden unless the server knows the number.
  - Activity was always empty; it now shows real purchases, top-ups and payouts.
- **Gold Machine:**
  - The dev tier toggle let anyone pick Gold.
  - "Cash Out" showed "Cashed out $X" and paid nothing.
  - It is now a "coming soon" preview.
  - The separate local "tier" system was removed; `membership_tier` is the only source.
- **Membership:** "Start Free Trial" did nothing and Free always showed as "Current Plan". It now shows the real
  current plan, and paid sign-up says "opening soon".
- **Spinz:**
  - The toast showed a shared static code (LUCKY10 to LUCKY30) even when the player had a personal code.
  - The permanently empty "Recent Winners" card was removed.

### Accounts

- **Password reset** sent people to Home with no way to set a new password. There is now a "Choose a new password"
  screen.
- After signing in, players return to the page they were trying to open.
- Profiles are created by the database at sign-up, which works with email confirmation on.
- Paid pages (Coach Ace, Enhanced Stats, Score Patterns) **fail closed**: a missing profile no longer lets people in.
- Admins are no longer bounced to Home right after logging in.
- Sign-out clears per-player data on the phone.
- Clearing the handicap now saves.

### New tools (admin + members)

- **Monthly free putts** (Clover 3 / Gold 7), added the first time Lucky Putts is opened each month.
- **Admin → Spinz prizes:** a queue of won clubs and Clover Club months, with "Activate Clover Club" and "Mark done".
- **Admin → Fan content:**
  - A free-entry-by-email (AMOE, Terms §8) grant box.
  - A review checklist (product shown, video at least 10 seconds).
- Raffle and share pages show "No purchase necessary" and free-entry wording. The upload checkbox confirms 18+ and US
  residency.

### App quality

- An error screen with Reload replaces the blank page. The app also reloads once automatically when a page file from
  an old release is missing (common right after a deploy).
- The bottom navigation was rendered twice; now once, clear of the iPhone home bar. The header clears the notch.
- **First load is smaller:**
  - The tab screens load on demand.
  - The 60 KB terms text loads only when opened.
  - Product images went from PNG to WebP, about 90% smaller; the 2.3 MB mascot is now 26 KB.
- Coach Ace replies no longer drop text split across network chunks.
- Practice putting sessions are now saved (the insert was never sent).
- Removed:
  - dead pages (old chat, distance and sessions drills, progress stub);
  - 36 unused UI components;
  - 32 unused packages, which also cleared the one high npm-audit warning.
- **Tooling:**
  - TypeScript strict mode is on, and lint is clean.
  - `package-lock.json` is now committed, so builds are reproducible.
  - A date-dependent raffle test was fixed.
  - Tests: 460 passing (was 429), including 5 new database test files.
- Cache and security headers were added in `vercel.json`.

## 3. Still open (needs you or a decision)

1. **Selling memberships:** needs Stripe subscription products and a webhook that sets `membership_tier`. Until then,
   admins can set tiers (Spinz prizes page / `admin_set_membership_tier`).
2. **Gold economy:** the leprechaun, generation and cash-out need server rules before the Gold Machine can go live.
   The Gold 2x clover multiplier is not built.
3. **Course database:** the West and South US regions are not loaded (steps are in the project roadmap). Drop the
   `tmp_import_courses` leftover in the SQL editor.
4. **Legal review:**
   - Clovers T&Cs §10.4/§16 waive gross negligence, which is unenforceable in California.
   - Paid putts and prizes.
   - 18+ is self-declared only.
5. **Static Spinz codes** LUCKY10 to LUCKY30 are in the app code. If they exist in Shopify, anyone can use them. Once
   Shopify is connected (personal codes), deactivate them in Shopify.
6. **Drive sync** of approved fan content (needs a Google service account + Shared Drive). Storage is 1 GB on free
   Supabase.
7. **Pinch-zoom:** the viewport still blocks zoom. This was left on purpose: allowing it would make iPhones zoom into
   form fields.
8. **Majors behind:** `react-router-dom` (moderate advisory, fix is v7), Vite 5 and vite-plugin-pwa. Upgrade
   separately.

## 4. Handoff: unfinished work (from final code review, not yet fixed)

Status: branch `overnight-review` exists ONLY in the local sandbox (/home/claude/lg). It is NOT pushed to GitHub, no PR, no Vercel preview. Migrations NOT applied to live DB. Gates green at last run: typecheck, lint 0, build, 460 tests.

### Fixed after the final review
1. Scorecard draft is no longer erased by opening the scorecard without a course (only saving or resetting the length clears it).
2. The "new version, Reload" prompt is no longer missed (the update is remembered until the prompt mounts).
3. `protect_profile_columns()` now passes INSERTs through.
4. Unfinished rounds keep correct hole numbers (full-length arrays, null = not played).
5. Leaderboard ignores impossible rounds (9-18 holes, score no better than 1 under par per hole).
6. The sign-up trigger is now `zz_lg_create_profile_on_signup`, so it fires after any existing profile trigger and does nothing if the profile exists (no collision).

### Still open from the review
- Wager with a silent partner stays "awaiting" (all-partners rule). Needs a timeout or an admin settle button.

### Run on live DB BEFORE applying migrations
- `SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('create_competition','join_competition','settle_competition','spin_wheel','credit_putts','add_clovers');` Every row must be `t`. If `create_competition`/`join_competition` are not SECURITY DEFINER, the REVOKE on wallets/competitions/competition_players breaks wagers. Fix those functions first or skip that REVOKE block.
- After applying: `SELECT has_table_privilege('authenticated','public.wallets','INSERT');` should be `f`.
- `SELECT tgname, tgfoid::regproc FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal;` Informational: an existing profile trigger is now safe (ours fires last and no-ops).
- Supabase project `vmhlultqlwligbfoqhwf` DNS did not resolve (likely paused): Restore in dashboard first.

### Deliver
1. Push `overnight-review` to GitHub (no git credentials in sandbox; use Composio GitHub tools, include binary WebP images + package-lock.json) and open PR.
2. Confirm Vercel preview READY.
3. Run migrations in order (section 1), deploy edge functions, merge PR.

### Still open (decisions)
Stripe subscriptions; Gold economy; West/South course data + drop `tmp_import_courses`; legal review of Terms §10.4/§16 and 18+ self-declaration; static LUCKY10-30 codes; Drive sync of fan content; react-router/Vite major upgrades; Coach Ace OpenAI credits; rangefinder meaning; Stripe live test.
