# Progress

Agents update this file after every task, newest entries first. A fresh session reads it to know where things stand.

## Current status

- Milestone: M2 The world streak (M1b and its follow-ups T87, T85, T79 are done)
- Active task: T97 One meter-reply check
- Blocked tasks: none
- Waiting on the human: please-confirm items (the 3-hour hidden meter, the refused/not-sent wording); later, an accessibility pass and more Tower testers. See docs/NEEDS_HUMAN.md.
- Next: T97 (meter-reply check), then T21 daily close. Reviews follow the new CLAUDE.md step 8 (light review for maintenance) and the usage-saving memory note. T91 (approved wording) fits in when convenient.

## Log

<!-- Format:
### YYYY-MM-DD — T07 Stacking game engine (PR #12)
- Summary in one line
- Review rounds: spec 1, quality 2, tests 1
- Notes: anything the next session should know
-->

### 2026-11-11 — T96 Shared pgTAP fixtures (PR #49)
- `supabase/tests/fixtures/fixtures.psql` (`tests.make_player`, `clear_today`, `start`, `play_day`), included with `\ir fixtures/fixtures.psql` after `begin;` so it rolls back with each file; the `.psql` extension keeps `supabase test db` from running it. Used by the counters, integrity and record-result tests; `fixtures.test.sql` checks it. 231 pgTAP tests.
- Review: light review, 1 round. Notes: T21 can build closed or open days with set counts via `tests.play_day`. Merges since the maintainer check after T93: 3.

### 2026-11-11 — T80 Field key warning and quieter test output (PR #48)
- The warning came from `key` after `{...control}` in `CountrySelect` (JSX falls back to `createElement`); only Next's canary React warns, so a lint rule (`no-restricted-syntax`, key after spread) guards it. Coverage prints `text-summary`; Playwright writes to `test-results/playwright`.
- Review: light review, 1 round. Notes: `test-results/wait-ci.mjs` recreated (exits 3 if green but not merged). Merges since the maintainer check after T93: 2.

### 2026-11-11 — T95 One local-only toolkit for the dev scripts (PR #47)
- `scripts/lib/localSupabase.mts`: the one localhost guard, service-role client and `check()`, used by `seed-dev` and `e2e-local`; `seed-dev` reads numerics with the app's `dbNumber`. `"type": "module"` in package.json and `allowImportingTsExtensions` in tsconfig so Node scripts can import app `.ts` files.
- Review: light review (quality-reviewer), 1 round, the first under the human's new usage rules (Sonnet reviewers, light review for maintenance, no re-review for polish).
- Notes: the human set `autoCompactWindow` to 200k and clears context between tasks. Merges since the maintainer check after T93: 1.

### 2026-11-11 — Maintainer check after T93
- Health good (711 unit, 226 pgTAP, lint and typecheck clean; outdated packages all already in T51). New tasks T95 (one local-only toolkit for the dev scripts, strict numerics in seed-dev), T96 (shared pgTAP fixtures) and T97 (one meter-reply check tied to `MeterBody`), all before T21. Merges since this check: 0.

### 2026-11-11 — T93 Day counter integrity (PR #46)
- Migration `20261111000000_day_counter_integrity`: `counted_weight` not null; `stamp_attempt_weight` security invoker (pgTAP inserts as service_role); a start on a closed day is refused in the database (WS001, share lock on the day row); a pass with no counters row raises. Start answers 409 `day-closed`, and `/play` says "Today's challenge just closed. Press Start to play the next one."
- Review rounds: spec 2, quality 2, tests 2 (round 1, spec and tests: the security-invoker switch lacked a service_role insert test).
- Notes: T21's `close_game_day` must lock the `game_days` row before reading the counters (its notes say so). The `record_attempt_result` pgTAP fixture now closes its day after the attempt starts.

### 2026-11-11 — T92 One strict parser for numeric database values (PR #45)
- `src/lib/db/numeric.ts` (`numericSchema`, `dbNumber`, `dbInteger`) used by the attempt store and the meter read, so a malformed row fails with a 500 instead of becoming 0 or NaN. `readMeter` moved to the server-only `src/lib/meterRead.ts`.
- Review rounds: spec 2, quality 2, tests 2 (round 1, quality: `meter.ts`, loaded by the browser, pulled zod into the home page's bundle; fixed and checked in the build output; an import allowlist test now guards it).
- Notes: client-bundle checks are worth doing by grepping `.next/static/chunks` after a build. Merges since the maintainer check after T18: 4.

### 2026-11-11 — T20 Local fake-player seeding script (PR #44)
- `npm run seed:dev -- --players N --pass-rate R [--date YYYY-MM-DD]`: fresh fake accounts with profiles and submitted attempts; today through `record_attempt_result`, another day by direct writes plus a pass per passing attempt with its `counted_weight` (DECISIONS); refuses closed days and any non-localhost URL (guard first, exits 1). README "Fake players".
- Review rounds: spec 2, quality 2, tests 2 (round 1: no test of the refusal and exit code; a past-date test that could not tell passes from players).
- Notes: printing the counters with an ad hoc script that loads `.env.local` was denied by the permission check; verified through the script's status checks, the T17 pgTAP and the meter e2e instead. Merges since the maintainer check after T18: 3.

### 2026-11-11 — T19 Meter UI (PR #43)
- `src/components/Meter.tsx` on `/` and below the result on `/play`: a mint bar with a threshold marker, "72% passing · 60% needed · 1,234 attempts", a countdown; the hidden message in the final 3 hours, switching by its own clock. Polls every 60 s only while visible; newest reply wins; one reload at the deadline; malformed replies read as unavailable.
- Review rounds: spec 3, quality 3, tests 3. Rounds 1 and 2 approved with suggestions (applied and re-reviewed); round 2's test review blocked on an untested request storm after the deadline, now pinned.
- Notes: open question for the human: should the refused-result view on `/play` show the meter too? Merges since the maintainer check after T18: 2.

### 2026-11-10 — T94 One meter-window helper (PR #42)
- `meterHiddenFrom(closesAt)` in `src/lib/meter.ts` is the only copy of the hide-window start; the module is client-safe (a test checks every import specifier).
- Review rounds: spec 1, quality 1, tests 1. Merges since the maintainer check after T18: 1.

### 2026-11-10 — Maintainer check after T18
- Health good (604 unit, 210 pgTAP; no TODOs; audit issues dev-only). New tasks T92 (one strict numeric parser), T93 (counter integrity, taking the T17 follow-ups out of T21) and T94 (one meter-window helper, before T19). Merges since this check: 0.

### 2026-11-10 — T18 Cached meter endpoint (PR #41)
- `GET /api/meter`: public, read-only, one query on `game_days` with its counters embedded; hidden (no rate or count) for the final `METER_HIDE_HOURS = 3`; cached publicly for 30 s, shrinking to `no-store` near 21:00 and midnight UTC.
- Review rounds: spec 2, quality 2, tests 2. Round 1 (quality): the proxy refreshed sessions on the cached meter, and the anon key could read the counters, bypassing the hidden window. Fixed: the proxy skips `/api/meter`, and migration `20261110020000_private_day_counters` makes the counters server-only (the meter reads them with the service role).
- Notes: T19 should switch to hidden by its own clock (via T94's helper) and render `threshold: null`.

### 2026-11-10 — T17 Running counters per game day (PR #40)
- `game_day_counters` per day; an attempt counts when it starts (after-insert trigger, with the weight stamped on the row as `counted_weight`), a recorded pass adds the same weight in `record_attempt_result`. `/play` now says "Counted as not passed" for a refused result and "Result not sent" when it never arrived (please-confirm in NEEDS_HUMAN).
- Review rounds: spec 1, quality 1, tests 1. A before-insert counting trigger ran ahead of RLS (caught by the existing pgTAP); split into before (stamp) and after (count). Follow-ups for T21 in its notes (refuse starts on a closed day).
- Notes: re-applying the edited migration needed a local `supabase db reset` (the human agreed; Docker stayed up). Merges since the maintainer check after T16: 4.

### 2026-11-10 — T68 One attempt store and one challenge lookup (PR #39)
- `supabaseAttemptStore` serves start, submit and `/play`: one `gameDay`, `findAttemptForDay` (with the stored result) and `findAttemptById`; `challengeForGameDay` in the registry; shared types in `src/lib/attempts/types.ts`. T17 and T21 extend this store.
- Review rounds: spec 1, quality 1, tests 1. Merges since the maintainer check after T16: 3.
- Notes: the human approved the game_settings values and the T91 wording, restarted Docker and restored `.env.example` (Nov 10).

### 2026-11-10 — T67 Coverage thresholds for scoring and game-day logic (PR #38)
- `passes` lives in `src/lib/scoring/pass.ts`; 90% lines and branches for `src/lib/attempts/**`, `gameDay.ts`, `settings.ts`, `PlayToday.tsx` and `StackingPractice.tsx` (all at 100%). The empty `src/lib/streak/**` glob names T21, T34 and T24.
- Review rounds: spec 1, quality 1, tests 1. Merges since the maintainer check after T16: 2.

### 2026-11-10 — T66 Shared route-handler helpers (PR #37)
- `src/lib/http/route.ts` (`jsonNoStore`, `errorResponse`, `requireUser`, `readJsonBody`, `withServerErrors`) used by the start, submit and health routes; `secureRandomSeed` in `src/lib/random.ts` (also used by practice). The route helpers are server-only through `@/lib/supabase/server`, because Vitest resolves `server-only` to its throwing entry.
- Review rounds: spec 1, quality 1, tests 1. New routes (T18 onward) should start from these helpers.
- Notes: e2e could not run locally (Docker Desktop down); CI ran it. Merges since the maintainer check after T16: 1.

### 2026-11-10 — Maintainer check after T16
- Health good (566 tests, 99% lines). New tasks T90 (ResultHero owns focus and notes) and T91 (unfinished-attempt wording, needs the human's wording); notes added to T67 (settings.ts at 90%), T86 (e2e imports through support) and T80 (overlaps T63). Advice: land T66, T67 and T68 before T17 and T18. Merges since this check: 0.

### 2026-11-10 — T16 Game settings table (PR #36)
- One admin-editable `game_settings` row (single-row by a boolean key) with the launch values; `ensure_game_day` reads it and raises if it is missing; everyone reads, only `is_admin()` users update, nobody inserts or deletes; the database refuses bad default pass targets. `src/lib/settings.ts` parses it with zod.
- Review rounds: spec 2, quality 2, tests 2 (round 1: unchecked pass-target values could stop new days; the player-update check was masked by the admin's later update).
- Notes: changing an already-applied migration needed `npx supabase db reset`, which wiped local accounts; after it, Docker Desktop would not start. Follow-ups in T89.

### 2026-11-10 — T79 One shared result layout for play and practice (PR #35)
- `ResultHero` (`src/components/ui/ResultHero.tsx`) renders the score above the verdict on both screens; a pass on `/play` glows mint, practice stays plain mint; the `/play` verdict now uses the practice size. Font sizes in `clamp()` calls are `--fs-text-*` tokens.
- Review rounds: spec 2, quality 2, tests 2 (round 1: the tones). Small test-hook suggestions became T88.
- Notes: a sudden shutdown interrupted round 2; on resuming, the reviewers were launched without the command rules and prompted the human. Always paste the rules into reviewer prompts. `.env.example` was found deleted in the working tree after the shutdown (not committed; the human was asked to restore it). Merges since the M1b check: 4 (T87, T15, T85, T79).

### 2026-11-10 — T85 Tower wording in rows (PR #34)
- Results say "You reached row 7. Today's target was row 10." (`src/components/stacking/rows.ts`, replacing `blocks.ts`); the HUD and the result share `targetRowNumber` for rounding a fractional target up.
- Review rounds: spec 1, quality 1, tests 1.
- Notes: CI is now awaited with `node test-results/wait-ci.mjs <pr>` in the background (the human asked for a slow poll instead of "check"). Merges since the M1b check: 3 (T87, T15, T85).

### 2026-11-10 — T15 Confirm Google sign-in with real credentials (PR #33)
- The human set up a Google OAuth client and confirmed a real login reaches profile completion and home. The README has the setup (PowerShell and bash), the `npm.cmd`/`npx.cmd` workaround for PowerShell's script policy, and the "OAuth client was not found" symptom. M1 is now fully complete.
- Review rounds: spec 1, quality 1, tests 1.
- Notes: GitHub was slow to start CI for new PRs twice today; it caught up after a few minutes (an empty commit and `gh run watch` on the run ahead of it helped). CI warns that `actions/checkout@v4` and `actions/setup-node@v4` run on a deprecated Node; updating them needs the human's approval (workflow change). Merges since the M1b check: 2 (T87, T15).

### 2026-11-10 — T87 No idle drop: a row waits for its tap (PR #32)
- The human's second play-test decision: no time limit. The engine has no idle drop (the T76 entry's 8 s drop no longer applies); the server refuses unfinished runs (`finished`) and has no submission age limit; the game records only taps the engine counts (a 0 ms tap could otherwise leave a run unable to end).
- Review rounds: spec 2, quality 2, tests 2 (round 1: the 0 ms tap).
- Notes: tests end runs with `tapsForAMiss` (in `src/challenges/stacking/player.ts`, test support). GitHub was slow to start CI for this PR; an empty commit retriggered it. Merges since the M1b check: 1.

### 2026-11-10 — M1b complete
- The Fresh Sport look (T73), the grid Teetering Tower (T76), restyled home, play and practice (T74), account screens with confirm password (T75), the Tower's renderer and HUD (T77) and the screens around it (T81) are merged. The maintainer check after T77 (one merge before the end) serves as the end-of-milestone check: T82 to T86 added.
- Notes: the second play-test checklist is in NEEDS_HUMAN. Run local e2e with `--workers=1` (T78).

### 2026-11-10 — T81 /play and practice around the Tower (PR #30)
- How-to and "Practice first" on `/play` (from `STACKING_HOW_TO`, absorbing T71; the link goes once Start is pressed); big Unbounded score on results; the header hides during a run (DECISIONS); the missed row falls for `FALL_MS` before the result. e2e runs end on a deliberate miss computed with the real engine (`tests/e2e/support/tower.ts`) and check shown, stored and engine scores agree.
- Review rounds: spec 2, quality 2, tests 2 (round 1: the Practice link stayed live while starting; the fall's length and drawing were not pinned).

### 2026-11-10 — T77 Teetering Tower renderer and HUD in the new look (PR #29)
- Rounded 8 px cells; lost cells fall and fade (400 ms) and a tapped row bounces (180 ms), both pure functions of the engine's lock times and off under reduced motion; a target line on `/play`. The start endpoint returns the day's pass target; the HUD shows "Row N", "Row N to pass" on `/play` and the visit's best in practice.
- Review rounds: spec 2, quality 2, tests 2 (round 1: square cells; the colour-token mapping was untested).
- Notes: T77 was split; the rest is T81. Merges since the M1 maintainer check: 5, so the maintainer ran after this merge.

### 2026-11-09 — T75 Sign-in, sign-up and profile screens: Fresh Sport and fixes (PR #28)
- Account pages in the page shell with a back button and a surface card; new fields; the pill submit button with its spinner; Google as the secondary pill. Sign-up has "Confirm password" (checked in the form and on the server) and keeps both passwords after a failed submit (ref plus layout effect, never in the HTML). The `--md-*` aliases are gone, with a test over all of `src/`.
- Review rounds: spec 2, quality 2, tests 2 (round 1: the kept password sat in a value attribute; back buttons and the profile spinner were untested).
- Notes: run local e2e with `--workers=1` for now: with 6 workers the dev server's Fast Refresh stalls in-flight sign-ups (T78). CI (production build, parallel) passed. Merges since the M1 maintainer check: 4 (T73, T76, T74, T75).

### 2026-11-09 — T74 Restyle home, play and practice in Fresh Sport (PR #27)
- Home with the big title and the highlighted Teetering Tower card; `/play` and practice in the page shell with a back button (hidden while a game runs, via `data-game-running`), busy Start, a visible checking spinner, a verdict reveal and confetti on a fresh pass; "counted as not passed" wording; `tests/e2e/look.spec.ts` for real-browser checks.
- Review rounds: spec 2, quality 2, tests 2 (round 1: the back button stayed beside the board during a scored run).
- Notes: follow-ups recorded in T77, T17, T78 and the new T79. Merges since the M1 maintainer check: T73, T76, T74 (3).

### 2026-11-09 — T76 Teetering Tower grid engine (PR #26)
- Column-grid stacker in `src/challenges/stacking/engine.ts` (7 x 15, forced narrowing at rows 6 and 11, top row wins, no time limit, an untapped row drops off after 8 s); tuned with `player.ts` (decent ±80 ms reaches about 10); plain grid renderer and loop.
- Review rounds: spec 1, quality 1, tests 1.
- Notes: replay with `simulate(params, taps)` (nowMs defaults to Infinity, always ends); the live game passes its clock. The idle-drop rule and the speed await the human's second play-test.

### 2026-11-09 — T73 Fresh Sport design system and app shell (PR #25)
- Hand-written Fresh Sport tokens (`src/app/tokens.css`, palette mirrored in `src/lib/theme/palette.ts` with contrast and drift tests); Unbounded and Manrope; shared components in `src/components/ui/`; the wordmark header. Legacy `--md-*` names are aliased until T74/T75.
- Review rounds: spec 3, quality 3, tests 3 (focus ring hidden by button shadows, busy buttons unnamed, a hydration mismatch, and the translucent canvas smearing without a clear, all fixed).
- Notes: `npm run test:e2e:local` now uses port 3100 and `.next-e2e`, so it runs beside the human's `npm run dev`. The Material generator and `npm run tokens` are gone.

### 2026-11-09 — M1 play-test and re-plan (docs)
- The human play-tested M1. Feedback: the Tower was far too easy and should be an arcade-style column grid; the look was drab; sign-up should keep the password and ask for it twice; back buttons and spinners everywhere; fun alliterative names. Leaving early is a loss.
- The human picked visual direction C "Fresh Sport" from three mockups (https://claude.ai/artifact/3Lpden7TLXog2zTMaeUQZ8). UI guidelines rewritten to v2; new milestone M1b (T73 to T77) before M2; T17 now counts started attempts.
- Notes: decisions are in DECISIONS ("Human decisions at the M1 play-test").

### 2026-11-09 — T14 Daily play page end to end (PR #22)
- Home page with the pitch (`GAME_PITCH`), "Play today's challenge" and "Practice"; `/play` (`src/app/play/page.tsx` server, `PlayToday.tsx` client) with sign-in prompt, profile redirect, the one-attempt rule, server-issued instance, server verdict, stored result and abandoned states; `todaysAttempt` in `src/lib/attempts/today.ts`.
- Review rounds: spec 2, quality 2, tests 2 (round 1: a stored pass was never tested and the reload did not re-check the verdict).
- Notes: e2e games need a paused clock (`page.clock.install` then `pauseAt`), because an installed clock keeps running in real time and network delays move the taps. M1 is complete apart from T15 (blocked on Google OAuth keys).

### 2026-11-09 — T60 Practice: move focus to the result when a run ends (PR #21)
- The result heading takes focus when a run ends (so it is announced and a held Space cannot restart); the canvas takes focus when a run starts. Neither shows a focus ring (not Tab stops).
- Review rounds: spec 2, quality 2, tests 2 (round 1: `StackingPractice.test.tsx` did not check focus after "Play again").
- Notes: maintainer check after T60 ran: added T66 to T68 and notes on T58 and T62. Biggest risk: scoring and game-date code has no 90% coverage threshold yet (T67).

### 2026-11-09 — T13 Attempt submit endpoint with server replay (PR #20)
- `POST /api/attempts/submit` (`src/app/api/attempts/submit/route.ts`) over `submitAttempt` and `supabaseSubmitStore`; `record_attempt_result` (service role only, security definer, locks the attempt and day, checks the deadline by the database clock); `ChallengeModule.lastInputMs`; limits in `src/config/attempts.ts`.
- Review rounds: spec 1, quality 1, tests 1 (applied: the deadline check in SQL, a 64 KB body cap).
- Notes: pgTAP fixtures must avoid real dates (e2e leaves today's game day behind); use far-past dates or `on conflict`. Parallel reviewer test runs collide on `coverage/`; give reviewers separate coverage folders.

### 2026-11-09 — T12 Attempt start endpoint (PR #19)
- `POST /api/attempts/start` (`src/app/api/attempts/start/route.ts`) over `startAttempt` and `supabaseAttemptStore` in `src/lib/attempts/`; challenge registry in `src/challenges/registry.ts`; real-database e2e in `tests/e2e/attempts.spec.ts` (including a simultaneous-start race).
- Review rounds: spec 1, quality 1, tests 1.
- Notes: only the test-reviewer should run e2e during review; `test:e2e:local` always starts its own server on port 3000, so parallel runs fail with EADDRINUSE. Abandoned attempts cannot be restarted (NEEDS_HUMAN confirm).

### 2026-11-09 — T11 Game days, attempts schema and game date (PR #18)
- `gameDateAt`/`deadlineFor` (`src/lib/gameDay.ts`, deadline in `src/config/schedule.ts`); migration with `game_days`, `attempts` (unique per user and date, references `profiles`), `game_date_at`, `deadline_utc_hour` and `ensure_game_day` (service role only); pgTAP in `supabase/tests/game_days.test.sql`.
- Review rounds: spec 2, quality 2, tests 2 (round 1: Supabase grants EXECUTE to anon and authenticated directly, so `revoke ... from public` was not enough; the SQL fixture only ran under UTC).
- Notes: revoke function EXECUTE from `public, anon, authenticated` by name and test with `function_privs_are`. The shared fixture `src/lib/gameDay.fixture.json` is embedded in the pgTAP file and a Vitest test keeps them equal. Placeholder pass target 10 awaits confirmation. Auto-merge stalled on PRs #17 and #18 after CI passed; toggling `--disable-auto` then `--auto` merged them.

### 2026-11-09 — T59 One-command local e2e runs (PR #17)
- `npm run test:e2e:local` (`scripts/e2e-local.mts`) reads local Supabase keys from `supabase status` and runs Playwright with them; refuses non-localhost URLs and never reuses an existing server (`E2E_FRESH_SERVER`). Also fixed the `SignUpForm.test.tsx` race.
- Review rounds: spec 2, quality 2, tests 2 (round 1: a stopped Supabase showed a stack trace instead of the clear message).
- Notes: use `npm run test:e2e:local` for local e2e (agents and reviewers too); it needs nothing on port 3000. Maintainer check after T10 ran: added T60 to T63 and notes on T51 and T58. The human runs sessions unattended, so commands must match the `.claude/settings.json` allowlist (no `cd`, pipes, loops, `sed -i` or inline `node -e`).

### 2026-11-09 — T10 Stacking renderer and practice page (PR #16)
- `drawStacking` in `src/challenges/stacking/render.ts`; `StackingGame` in `src/components/stacking/` (rAF loop, taps as elapsed ms) with the pure `frameAt` helper; signed-out `/practice/stacking`; player-facing name "Tower" in `src/config/challenges.ts`.
- Review rounds: spec 2, quality 2, tests 2 (round 1: one input could record two equal taps, which the server would reject; canvas DPR sizing was untested).
- Notes: taps are strictly increasing, capped at `MAX_TAPS`, and ignore second fingers and late taps. Space is captured page-wide during a run. T14 should import `StackingGame` from `src/components/stacking/` and reconcile the home "Practice the tower" link. `SignUpForm.test.tsx` "shows each field error…" is flaky under full parallel runs (needed one CI re-run).

### 2026-11-08 — T09 Stacking engine (PR #15)
- `simulate`/`blockLeftAt`/`paramsFromSeed` and the `stacking` module in `src/challenges/stacking/engine.ts`; golden fixture `engine.golden.json`; `player.ts` is a test-only simulated player used by `tuning.test.ts`.
- Review rounds: spec 2, quality 2, tests 2 (round 1: missing golden tests; also retuned speeds so good runs last about a minute).
- Notes: `simulate` reports "time" only when a tap comes after the limit, so the game loop must end the run at 60 s itself. An overlap under 0.0005 units is a miss. Speed ranges and the whole-number score await confirmation at the M1 play-test (NEEDS_HUMAN).

### 2026-11-08 — T08 Shared seeded PRNG and engine types (PR #14)
- `createRng(seed)` (mulberry32, golden fixture in `prng.golden.json`), `ChallengeModule` interface, ESLint purity rules for `src/challenges/**` (except `render.ts`) with tests that lint sample code through the real config.
- Review rounds: spec 1, quality 1, tests 1.
- Notes: the purity rules also apply to test files under `src/challenges`.

### 2026-11-08 — T07 Google sign-in and profile completion (PR #13)
- "Continue with Google" (browser `signInWithOAuth`), `GET /auth/callback`, `/complete-profile`; `landingPath()` in `src/lib/profiles.ts` sends players without a profile to `/complete-profile` after any sign-in. `GENERIC_ERROR` now lives in `src/lib/forms.ts`.
- Review rounds: spec 1, quality 1, tests 1.
- Notes for T15: the Supabase CLI reads `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` from the shell when it starts, not from `.env.local` (unset values stay as the literal `env(...)` text, so it still starts). `skip_nonce_check = true` is local-only; check the production provider settings by hand. Players without a profile are only redirected at sign-in; T12/T14 must enforce it for scored play.

### 2026-11-08 — T06 Sign-in, sign-out and account header (PR #12)
- Email/password sign-in with one message for wrong email or password; `AccountHeader` on every page; `src/proxy.ts` refreshes the session via `updateSession`.
- Review rounds: spec 2, quality 2, tests 2 (round 1: proxy dropped @supabase/ssr no-cache headers; proxy lacked tests).
- Notes: e2e session helpers in `tests/e2e/support/session.ts` (`readSession`, `writeSession`). Next.js renders an empty `role="alert"` route announcer, so filter alert locators by text.

### 2026-11-07 — Maintenance T53, T57, T54, T55, T56 (PRs #7–#11)
- T53: `checkEligibility` owns the 120-year limit; `validateEligibilityFields` (tagged `invalid | refused | ok`) is the shared birth date, country and rules validation; `src/lib/forms.ts` has `textValue` and `collectFieldErrors`.
- T57: `eligibilitySummary()` is the single source of "US residents aged 18 or over".
- T54: component tests with Testing Library; put `// @vitest-environment jsdom` at the top of each component test file.
- T55: shared Material 3 form components in `src/components/form/` (Field, TextInput, BirthDateInput, CountrySelect, RulesAgreement, FormAlert, SubmitButton).
- T56: e2e helpers in `tests/e2e/support/`; import `test`/`expect` from `./support/fixtures` and use `accounts.uniqueEmail()` so accounts are cleaned up even on failure.
- All approved in one review round each. Notes: don't run e2e and `verify` at the same time in one working copy (the Next build and the port collide); ask only one reviewer to run e2e.

### 2026-11-07 — Maintainer check after 5 merged tasks
- Health good. Added T53–T57 (shared eligibility validation, component tests, shared form components, shared e2e helpers, single eligibility wording). T06 now depends on T55 and T56, and T07 on T53, so sign-in and profile completion reuse the code instead of copying it. React patch update folded into T51.

### 2026-11-07 — T05 Email and password sign-up with eligibility check (PR #6)
- `/signup` with zod validation, eligibility before account creation (age check on the Hawaii date), profile via service role with rollback, sign-in and redirect.
- Review rounds: spec 2, quality 2, tests 2 (round 1 blocked: nothing tested that the action used the Hawaii date; fixed with a fixed-clock test).
- Notes: about 1,000 lines, over the guideline; split UI-heavy tasks in the backlog first from now on. A select only reads `defaultValue` on mount; remount it with a `key` to refill after a failed submit. Next.js renders an empty `role="alert"` route announcer, so filter alert locators by text. New T52 (sign-up abuse protection) needs Turnstile keys from the human before launch.

### 2026-11-07 — T04 Profiles table with row-level security (PR #5)
- `public.profiles` with RLS: players read only their own row; all writes go through the service role.
- Review rounds: spec 2, quality 2, tests 2 (round 1 blocked: column types, not-null, defaults and cascade were unchecked; fixed).
- Notes: Extra constraints: `country ~ '^[A-Z]{2}$'`, `weight >= 0`. Table-level write privileges are deliberately not revoked (the criterion wants updates to affect 0 rows, not error). pgTAP tests act as users via `set_config('request.jwt.claims', ...)` plus `set local role`.

### 2026-11-07 — T03 Config module and eligibility rules (PR #4)
- `src/config/eligibility.ts` (18+, US) and pure `checkEligibility` with calendar-date math; page title test for `GAME_NAME`.
- Review rounds: spec 1, quality 1, tests 1 (all approved).
- Notes: T05 must compute "today" in a US time zone, not UTC (added to T05 notes). Coverage threshold for `src/lib/eligibility.ts` raised to 90%. Self-declared location awaits human confirmation.

### 2026-11-07 — T02 Local Supabase, clients and database tests (PR #3)
- Local Supabase with pgTAP tests (`npm run test:db`), browser/server/admin clients, public `GET /api/health`, CI starts Supabase and exports its keys.
- Review rounds: spec 2, quality 2, tests 2 (round 1 blocked: a status-update script set every backlog task to in-progress; fixed).
- Notes: The agent cannot read or write `.env*` files (permission deny rule also blocks `.env.example` via the Write tool; create it with a shell write). To run e2e locally without `.env.local`, export keys: `set -a; eval "$(npx supabase status -o env --override-name api.url=NEXT_PUBLIC_SUPABASE_URL --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=')"; set +a`. Reviewers running `test:db` at the same time can collide on the shared local stack. When updating backlog statuses, edit by line, not with a stateful script.

### 2026-11-07 — T01 Scaffold the app (PR #2)
- Next.js 16 + strict TS, Vitest with coverage thresholds, Playwright, Material 3 tokens generated from a brand seed, UI-guidelines guard test.
- Review rounds: spec 1, quality 1, tests 1 (all approved; non-blocking suggestions applied, rest in T51).
- Notes: `typecheck` runs `next typegen` first (needed for `LayoutProps`). `@material/material-color-utilities` pinned to 0.3.0 (0.4.0 has a broken ESM import). Config constants live in `src/config/`. After changing `BRAND_SEED_HEX`, run `npm run tokens`. Next 16 ships its docs in `node_modules/next/dist/docs/`; check them before using Next APIs.

### 2026-11-07 — Backlog approved, UI guidelines added (PR #1)
- 50-task backlog in 4 milestones approved by the human; `docs/UI_GUIDELINES.md` approved.
