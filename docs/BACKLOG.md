# Backlog

Status: Approved (2026-11-07)

Planning notes for the builder:

- Requirements come from `docs/DESIGN.md` (Decided items) plus the human owner's answers given at planning time (Nov 7, 2026):
  1. Four milestones.
  2. **Prize is a flat $200 per cycle.** If a cycle ends without a 30-day streak, the prize rolls over ($400 after one rollover, $600 after two, and so on). The "formula, floor and cap" wording and the "revenue share" and "cap" fields in the data model are leftovers. Leave them out of the schema and the rules page.
  3. **Eligibility:** US residents aged 18 and over, enforced at sign-up. The minimum age and the allowed region are config settings.
  4. **Open items use the design doc's suggested defaults.** Record each one in `docs/DECISIONS.md` and add a "please confirm" entry to `docs/NEEDS_HUMAN.md` when you implement the task that depends on it. The defaults: deadline at midnight UTC; live meter hidden for the final 3 hours (configurable); survival threshold 60%; pass target set so that 80% of recent players reach it, editable by an admin; new accounts count fully from day one through a configurable weight (default 1.0); the working name "World Streak" lives in one config constant; a pass target that rises with the streak is a configurable setting with a flat placeholder (step 0).
- Tasks marked "Judgment call" in their notes resolve ambiguities in the design doc. Record those in `docs/DECISIONS.md` too.
- Database logic that runs inside Postgres (row-level security, the close job, counters) is tested with pgTAP through `npm run test:db`. TypeScript logic is tested with Vitest.
- **Every task that touches the user interface must follow `docs/UI_GUIDELINES.md`** (version 2, approved Nov 9, 2026): the Fresh Sport look (deep teal, mint and tangerine, Unbounded and Manrope, purposeful motion, back buttons, spinners), built with plain CSS Modules and CSS-variable design tokens. No Tailwind, shadcn or MUI, no emojis outside the share text, and no em dashes in UI text. Spec reviewers check UI changes against it. (Version 1 was strict Material 3; tasks written before Nov 9 that say "Material 3" now mean the version 2 look.)
- **Challenge names** (human, Nov 9, 2026): stacking is **Teetering Tower**, Inner Clock is **Second Sense**, Flash Count is **Swift Sum**. Internal type ids stay `stacking`, `inner-clock` and `flash-count`.
- Scripts that write data (`seed:dev`, `close-day`, `simulate:days`) must refuse to run unless the Supabase URL points at localhost.

## M1 Foundation and first challenge end to end

Goal: run the app locally against local Supabase, sign up with email and password (adults in the US only), practise the stacking challenge without an account, then play today's scored stacking attempt once. The server replays the attempt and shows pass or fail, and a second attempt the same day is refused.

### T01 Scaffold the app
- Type: infra
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] Next.js (App Router) + TypeScript with `"strict": true` in `tsconfig.json`, using the `src/` layout from `CLAUDE.md` (`src/app`, `src/challenges/shared`, `src/lib`, `src/components`, `tests/e2e`).
  - [ ] `package.json` has the scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e` and `verify`, exactly as described in `CLAUDE.md`. `lint` runs ESLint with `--max-warnings 0`. `verify` runs `lint && typecheck && test && build`.
  - [ ] Vitest runs with v8 coverage, and `vitest.config.ts` enforces thresholds: at least 70% lines and branches overall, and at least 90% lines and branches for `src/challenges/**`, `src/lib/scoring/**` and `src/lib/streak/**`. A deliberately untested function added to `src/challenges/shared` makes `npm run test` fail (check this by hand, then remove the function).
  - [ ] At least one passing unit test exists (for example a trivial util in `src/lib`).
  - [ ] Styling uses plain CSS Modules plus one global token stylesheet (for example `src/app/tokens.css`). It defines as CSS variables the Material 3 color roles for light and dark (following `prefers-color-scheme`), the shape scale, the type scale and spacing, generated from the placeholder brand seed color in `docs/UI_GUIDELINES.md`. No Tailwind, shadcn or MUI. The create-next-app starter styles are deleted.
  - [ ] A Vitest guard test (for example `tests/guidelines.test.ts`) scans `src/`. It fails if any file contains an emoji, except under `src/lib/share/`, or if a `.ts`, `.tsx` or `.css` file contains an em dash (U+2014). A deliberately added emoji makes the test fail (check this by hand, then remove it).
  - [ ] Playwright is configured with a `webServer` that starts the app, a Chromium project, and one test in `tests/e2e/smoke.spec.ts` that loads `/` and sees the text "World Streak".
  - [ ] `npm run verify` and `npm run test:e2e` both pass locally.
  - [ ] `.gitignore` has the Next.js, coverage and Playwright entries merged into the existing file, and no existing entries are removed.
  - [ ] `README.md` "Running the app" section explains `npm install`, `npm run dev`, `npm run verify`, `npm run test:e2e` (including `npx playwright install chromium`).
  - [ ] The PR's `verify` and `e2e` CI checks are green.
- Notes: Follow the **scaffolding note** in `CLAUDE.md`: `create-next-app` will refuse to run in this non-empty repository. Scaffold into a temporary sibling directory, move the generated files in without overwriting any existing file (`README.md`, `CLAUDE.md`, `docs/`, `.claude/`, `.github/`), and merge `.gitignore` rather than replacing it. Do not modify `.github/workflows/ci.yml`. It already runs `verify` and `e2e` once `package.json` exists. Generated boilerplate (lockfile, default assets) does not count toward the 400-line guideline, but delete unused starter content.

### T02 Local Supabase, clients and database tests
- Type: infra
- Status: done
- Depends on: T01
- Acceptance criteria:
  - [ ] `supabase/` is initialised (`supabase init`). `supabase/config.toml` has email sign-up enabled with `enable_confirmations = false` and `site_url = "http://localhost:3000"`.
  - [ ] npm scripts `db:start` (`supabase start`), `db:reset` (`supabase db reset`) and `test:db` (`supabase test db`) exist. A first pgTAP test in `supabase/tests/` passes via `npm run test:db`.
  - [ ] `src/lib/supabase/` provides a browser client, a server client (cookie-based, `@supabase/ssr`) and a service-role admin client that can only be imported from server code (`import "server-only"`).
  - [ ] `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` with local-default placeholder values and a comment on each.
  - [ ] `GET /api/health` returns `200 {"db":"ok"}` when local Supabase is running, and `503 {"db":"unavailable"}` when the query fails (unit-tested with a mocked client).
  - [ ] An e2e test calls `/api/health` and expects `db: "ok"`.
  - [ ] `.github/workflows/ci.yml` gains (additions only) steps in the `e2e` job that install the Supabase CLI, run `supabase start`, export the local keys to the environment, and run `npm run test:db` before `npm run test:e2e`. No existing step is removed or changed.
  - [ ] README "Running the app" documents Docker, `npm run db:start`, copying `.env.example` to `.env.local` and filling it in from `supabase status`, and `npm run test:db`.
- Notes: Reviewers must explicitly check the workflow diff (additions only). Never read `.env.local`.

### T03 Config module and eligibility rules
- Type: feature
- Status: done
- Depends on: T01
- Acceptance criteria:
  - [ ] `src/config/game.ts` exports `GAME_NAME = "World Streak"`, and every place that shows the name (layout title, home heading) imports it. Changing the constant changes the page title. Check this with a unit test of the metadata export.
  - [ ] `src/config/eligibility.ts` exports `MIN_AGE = 18` and `ALLOWED_COUNTRIES = ["US"]`.
  - [ ] `src/lib/eligibility.ts` exports `checkEligibility({ birthDate, country }, today)`, which returns `{ eligible: true }` or `{ eligible: false, reason: "underage" | "region" | "invalid-date" }`.
  - [ ] Boundary tests: with `today = 2026-11-07`, a birth date of `2008-11-07` is eligible (18th birthday today), `2008-11-08` is `underage`, and `2030-01-01` is `invalid-date`. A Feb 29, 2008 birth date is eligible on 2026-03-01 and `underage` on 2026-02-28. Country `"CA"` is `region`. Lower-case `"us"` is eligible.
  - [ ] Changing `MIN_AGE` to 21 in a test (via an injectable parameter) makes `2005-11-08` `underage` on 2026-11-07.
- Notes: Depends on the **Open** "Final game name" item. Use the working name "World Streak" (human's instruction) and record it in DECISIONS.md. Eligibility is self-declared: date of birth plus country of residence. Judgment call: no IP geolocation check in the MVP. Record it.

### T04 Profiles table with row-level security
- Type: feature
- Status: done
- Depends on: T02
- Acceptance criteria:
  - [ ] A migration creates `public.profiles` with columns `id uuid primary key references auth.users on delete cascade`, `birth_date date not null`, `country text not null`, `is_admin boolean not null default false`, `weight numeric not null default 1`, `flagged boolean not null default false` and `created_at timestamptz not null default now()`.
  - [ ] Row-level security is enabled. The only policy lets an authenticated user `select` their own row. No insert, update or delete policies exist for `anon` or `authenticated`, so profile writes happen only through server code using the service role.
  - [ ] pgTAP tests: RLS is enabled on `profiles`; user A cannot select user B's profile; user A's `update profiles set is_admin = true where id = A` affects 0 rows; `anon` selects 0 rows.
- Notes: The data model's "auth provider" lives in `auth.users` already; do not duplicate it. `weight` defaults to 1. See T46 for weighting.

### T05 Email and password sign-up with eligibility check
- Type: feature
- Status: done
- Depends on: T03, T04
- Acceptance criteria:
  - [ ] `/signup` shows email, password (minimum 8 characters), date of birth, a country of residence select, and an "I agree to the official rules" checkbox (link to `/rules`; the page can be a stub until T38).
  - [ ] Submission runs a server action that validates the input with zod and calls `checkEligibility` **before** creating any auth user. An underage or non-US submission shows "Sorry, World Streak is open only to US residents aged 18 or over." (name from `GAME_NAME`, age and region from config) and creates no row in `auth.users`.
  - [ ] An eligible submission creates the Supabase user (confirmation off) and a `profiles` row with the given birth date and country, signs the user in, and redirects to `/`.
  - [ ] Unit tests cover the server action: invalid email, short password, underage, wrong region, and success (mocked Supabase).
  - [ ] e2e: sign up with a unique email and a 1990 birth date, which lands on `/` signed in; sign up with a birth date one day short of 18 years, which shows the refusal message.
- Notes: If creating the profile fails after the auth user was created, delete the auth user with the admin client so no account exists without a profile. Test this path. **Time zone for `today` (from T03 review):** do not pass the UTC date to `checkEligibility`. For several hours each US evening, UTC is already tomorrow, so someone could pass the age check the evening before their 18th birthday. Use the earliest US calendar date (Pacific/Honolulu) and record the choice in DECISIONS.md. Also reject implausible birth dates (age over 120) in the form validation. Store `country` upper-cased (the profiles table enforces `^[A-Z]{2}$`, added in T04).

### T06 Sign-in, sign-out and account header
- Type: feature
- Status: done
- Depends on: T05, T55, T56
- Acceptance criteria:
  - [ ] `/signin` signs in with email and password. Wrong credentials show "Email or password is incorrect" without saying which one.
  - [ ] A header on every page shows "Sign in" when signed out, and the user's email plus a "Sign out" button when signed in. Sign-out clears the session and returns to `/`.
  - [ ] Next.js middleware refreshes the Supabase session cookie on each request (per `@supabase/ssr` guidance).
  - [ ] e2e: sign up, sign out, sign in again, see the email in the header; wrong password shows the error.

### T07 Google sign-in and profile completion
- Type: feature
- Status: done
- Depends on: T06, T53
- Acceptance criteria:
  - [ ] `/signin` and `/signup` show "Continue with Google", which calls `signInWithOAuth({ provider: "google", options: { redirectTo: <site>/auth/callback } })` (unit test with a mocked client).
  - [ ] `GET /auth/callback` exchanges the code for a session and redirects to `/complete-profile` when the user has no `profiles` row, otherwise to `/` (unit-tested for both branches and for a missing or invalid code, which redirects to `/signin?error=oauth`).
  - [ ] `/complete-profile` collects date of birth, country and rules agreement, applies `checkEligibility`, and creates the profile. An ineligible user sees the refusal message and gets no profile (they can still use practice).
  - [ ] `supabase/config.toml` enables the Google provider using `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)` and `env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)`. Both names are added to `.env.example` with placeholders, and local Supabase still starts when they hold placeholders.
  - [ ] e2e: a user created through email sign-up whose profile row is deleted is sent to `/complete-profile` after signing in, and can complete it. (Real Google login is checked by hand in T15.)
- Notes: The sign-in redirect for users without a profile can live in the middleware or the layout. Either way, a user without a profile must never reach a scored attempt (enforced again server-side in T12).

### T08 Shared seeded PRNG and engine types
- Type: feature
- Status: done
- Depends on: T01
- Acceptance criteria:
  - [ ] `src/challenges/shared/prng.ts` exports `createRng(seed: number)`, which returns `{ next(): number; int(min, max): number; pick<T>(items: T[]): T }` using one documented algorithm (for example mulberry32) on unsigned 32-bit seeds.
  - [ ] Tests: the same seed gives an identical sequence for 10,000 draws; `next()` is always in `[0, 1)`; `int(3, 7)` only returns 3 to 7 inclusive and returns each value at least once in 1,000 draws; seeds 1 and 2 give different first values; a committed golden fixture of the first 5 values for seeds 0, 42 and 4294967295 matches.
  - [ ] `src/challenges/shared/types.ts` defines `ChallengeType = "stacking"` (extended later), `ScoreDirection = "higher-better" | "lower-better"` and a `ChallengeModule<Params, Inputs>` interface with `paramsFromSeed(seed)`, `score(params, inputs)`, `inputsSchema` (zod) and `direction`.
  - [ ] An ESLint rule (`no-restricted-globals`/`no-restricted-properties`) bans `Math.random`, `Date.now`, `performance`, `window`, `document` and `fetch` inside `src/challenges/**`, except in `render.ts` files.
  - [ ] Coverage of `src/challenges/shared` is at least 90% lines and branches.

### T09 Stacking engine
- Type: feature
- Status: done
- Depends on: T08
- Acceptance criteria:
  - [ ] `src/challenges/stacking/engine.ts` exports `simulate(params, tapsMs: number[])`, which returns `{ score, blocks: { left, width, overhang }[], endedAtMs, endReason: "miss" | "time" | "inputs" }`, and `blockLeftAt(params, state, elapsedMs)`, which gives the moving block's position. Both are pure and driven only by elapsed ms.
  - [ ] Geometry (logical units): field width 400; base block `left 100, width 200`. Block *i* has the width of the block below it and slides between `0` and `400 - width`, bouncing at the edges. Block 1 starts at the side given by `params.direction`, and each later block starts at the opposite side to the previous one. Block *i* starts moving at the time of tap *i-1* (block 1 at 0 ms). Its speed is `startSpeed + ramp × (i - 1)` px/ms. The overhang is trimmed, so the next width equals the overlap. An overlap of 0 or less is a miss and ends the run. Score = blocks successfully placed.
  - [ ] With `{ startSpeed: 0.2, ramp: 0, direction: "right" }`:
    - taps `[500]`: score 1, block 1 left 100, overhang 0;
    - taps `[750]`: block 1 left 150, width 150, overhang 50;
    - taps `[1250]` gives the same placement as `[750]` (bounce at 1000 ms);
    - taps `[750, 1250]`: score 2, block 2 starts at left 250 moving left and lands at left 150 with overhang 0;
    - taps `[750, 2000]`: block 2 at left 0 is a miss, score 1, `endReason "miss"`, `endedAtMs 2000`.
  - [ ] With `{ startSpeed: 0.2, ramp: 0.05, direction: "right" }`, taps `[500, 900]` give score 2 with block 2 overhang 0.
  - [ ] With `direction: "left"`, taps `[250]` put block 1 at left 150 with overhang 50.
  - [ ] Taps after a miss or after `params.maxDurationMs` are ignored. Non-increasing or negative tap arrays are rejected by `inputsSchema`, which allows at most 200 taps.
  - [ ] `paramsFromSeed(seed)` is deterministic. Over seeds 0 to 999, `startSpeed`, `ramp` and `direction` all stay inside the documented ranges, and both directions occur.
  - [ ] Property tests: the same `(seed, taps)` always gives the same result; a score never exceeds the number of taps; widths never increase.
  - [ ] Golden tests: three fixed seeds with fixed tap arrays have committed exact scores. `direction = "higher-better"`. At least 90% lines and branches covered.
- Notes: Pick start speed and ramp ranges so a competent player's run ends near one minute (design: "speed rises with height to cap runs near one minute"); `maxDurationMs` = 60,000 is a hard cap. Use an original name and art, not those of existing stacking games. Name the challenge in the UI something like "Tower" or similar original wording (judgment call, record it). The score is an integer block count, as the Decided challenge table says, although the design also asks for a "continuous scale". This is flagged as ambiguous.

### T10 Stacking renderer and practice page
- Type: feature
- Status: done
- Depends on: T09
- Acceptance criteria:
  - [ ] `src/challenges/stacking/render.ts` draws a given engine state for a given elapsed ms onto a canvas 2D context, scaling the 400-unit field to the canvas width and handling `devicePixelRatio`.
  - [ ] `src/components/StackingGame.tsx` runs a `requestAnimationFrame` loop that reads elapsed time from `performance.now()` relative to the start, records taps (pointerdown and Space) as elapsed ms, calls the engine for state, and calls `onFinish({ taps, result })` when the engine reports the end.
  - [ ] Frame-rate independence: a unit test drives the component's loop helper with simulated frames at 16.7 ms and at 8.3 ms intervals and the same tap times, and gets identical engine results.
  - [ ] `/practice/stacking` works signed out, uses a fresh random seed per run (client-side randomness is fine because practice never counts), shows the block count live and on finish, and has a "Play again" button. No network request is made to `/api/attempts/*`.
  - [ ] e2e: open `/practice/stacking`, press Start, tap 3 times at 400 ms intervals, and the run ends with a visible score of 0 or more and a "Play again" button.

### T11 Game days, attempts schema and game date
- Type: feature
- Status: done
- Depends on: T04
- Acceptance criteria:
  - [ ] `src/config/schedule.ts` exports `DEADLINE_UTC_HOUR = 0`. `src/lib/gameDay.ts` exports `gameDateAt(now: Date)`, which returns the `YYYY-MM-DD` game date (the date that closes at the next deadline), and `deadlineFor(gameDate)`. Tests: `2026-11-07T23:59:59.999Z`, game date `2026-11-07`; `2026-11-08T00:00:00.000Z`, `2026-11-08`; with an hour of 5 injected, `2026-11-08T04:59:59Z`, `2026-11-07`.
  - [ ] A migration creates `game_days` (`game_date date primary key`, `challenge_type text not null`, `pass_target numeric not null`, `survival_threshold numeric not null check (between 0 and 1)`, `final_pass_rate numeric`, `outcome text check (outcome in ('survived','broken'))`, `closed_at timestamptz`) and `attempts` (`id uuid pk`, `user_id`, `game_date references game_days`, `seed bigint not null`, `inputs jsonb`, `score numeric`, `passed boolean`, `started_at timestamptz not null default now()`, `submitted_at timestamptz`, **`unique (user_id, game_date)`**).
  - [ ] A SQL function `game_date_at(ts timestamptz)` mirrors `gameDateAt` with the same deadline hour. A shared fixture of boundary timestamps is checked by both a Vitest test and a pgTAP test.
  - [ ] `ensure_game_day(d date)` inserts a stacking day with the default pass target and a survival threshold of 0.60 if it is missing, and is a no-op otherwise.
  - [ ] RLS: `game_days` is readable by everyone and has no write policies. A user can `select` only their own `attempts`, and there are no insert, update or delete policies for `anon`/`authenticated`.
  - [ ] pgTAP: a second attempt row for the same user and date fails with a unique violation; user A cannot read user B's attempts; `ensure_game_day` run twice leaves one row.
- Notes: Depends on **Open** "Exact global deadline time". Use the suggested midnight UTC, record it and flag it. The deadline hour is duplicated in TS and SQL on purpose (the close job runs in the database). The shared fixture keeps the two in sync. The defaults (threshold 0.60, stacking pass target placeholder, for example 10 blocks) move into `game_settings` in T16. Depends on **Open** "Survival threshold and pass-target percentile for launch": use 60%.

### T12 Attempt start endpoint
- Type: feature
- Status: done
- Depends on: T07, T09, T11
- Acceptance criteria:
  - [ ] `POST /api/attempts/start` returns 401 when signed out, and 403 `{ error: "profile-required" }` when the user has no profile.
  - [ ] For an eligible user, it calls `ensure_game_day(today)`, inserts an attempt with a server-generated random unsigned 32-bit seed (`crypto`), and returns `200 { attemptId, gameDate, challengeType, seed, params }`, where `params = paramsFromSeed(seed)` from the challenge registry (`src/challenges/registry.ts`).
  - [ ] If the user already has an attempt for today, it returns 409 `{ error: "already-started", submitted: boolean }` and inserts nothing. A race between two simultaneous requests yields exactly one row (the unique constraint handles it, and the handler maps the violation to 409).
  - [ ] Unit tests with a mocked Supabase client cover 401, 403, 200 and 409 (pre-existing and race).
- Notes: Judgment call (record it): "abandoning before finishing records nothing", so an abandoned attempt never counts toward the pass rate, but it cannot be restarted. Restarting would replay the same seed and reveal the instance (for example the Flash Count dot count). Show this rule on the play page before the Start button.

### T13 Attempt submit endpoint with server replay
- Type: feature
- Status: done
- Depends on: T12
- Acceptance criteria:
  - [ ] `POST /api/attempts/submit` with `{ attemptId, inputs }` returns 401 when signed out, 400 when the body or `inputs` fail the challenge's `inputsSchema`, and 404 when the attempt is not the caller's.
  - [ ] It returns 409 `already-submitted` if `submitted_at` is set, and 409 `day-closed` if the attempt's game date is no longer the current game date or the day has `closed_at`.
  - [ ] It returns 422 `implausible-timing` if the last input timestamp exceeds `(now - started_at) + 2000 ms` or the attempt is older than `ATTEMPT_MAX_AGE_MS` (config, default 180,000). (The age limit was removed in T87: runs have no time limit.)
  - [ ] Otherwise the server replays the engine (`score(paramsFromSeed(seed), inputs)`) and computes `passed` from the day's `pass_target` and the module's `direction` (higher-better: `score >= target`; lower-better: `score <= target`). It stores inputs, score, passed and `submitted_at` atomically through a `security definer` SQL function `record_attempt_result` that only `service_role` may execute. It returns `{ score, passed, passTarget }`.
  - [ ] Any `score` or `passed` field in the request body is ignored (test: a body claiming `passed: true` with inputs that score 0 is stored as failed).
  - [ ] Unit tests cover every status code. A pgTAP test shows that `authenticated` cannot execute `record_attempt_result`.
- Notes: Judgment call (record it): submissions after the deadline are refused and record nothing, even if the attempt started before it. Supabase grants EXECUTE on new functions to `anon` and `authenticated` directly, so `revoke ... from public` alone leaves them callable: revoke from `public, anon, authenticated` by name, as T11 does for `ensure_game_day`, and test it with `function_privs_are` for both roles.

### T14 Daily play page end to end
- Type: feature
- Status: done
- Depends on: T10, T13
- Acceptance criteria:
  - [ ] `/` shows the game name, the one-sentence pitch ("Play today's challenge; if enough of the world passes, humanity's streak survives."), a "Play today's challenge" link to `/play` and a "Practice" link.
  - [ ] `/play` signed out shows "Sign in to play today's scored attempt" with links to sign in and practice. With no profile, it redirects to `/complete-profile`.
  - [ ] Signed in and not yet played: it explains the one-attempt rule, and Start calls the start endpoint, plays `StackingGame` with the issued seed, submits on finish, and shows "Passed" or "Not this time" with the score and today's target.
  - [ ] Already submitted today: `/play` shows today's result instead of the Start button. Started but abandoned: it shows "You left today's attempt before finishing. It was not counted. Come back tomorrow."
  - [ ] e2e (local Supabase): sign up, open `/play`, start, tap a few times, finish, and see a result; reload and see the same result with no Start button; a direct `POST /api/attempts/start` returns 409.
- Notes: The e2e test can make the run end quickly with a deliberate miss (taps timed to the engine's known geometry are not possible with a random seed, so just assert that a result appears).

### T15 Confirm Google sign-in with real credentials
- Type: infra
- Status: done
- Depends on: T07
- Acceptance criteria:
  - [ ] With the human's Google OAuth credentials set in the shell that runs `npm run db:start` (the Supabase CLI reads `env(...)` values from the shell, not from `.env.local`), then `npm run dev`. "Continue with Google" completes a real Google login locally and lands on `/complete-profile` for a new account.
  - [ ] README "Running the app" documents the Google setup: the authorised redirect URI `http://127.0.0.1:54321/auth/v1/callback` for local Supabase, and where the two env values go.
- Notes: Code changes should be limited to documentation and any small fixes found during the manual check.
- Resolved (Nov 10, 2026): the human set up the OAuth client and confirmed a real Google login reached "Finish setting up your account" and then home, signed in.

## M1b Look, feel and Tower rework

Goal: after the M1 play-test (Nov 9, 2026), every existing screen has the Fresh Sport look from `docs/UI_GUIDELINES.md` v2, with back buttons, spinners and motion; sign-up keeps the password on failure and asks for it twice; and Teetering Tower is a column-grid stacker that a decent player tops out around row 10. Ends with a second human play-test before M2.

### T73 Fresh Sport design system and app shell
- Type: feature
- Status: done
- Depends on: T14
- Acceptance criteria:
  - [ ] `src/app/tokens.css` is rewritten to the v2 palette, gradients, soft shadows, radii, type scale, 8 px spacing and motion durations (fast about 150 ms, medium about 250 ms, slow about 400 ms, with a `prefers-reduced-motion` override). The Material seed-colour generator (`scripts/generate-tokens.mjs`, `npm run tokens`, `src/config/theme.ts`) is removed if nothing else needs it, with its test.
  - [ ] Unbounded (600, 800) and Manrope load through `next/font`; the body background is the teal ground gradient.
  - [ ] Shared components in `src/components/ui/`: `Button` (primary tangerine gradient pill, secondary translucent, `loading` state with a spinner that keeps the button's width and sets `aria-busy`), `LinkButton` (same looks for links), `BackButton` (round, 44 px or more, labelled "Back"), `Spinner` (with `role="status"` text for screen readers), `Surface` (the translucent card) and `PageShell` (max width, padding, optional back button and title). Each has component tests, including reduced motion where it animates.
  - [ ] The account header is restyled (wordmark "world" plus mint "streak", the account initial or sign-in link).
  - [ ] Text contrast of every token pair used for text is checked by a unit test (at least 4.5:1, or 3:1 for display sizes).
  - [ ] The smoke e2e test checks a v2 token instead of the Material primary colour; `npm run verify` and `npm run test:e2e` pass.
  - [ ] (Added during the task, Nov 9, 2026) `npm run test:e2e:local` runs its own server on port 3100 with its own build folder (`.next-e2e`, via `E2E_PORT` and `E2E_DIST_DIR`), so e2e runs work while the human keeps `npm run dev` open on port 3000; CI is unchanged.
- Notes: Pages are restyled in T74 and T75; this task only builds the system and the shell. Supersedes T69's shared-button item. The e2e tooling item was needed to run this task's e2e tests during the human's play-testing (Next.js refuses a second dev server in one folder), so it ships here rather than as a separate task.

### T74 Restyle home, play and practice in Fresh Sport
- Type: feature
- Status: done
- Depends on: T73
- Acceptance criteria:
  - [ ] Home, `/play` (every state: ready, starting, playing, checking, result, abandoned, refused) and `/practice/stacking` use the shared components and match the mockup's direction: big Unbounded headings and numbers, translucent surfaces, tangerine primary action, mint for good news.
  - [ ] Every screen below home has a `BackButton` (except during a running game); every button that waits shows its loading spinner.
  - [ ] The result screens animate in (verdict scales and fades in, mint falling-block confetti on a pass), with instant versions under reduced motion; a component test checks the reduced-motion branch.
  - [ ] The abandoned message says the attempt counted as not passed (human decision: leaving early is a loss).
  - [ ] The page, play and practice CSS modules use only `--fs-*` tokens (no `--md-*`), so T75 can delete the legacy alias block in `tokens.css`.
  - [ ] e2e, in a real browser: a primary `Button` reached with Tab shows the mint focus ring (its computed `box-shadow` includes the ring), and a loading `Button` keeps its accessible name and focus; the back button is at least 44 by 44 px; the game canvas's colour tokens resolve to non-empty values (jsdom cannot check these; from the T73 reviews).
  - [ ] Existing unit and e2e tests pass with updated selectors only where wording changed on purpose; `npm run verify` and `npm run test:e2e` pass.
- Notes: Until M2 there is no real streak or meter data, so the home page shows today's challenge prominently and leaves room for them; no invented numbers.

### T75 Sign-in, sign-up and profile screens: Fresh Sport and fixes
- Type: feature
- Status: done
- Depends on: T73
- Acceptance criteria:
  - [ ] `/signup` keeps the typed password (and confirmation) after a failed submit; it is held in client state and never sent back by the server.
  - [ ] `/signup` has a "Confirm password" field; a mismatch shows a field error before submitting and is also rejected by the server action, with unit tests for both.
  - [ ] `/signin`, `/signup`, `/complete-profile` and `/rules` use the v2 components (fields, primary button with spinner while submitting, back button), with clear inline errors and smooth focus states.
  - [ ] Existing form tests pass with the new field added; e2e sign-up helpers fill the confirmation; `npm run verify` and `npm run test:e2e` pass.
  - [ ] No CSS module uses `--md-*` any more, and the legacy alias block in `src/app/tokens.css` is deleted (a test fails if `--md-` appears in `src/`).
- Notes: From the M1 play-test. The form field components from T55 are restyled, not replaced.

### T76 Teetering Tower grid engine
- Type: feature
- Status: done
- Depends on: T08
- Acceptance criteria:
  - [ ] `src/challenges/stacking/engine.ts` is replaced by a column-grid stacker: a board 7 columns wide and 15 rows tall; each row's block is a run of cells that moves one column at a time, bouncing between the walls; a tap locks it; cells not resting on a cell of the row below fall off, so the next row starts at the surviving width; when no cells survive the run ends (a miss).
  - [ ] The run starts 3 cells wide, and the width is also forced down at set heights like the arcade original (a config table, for example at most 2 cells from row 6 and 1 cell from row 11). Reaching the top row (15) is the winning score and ends the run. There is no time limit; the run ends only on a miss or the win.
  - [ ] Movement is driven by elapsed ms: each row's step interval shortens with height (ranges in `PARAM_RANGES`, picked per seed); `paramsFromSeed` also picks the starting column and direction. The score is the number of rows locked (0 to 15).
  - [ ] Inputs stay `{ tapsMs }` (strictly increasing, at most 15 taps that count); `lastInputMs` and `inputsSchema` keep their contracts so T12, T13 and T14 work unchanged.
  - [ ] To bound attempt length without a time limit, a row not tapped within an idle limit (config, default 8 s) drops off and ends the run like a miss (judgment call: record it and flag it). (Changed during the task from "locks where it is", which let a player score rows without tapping.)
  - [ ] (In scope so the game keeps working) the frame loop, the canvas renderer (a plain 7 x 15 grid of cells) and the game component follow the new engine; T77 adds the polish.
  - [ ] Golden fixtures (exact scores for 3 seeds and fixed taps), determinism and purity tests, and a simulated-player tuning test: a "decent" player (timing error spread you choose and document) reaches about row 10 on average over 200 seeds, a careless one about 4, and a perfect one 15. At least 90% coverage.
- Notes: Human requirements from the M1 play-test (Nov 9, 2026): very similar to the arcade stacker, set columns, overhang cells are lost, forced narrowing, end only on a miss, cap at a winning score (a leaderboard may come later), a decent player gets 10. Original name and art only. The old continuous engine's DECISIONS entries (speed ranges) are superseded; record the new ones. Attempts already stored keep their old inputs; nothing replays them.

### T77 Teetering Tower renderer and HUD in the new look
- Type: feature
- Status: done
- Depends on: T74, T76
- Acceptance criteria:
  - [ ] The canvas renderer draws the grid as in the mockup: translucent empty cells, mint placed cells, a tangerine moving block, a target line above the pass row (when a target is given), cells that fall off animating away, and a short landing bounce (reduced motion: no bounce or fall animation). Animations are pure functions of the engine's lock times and the frame's elapsed ms, with unit tests.
  - [ ] The game loop steps the block by the engine's elapsed-ms schedule, so frame rate does not change results (a 60 vs 120 fps test as in T10).
  - [ ] The HUD shows the current row and, on `/play`, "Row N to pass" with today's target from the server; practice shows the best row of this visit.
  - [ ] `npm run verify` and `npm run test:e2e` pass.
- Notes: Split on Nov 9, 2026 (the whole was well over 400 lines); the page-level half is T81. The pass target placeholder (10) stays until real scores exist.

### T81 /play and practice around the Tower: how-to, big score, follow-ups
- Type: feature
- Status: done
- Depends on: T77
- Acceptance criteria:
  - [ ] `/play`'s ready state shows how to play (tap, click or Space) and a "Practice first" link, from one shared source with practice (absorbs T71; mark T71 done).
  - [ ] The result screens show the score as a big Unbounded number, as in the mockup.
  - [ ] Decide whether UI rule 8 covers the account header links during a run on `/play`: either hide them like the back button, or record why not in DECISIONS.
  - [ ] Tests: the refused-submission ("failed") state is in the "Back to home" unit test, and the home page's Teetering Tower card (heading, Play and Practice first links) is checked.
  - [ ] e2e: practice and play runs end on a deliberate miss with a paused clock, and the stored result matches what was shown; `npm run verify` and `npm run test:e2e` pass.
  - [ ] The last fall plays out: when a run ends, the game keeps drawing for `FALL_MS` (input already blocked, taps fixed) before calling `onFinish`, so a missed row is seen falling away; a component test covers the delay.
- Notes: Split from T77 (Nov 9, 2026); the follow-ups come from the T74 and T77 reviews. In `tests/e2e/play.spec.ts`, read the game date from the start response rather than the test's own clock (as `attempts.spec.ts` does). Last task of M1b: then the maintainer check and the second play-test.

### T87 No idle drop: a row waits for its tap
- Type: feature
- Status: done
- Depends on: T81
- Acceptance criteria:
  - [ ] The engine has no idle limit: a row moves until it is tapped, however long that takes. `IDLE_LOCK_MS` is gone; `simulate` with no further taps leaves the run "running" (also with `nowMs = Infinity`), and the golden fixtures and tuning test are updated (a deliberate change, recorded in the fixtures' history).
  - [ ] The server scores the rows locked by the submitted taps; a submission whose taps do not end the run (no miss and not the top row) is refused as `invalid-inputs`, since the game only submits finished runs.
  - [ ] The 3-minute submission age limit (`ATTEMPT_MAX_AGE_MS`) is removed; the day's deadline and the "last tap later than real elapsed time" check stay. Unit tests: a slow, valid run submitted after 10 minutes is accepted; taps claiming the future are still refused.
  - [ ] The simulated player and every e2e test that relied on runs ending by themselves end them with taps instead (deliberate misses via `tests/e2e/support/tower.ts`).
  - [ ] `npm run verify` and `npm run test:e2e` pass.
- Notes: The human's decision at the second play-test (Nov 10, 2026): "we don't want to time out slow players". A player who walks away never submits, which counts as an attempt that did not pass (T17). Replay cost stays bounded by `MAX_TAPS`.

## M2 The world streak

Goal: with a batch of fake local players, watch the live pass-rate meter move against the 60% threshold (and go dark in the final 3 hours), close a day by hand or wait for the scheduled job, see the world streak grow or break, browse the history list, and use the admin page to change a day's pass target and survival threshold.

### T16 Game settings table
- Type: feature
- Status: done
- Depends on: T11
- Acceptance criteria:
  - [ ] A migration creates a single-row `game_settings` table (a check constraint enforces a single row) with `default_survival_threshold 0.60`, `pass_target_percentile 0.80`, `pass_target_streak_step 0`, `threshold_streak_step 0`, `percentile_lookback_days 14`, `percentile_min_sample 50`, `default_pass_targets jsonb` (`{"stacking": 10}` placeholder), `new_account_weight 1.0` and `full_weight_after_days 0`.
  - [ ] `ensure_game_day` now reads its defaults from `game_settings` instead of literals.
  - [ ] RLS: everyone can `select`, and only users whose profile has `is_admin = true` can `update` (policy uses a `security definer` `is_admin()` helper). There are no insert or delete policies.
  - [ ] `src/lib/settings.ts` returns typed settings parsed with zod (unit-tested with valid and invalid rows).
  - [ ] pgTAP: a non-admin update affects 0 rows; an admin update succeeds; a second row insert fails.
- Notes: This task covers several **Open** items, all using the recommended defaults: survival threshold 60%; pass target set so 80% of recent players reach it; a rising pass target/threshold as a configurable step with a flat placeholder of 0; new accounts count fully from day one (weight 1.0 after 0 days). Record each in DECISIONS.md and flag it for confirmation.

### T17 Running counters per game day
- Type: feature
- Status: done
- Depends on: T13, T16
- Acceptance criteria:
  - [ ] A migration creates `game_day_counters` (`game_date pk references game_days`, `attempts int`, `passes int`, `weighted_attempts numeric`, `weighted_passes numeric`, `updated_at`).
  - [ ] `record_attempt_result` increments the counters in the same transaction, using the submitting user's `profiles.weight` (an upsert, safe under concurrent submits).
  - [ ] RLS: counters are readable by everyone, with no write policies. (Reversed in T18: the counters are server-only so the meter's hidden window holds; see DECISIONS, "Hide the meter for the final 3 hours".)
  - [ ] pgTAP: after recording 3 attempts (2 passed) for one date with weights 1, counters read `attempts 3, passes 2, weighted_attempts 3, weighted_passes 2`; a user with weight 0.5 who passes adds 0.5 to both weighted columns; an abandoned (started, never submitted) attempt counts as an attempt that did not pass.
  - [ ] An attempt is counted in `attempts`/`weighted_attempts` when it starts (in the start endpoint's insert, same transaction), and in `passes`/`weighted_passes` when a passing result is recorded, so abandoning cannot hide a fail.
- Notes: The design requires running counters rather than counting rows on request. Pass rate = `weighted_passes / weighted_attempts` among counted accounts. Human decision (Nov 9, 2026): leaving early is a loss, so started attempts count; this overrides the design doc's "abandoning records nothing" (see DECISIONS). The live meter briefly counts in-flight runs as not passed, which is acceptable. From the T74 spec review: `/play` still calls a refused submission "Not counted" ("…so it was not counted"); once started attempts count, reword it (for example "Counted as not passed").

### T18 Cached meter endpoint
- Type: feature
- Status: done
- Depends on: T17
- Acceptance criteria:
  - [ ] `src/config/meter.ts` exports `METER_HIDE_HOURS = 3` and `METER_CACHE_SECONDS = 30`.
  - [ ] `GET /api/meter` (no auth needed, read-only) returns `{ gameDate, status: "open", passRate, attempts, threshold, closesAt, streak }` (streak filled in after T21; use `null` until then), with `Cache-Control: public, s-maxage=30, stale-while-revalidate=30`.
  - [ ] From `deadline - METER_HIDE_HOURS` until the deadline, it returns `{ gameDate, status: "hidden", threshold, closesAt }` and **no** `passRate` or `attempts` fields. Tests with an injected clock: `20:59:59Z` is open and `21:00:00Z` is hidden.
  - [ ] With 0 attempts, `passRate` is `null` (not NaN).
  - [ ] It reads only `game_days` and `game_day_counters` (a single query) and never counts `attempts` rows (asserted by checking the mocked client's calls).
- Notes: Depends on **Open** "How to handle last-minute sniping". Use the recommended approach (hide the meter for the final hours) with 3 hours, configurable. Record it and flag it. Also depends on the deadline (midnight UTC).

### T19 Meter UI with visibility-aware polling
- Type: feature
- Status: done
- Depends on: T18
- Acceptance criteria:
  - [ ] `src/components/Meter.tsx` shows a bar for the pass rate with a marker at the threshold, a label like "72% passing · 60% needed · 1,234 attempts", and a countdown to the deadline.
  - [ ] In the hidden state, it shows "The meter is hidden for the final 3 hours. The result is revealed at the deadline." (the hours come from config), plus the countdown.
  - [ ] It polls `/api/meter` every 60 s only while `document.visibilityState === "visible"`. When the tab is hidden, it stops polling, and when it becomes visible, it fetches immediately and resumes (tested with fake timers and a mocked `visibilitychange`).
  - [ ] Shown on `/` and below the result on `/play`.
  - [ ] e2e: `/` shows the meter label or the hidden message.
- Notes: From the T18 spec review: the endpoint's cache (`s-maxage=30, stale-while-revalidate=30`) can serve a reading taken just before the hidden window for up to about 60 s after it starts. That only shows pre-window data, but the UI should switch to hidden by its own clock at `closesAt - METER_HIDE_HOURS`, not only when a reply says `hidden` (use T94's helper). From the maintainer check after T18: render the `threshold: null` state (before today's game day exists).

### T20 Local fake-player seeding script
- Type: infra
- Status: done
- Depends on: T17
- Acceptance criteria:
  - [ ] `npm run seed:dev -- --players 200 --pass-rate 0.7 [--date YYYY-MM-DD]` creates 200 fake users with profiles and submitted attempts for the date (default today), of which 140 passed, through `record_attempt_result`, so the counters update.
  - [ ] It refuses to run and exits non-zero if `NEXT_PUBLIC_SUPABASE_URL` does not point at `localhost`/`127.0.0.1` (unit-tested guard).
  - [ ] Running it twice for the same date adds a new batch without violating constraints (fresh users each run).
  - [ ] README documents the command for play-testing the meter.

### T21 Daily close: outcome and world streak
- Type: feature
- Status: done
- Depends on: T17
- Acceptance criteria:
  - [ ] A migration creates `streak_runs` (`id`, `start_date`, `end_date null`, `length int`) and SQL function `close_game_day(d date)`. It computes `final_pass_rate = weighted_passes / weighted_attempts`, sets `outcome = 'survived'` if that is `>= survival_threshold` and `'broken'` otherwise, sets `closed_at`, and updates the streak: survived extends the open run (or starts one with length 1), and broken ends the open run (sets `end_date`), so the current streak is 0.
  - [ ] It is keyed by date and idempotent: calling it twice for the same date leaves identical rows and does not double-count the streak.
  - [ ] pgTAP: 10 attempts with 6 passes at threshold 0.60 is survived (the boundary counts); 5 of 10 is broken; 3 consecutive survived days give current streak 3, and a broken fourth day gives 0 with best 3; an idempotent re-run changes nothing.
  - [ ] A day with 0 attempts closes as `broken` with `final_pass_rate null` (judgment call, record it and flag it).
  - [ ] SQL view or function `world_streak()` returns `{ current, best, current_start_date }`, readable by everyone. (`/api/meter` filling `streak` moved to T98, to keep this PR under about 400 lines.)
- Notes: Pass rate is weighted per the definition "among counted accounts" (weights from T17). The cycle-aware streak reset comes later (T34). From the T11 quality review: add a `game_days` check that `outcome` and `closed_at` are both set or both null, so a half-closed day cannot be stored (`final_pass_rate` is already checked to be between 0 and 1). From the T81 quality review: the game reports a finished run from its animation loop, which browsers pause in a hidden tab, so a run that ends while the tab is hidden is submitted only when the player returns. Near the deadline that can turn into "day closed"; if it matters, finish the run with a timer when `document.hidden` (the server scores the taps either way). From the T17 quality review: counter updates serialize on one row per day; fine for the MVP, note it as a scaling limit. From the T93 quality review: in `close_game_day`, lock (update, or `select ... for update`) the `game_days` row first, then read the counters; a start holds a share lock on the day row while it updates the counters, so the opposite order could deadlock or miss that start. (The other T17 follow-ups, refusing starts on a closed day and raising on a missing counter row, moved to T93.) From the T97 reviews: `isMeterBody` in `src/lib/meter.ts` accepts only `streak: null`, on purpose, so filling in `streak` fails its tests until the check follows (decide too whether hidden bodies carry it). Ship the server and the check together: the meter's 30 s CDN cache can briefly serve an old-shape body to a new bundle, or the reverse, which reads as "unavailable".

### T98 The meter carries the world streak
- Type: feature
- Status: done
- Depends on: T21
- Acceptance criteria:
  - [ ] `/api/meter` fills `streak` with `{ current, best }` from `world_streak()` in both open and hidden bodies (the streak is not secret in the final hours), read in the same request as the day; malformed numbers fail with a 500 via `dbInteger`.
  - [ ] `isMeterBody` checks the new `streak` shape (non-negative integers, `best >= current`); the "every body `meterBody` produces passes" test covers both statuses; `tests/e2e/meter.spec.ts` key list updated.
  - [ ] The meter shows nothing new yet (the streak display is T24), so no UI change; `npm run verify` and the meter e2e pass.
- Notes: Split from T21 (Nov 11). See T21's notes on shipping the server and the check together: the 30 s CDN cache can briefly serve the old shape to a new bundle.

### T22 Prepare next day: pass target and threshold
- Type: feature
- Status: done
- Depends on: T21
- Acceptance criteria:
  - [ ] `close_game_day(d)` also creates `game_days(d + 1)` if it is missing, with challenge type `stacking` (rotation comes in T31), `survival_threshold = default_survival_threshold + threshold_streak_step × current_streak` (clamped to at most 0.95), and a pass target computed as follows.
  - [ ] Pass target: when there are at least `percentile_min_sample` submitted attempts of the same challenge type in the last `percentile_lookback_days`, it is the score that a `pass_target_percentile` share of those players reached (higher-better: largest t with at least 80% of scores >= t; lower-better: smallest t with at least 80% of scores <= t). Otherwise it is `default_pass_targets[type]`. Then `pass_target_streak_step × current_streak` is applied in the harder direction.
  - [ ] pgTAP (min sample lowered to 10 in the test): stacking scores 1 to 10 give target 3 (exactly 8 of 10 reach it); with 9 scores, the default 10 is used; with step 0.5 and a streak of 4, the target is 3 + 2 = 5.
  - [ ] An existing next-day row (for example one an admin edited) is never overwritten.
  - [ ] Each challenge's direction is stored in a SQL lookup (`challenge_types` table: `type`, `direction`) seeded with `stacking/higher-better`, so the SQL does not depend on the TS registry.
- Notes: Depends on **Open** "Survival threshold and pass-target percentile" (60% and 80%) and "How pass targets and threshold rise" (configurable step, flat placeholder 0). Watch-out from the design: stacking scores compound early mistakes; the default stacking target placeholder must be easy for an admin to lower.

### T23 Scheduled close job and catch-up
- Type: infra
- Status: done
- Depends on: T22
- Acceptance criteria:
  - [ ] SQL function `close_due_game_days()` closes, in date order, every unclosed game day whose date is before `game_date_at(now())`, then calls `ensure_game_day(game_date_at(now()))`. It is a no-op when nothing is due.
  - [ ] A migration enables `pg_cron` and schedules `close_due_game_days()` at `'0 0 * * *'` (the deadline) and as a safety net every 5 minutes. pgTAP asserts that both `cron.job` rows exist.
  - [ ] pgTAP: with open days 2026-11-01 to 2026-11-03 and "now" (injected via a parameter) of 2026-11-04 00:00:30Z, a single call closes all three in order, and a second call changes nothing.
  - [ ] `npm run close-day -- --date YYYY-MM-DD` (local-only guard as in T20) calls `close_game_day` for play-testing and prints the outcome and streak.
  - [ ] README documents the close-day script.
- Notes: Depends on the **Open** deadline (midnight UTC). Daily close is Decided as a database scheduled job.

### T24 World streak display and history list
- Type: feature
- Status: done
- Depends on: T19, T21
- Acceptance criteria:
  - [ ] `/` shows "World streak: N days" (singular "1 day"), "Best: M", and yesterday's result ("Yesterday the world survived with 74% passing" / "Yesterday the streak broke at 52%"), all from server components reading public data.
  - [ ] `/history` lists closed game days newest first with date, challenge name, final pass rate (as %, or "no attempts"), threshold and outcome, paginated at 30 per page.
  - [ ] e2e (local Supabase): seed 3 closed days (2 survived, then 1 broken) via SQL fixtures. `/history` shows 3 rows in the right order, and `/` shows "World streak: 0 days" and "Best: 2".

### T25 Admin access and the game-day list
- Type: feature
- Status: done
- Depends on: T16, T24
- Acceptance criteria:
  - [ ] `/admin` returns 404 for signed-out and non-admin users (checked server-side, not by hiding links).
  - [ ] For admins, `/admin` lists today and the next 7 game days (creating missing rows via `ensure_game_day`), each with its challenge, pass target and survival threshold (shown as %), and whether it is closed.
  - [ ] Local `supabase/seed.sql` creates an admin user `admin@local.test` (documented password in README, local only).
  - [ ] A unit test for the page's admin check; e2e: the seeded admin sees the 8 days; a normal user and a signed-out visitor get 404.
- Notes: Split on Nov 11 (size): editing moved to T99. This is the MVP scope's "Admin controls to set pass targets and the survival threshold manually". Making the owner's real account an admin in production is a deployment step (see T50).

### T99 Admin game-day editor
- Type: feature
- Status: done
- Depends on: T25
- Acceptance criteria:
  - [ ] On `/admin`, each open day's pass target and survival threshold (0 to 1, entered as %) are editable. Saving calls a server action that re-checks `is_admin` and validates with zod. Closed days are read-only, in the database too (row-level security: admins may update only the two fields, only on open days).
  - [ ] Changing today's survival threshold is reflected in `/api/meter` on the next cache refresh.
  - [ ] Unit tests for the server action (non-admin is rejected, invalid threshold 1.5 is rejected, closed day is rejected); pgTAP for the policy. e2e: an admin changes tomorrow's threshold to 55% and sees it persisted.
- Notes: Split from T25. Also recomputes unedited, unstarted future days (DECISIONS, T25 and its T99 update; please-confirm in NEEDS_HUMAN), and folds in T101 (shared table styles). From the T77 review: the Tower's pass target must stay within the board (1 to 15 rows; the HUD rounds a fractional target up), or the target line is drawn off the grid; validate that range for stacking days.

## M3 More challenges and sharing

Goal: practise all three challenges (Teetering Tower, Second Sense, Swift Sum), see the daily challenge rotate from day to day, and share a spoiler-free result card that turns into a call for help when the world is close to the threshold.

### T26 Inner Clock (Second Sense) engine
- Type: feature
- Status: done
- Depends on: T08
- Acceptance criteria:
  - [ ] `src/challenges/inner-clock/engine.ts` implements `ChallengeModule` with `direction "lower-better"`. `paramsFromSeed(seed)` returns `{ targetMs }`, a multiple of 100 within a documented range (default 3,000 to 9,000), with a timeout of `3 × targetMs`.
  - [ ] Inputs `{ tapMs: number | null }` (ms from start). Score = `|tapMs - targetMs| / 1000` seconds, rounded to the nearest ms. A `null` tap or a tap after the timeout scores `2 × targetMs / 1000`.
  - [ ] Examples: target 5,000 with tap 5,320 gives 0.32; tap 4,700 gives 0.3; tap 5,000 gives 0; tap null gives 10.
  - [ ] Schema rejects negative or non-finite `tapMs`. Determinism and range tests over seeds 0 to 999. Golden tests for 3 seeds. At least 90% coverage.
  - [ ] `challenge_types` gains `inner-clock/lower-better`, and `default_pass_targets` gains an `inner-clock` placeholder (for example 0.5 s) via migration.
- Notes: Device and screen lag affect timing challenges (design watch-out). Inputs are measured client-side with `performance.now()`. `ChallengeModule` now also needs `lastInputMs` (T13; for a `null` tap use 0). As the first lower-better challenge, add a `submitAttempt` test that a lower score passes, so a hard-coded "higher-better" in `src/lib/attempts/submit.ts` would be caught (from the T13 test review).

### T27 Inner Clock (Second Sense) renderer and practice page
- Type: feature
- Status: done
- Depends on: T26
- Acceptance criteria:
  - [ ] `/practice/inner-clock` shows "Tap when you think N seconds have passed", a Start control, and no visible timer or progress indicator while running. A tap (pointer or Space) ends the run and reveals the actual time and the error.
  - [ ] The component reports `{ tapMs }` measured from the moment the start is acknowledged on screen, and reports `null` at the timeout.
  - [ ] Unit test: with mocked `performance.now` values 1,000 (start) and 6,320 (tap), it reports `tapMs 5320`.
  - [ ] e2e: start, wait about 1 s, tap, and see an error value displayed.

### T28 Flash Count (Swift Sum) engine
- Type: feature
- Status: done
- Depends on: T08
- Acceptance criteria:
  - [ ] `src/challenges/flash-count/engine.ts` implements `ChallengeModule` with `direction "lower-better"`. `paramsFromSeed(seed)` returns `{ dotCount, flashMs: 1000, dots: { x, y, r }[] }`, with `dotCount` within a documented range (default 15 to 45) and positions in a unit square, no two dots closer than the documented minimum spacing, and none clipped by the edges.
  - [ ] Inputs `{ count: integer 0..999 }`. Score = `|count - dotCount| / dotCount × 100`, rounded to 2 decimals. With dotCount 25: count 22 gives 12; 25 gives 0; 30 gives 20; 0 gives 100.
  - [ ] Tests: `dots.length === dotCount` for seeds 0 to 999; the spacing invariant holds for every pair; the same seed gives identical dots; different seeds give different layouts; golden tests for 3 seeds; at least 90% coverage.
  - [ ] `challenge_types` gains `flash-count/lower-better`, and `default_pass_targets` gains a `flash-count` placeholder (for example 15).
- Notes: Dot placement must terminate for every seed (bounded retries, then deterministic fallback). Test with the maximum count.

### T29 Flash Count (Swift Sum) renderer and practice page
- Type: feature
- Status: done
- Depends on: T28
- Acceptance criteria:
  - [ ] `/practice/flash-count` shows a Start control, then draws the dots on canvas for `flashMs`, clears them, and shows a numeric input (mobile `inputmode="numeric"`) with Submit. The answer reveals the true count and the error %.
  - [ ] The dots are drawn only after the canvas is visible, and the clear happens based on elapsed time (`performance.now()`), not a frame count (unit test with mocked time).
  - [ ] e2e: start, wait 1.5 s, enter 20, submit, and see the true count and an error % displayed.

### T30 All challenges in daily play and practice hub
- Type: feature
- Status: done
- Depends on: T14, T27, T29
- Acceptance criteria:
  - [ ] `src/challenges/registry.ts` maps `stacking`, `inner-clock` and `flash-count` to their engine module and React component. `ChallengeType` covers all three. The start and submit endpoints work for every type with no type-specific branches.
  - [ ] `/play` renders the component for today's `challenge_type`. Unit tests of the submit handler cover a passing and a failing attempt for each type (for example Inner Clock target 0.5: error 0.32 passes and 0.6 fails).
  - [ ] e2e: with today's game day set to `flash-count` via SQL fixture, the scored flow (start, enter count, result) works end to end.
- Notes: Split on Nov 11 (over 400 lines): the practice hub is T108. Keep `src/challenges/` free of React: the component side of the mapping lives under `src/components/`. From the T29 quality review: if the tab is hidden during Swift Sum's flash, animation frames pause and the dots may never show; for the scored version, restart or void the flash on `visibilitychange`. Second Sense's clock keeps running while hidden (decide whether that is fair).

### T108 Practice hub
- Type: feature
- Status: done
- Depends on: T30
- Acceptance criteria:
  - [ ] `/practice` lists the three challenges with a one-line description each and links to each practice page.
  - [ ] The home page's "Practice first" and `/play`'s practice links go to the right place for today's challenge (or the hub).
  - [ ] Unit test of the list; e2e: from `/practice` open each practice page.
- Notes: Split from T30 (Nov 11).

### T109 One practice page shell for every challenge
- Type: maintenance
- Status: done
- Depends on: T108
- Acceptance criteria:
  - [ ] The ready / playing / result / Play again scaffolding and its styles shared by `StackingPractice`, `InnerClockPractice` and `FlashCountPractice` live in one component and CSS module; each page keeps only its challenge-specific parts (how-to, game, result text).
  - [ ] Rendered markup is unchanged; existing unit and e2e tests pass unmodified; `npm run verify` passes.
- Notes: From the maintainer check after T29 (about 150-250 lines). Each new challenge would otherwise copy the scaffolding again. From the end-of-M3 check: the shell should take each challenge's how-to from `challengeUi(type)`, and the "N s off" / "N% off" wording should be built in one place per challenge and shared by daily play and practice (today `InnerClockPractice` builds its own), so the two cannot drift.

### T110 Scored timing challenges and a hidden tab
- Type: feature
- Status: done
- Depends on: T30
- Acceptance criteria:
  - [ ] Swift Sum: if the tab is hidden while the dots are shown, the dots are shown again in full when it returns (or the run says so and lets the player see them), so a scored player always gets the whole flash. Unit test with a mocked `visibilitychange` and time.
  - [ ] Second Sense: a decision, recorded in DECISIONS (and a please-confirm in NEEDS_HUMAN), on whether its clock keeps running while the tab is hidden; implemented and tested as decided.
- Notes: From the T29 quality review and the T30 spec review; not part of T30's criteria. Before scores are relied on (M4).

### T31 Daily challenge rotation
- Type: feature
- Status: done
- Depends on: T22, T30
- Acceptance criteria:
  - [ ] `game_settings` gains `rotation text[]`, default `{stacking,inner-clock,flash-count}`. The next day's type is `rotation[(next_date - date '2027-01-01') mod array_length + 1]` (positive modulo, so dates before 2027 work).
  - [ ] `ensure_game_day` and the prepare step in `close_game_day` both use the rotation.
  - [ ] pgTAP: 2027-01-01 is stacking, 2027-01-02 inner-clock, 2027-01-03 flash-count, 2027-01-04 stacking, and 2026-12-31 flash-count. An admin-edited future row keeps its type.
- Notes: Split on Nov 12 (over 400 lines): the admin challenge type select is T111. Depends on **Open** "Which challenges join the rotation after the first three". The MVP rotates only the first three; adding a type later is a data change plus a new module. From the T30 spec review: `/play` falls back to `DEFAULT_CHALLENGE` (`src/lib/attempts/today.ts`) for a day nobody has created yet; with the rotation it must use the rotation's choice instead (also note that `ensure_game_day` and `pass_target_for` hard-code 'stacking' today).

### T111 Admin picks a future day's challenge
- Type: feature
- Status: done
- Depends on: T31, T99
- Acceptance criteria:
  - [ ] The admin editor (T25, T99) gains a challenge type select for open days nobody has started, validated against `challenge_types` (server action and the database: the column-level grant and policy allow `challenge_type` only on unstarted open days).
  - [ ] A changed type marks the day edited, so the rotation leaves it alone; the pass target shown follows the new type's default until edited.
  - [ ] Unit tests for the action (unknown type refused, started day refused); pgTAP for the policy.
- Notes: Split from T31 (Nov 12).

### T112 Remaining e2e link clicks wait for hydration
- Type: maintenance
- Status: done
- Depends on: T78
- Acceptance criteria:
  - [ ] Every e2e spec that clicks a link or button right after `page.goto` uses `gotoReady` (or waits for the action's reply), for example `look.spec.ts` "the back button … goes home" and `auth.spec.ts` "sign up, sign out, then sign in again" (the header's Sign in link after sign-out).
  - [ ] `npm run test:e2e:local` passes 3 full runs in a row at the default workers.
- Notes: Seen once each during T32 (a click lost under 6-worker load; both passed on a re-run). T78 covered the shared helpers only. About 20 lines.

### T115 Share is a button with an emoji share text
- Type: feature
- Status: done
- Depends on: T32
- Acceptance criteria:
  - [ ] The result's share card shows the Share button but not the text. If neither sharing nor copying works, it shows the text so the player can copy it by hand.
  - [ ] The share text uses emojis: ✅/❌ outcome, 🔥 world streak, a 10-square meter bar (🟩 at or above the line, 🟧 below, ⬜ empty) with the rate and the line, 🆘 on a call for help. Still no score, target or challenge (tests).
  - [ ] Unit tests for the text and the card; play e2e updated.
- Notes: M3 play-test (Nov 12).

### T118 Second Sense clock fades out; targets 7-13 s
- Type: feature
- Status: done
- Depends on: T113
- Acceptance criteria:
  - [ ] The first second's clock fades away gracefully instead of vanishing (no fade with reduced motion); the tap timing is unchanged.
  - [ ] `TARGET_RANGE_MS` becomes 7,000-13,000 ms; golden tests updated.
  - [ ] Unit test of the fade state; practice e2e still passes.
- Notes: Second play-test of the M3 follow-ups (Nov 12). Build during M4; the human checks it at the M4 play-test (it does not block M4).

### T119 Swift Sum countdown before the dots
- Type: feature
- Status: done
- Depends on: T29
- Acceptance criteria:
  - [ ] Before the dots flash, a "3, 2, 1" countdown animation builds up to it (daily play and practice); the flash itself is unchanged and starts right after "1". Reduced motion: the numbers without the animation.
  - [ ] Unit test with mocked time: dots appear only after the countdown; e2e of Swift Sum practice still passes.
- Notes: Second play-test of the M3 follow-ups (Nov 12): "really build it up and make it feel like more of an experience". Build during M4; checked at the M4 play-test.

### T120 One error helper and one error rule for the local tools
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] `src/lib/localTools.ts` drops its private `failed(step, error)` and reuses `check` from `src/lib/devData.ts` (or both share one helper); message wording unchanged and covered by the existing tests.
  - [ ] All seven tools follow one rule: a database error comes back as a refused `ToolState` with its message (as `seed` and `close-day` already do), including `remove-fake-players` and the four database tools. Unit tests cover the throwing cases.
  - [ ] `npm run verify` passes; no product behaviour changes beyond errors showing as a message.
- Notes: From the maintainer check after T33. Local play-testing only, so low risk; today some tools throw to a generic error page. Also (T49 review): `recountDay` in `src/lib/devData.ts` reads then writes, so an attempt started meanwhile (a parallel e2e spec) can lose its count; consider one SQL statement for the recount.

### T121 PlayToday: start and submit outcomes as tested pure functions
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] A new module (for example `src/app/play/outcomes.ts`) maps a start response `(status, body)` to the next step (playing, ready with an error, abandoned, refresh) and a submit response to result, refresh or failed (heading and message); the error-message constants move with them.
  - [ ] `PlayToday.tsx` only fetches and applies the mapped result; the repeated "Back to home" button is shared.
  - [ ] Table-style unit tests cover every branch (401, 403, 409 `day-closed`, 409 submitted, other 409, other statuses, unknown challenge, `already-submitted`, both refusal codes, unknown error). Existing `PlayToday` tests pass unchanged; `npm run verify` passes.
- Notes: From the maintainer check after T33. The scored-attempt flow's error branches are today reachable only through component and e2e tests.

### T122 Cycles cannot overlap
- Type: maintenance
- Status: todo
- Depends on: T35
- Acceptance criteria:
  - [ ] The database refuses a cycle whose dates overlap another's (an exclusion constraint on the date range, or a trigger if `btree_gist` is not wanted), so `cycle_for` can never match two cycles.
  - [ ] pgTAP: an overlapping insert is refused; `prepare_next_cycle`'s back-to-back cycles still go in.
- Notes: From the T35 quality review. Cycles are only created back to back by the close job today, so this guards against a manual mistake.

### T126 One date-label formatter for the UTC day labels
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] The long-date formatter (`month: "long"`) in `src/lib/prize.ts` and `src/lib/rules.ts`, the short one in `src/lib/share.ts` and `dayLabel` (`src/lib/streak/streak.ts`), and the flags page's `flaggedAt` move to one module (for example `src/lib/dates.ts`), each with a unit test of a fixed date and its exact string.
  - [ ] `npm run verify` passes; every output string is unchanged.
- Notes: From the maintainer check after T125: five copies of the same `Intl.DateTimeFormat("en-US", { timeZone: "UTC" … })`.

### T127 One tested admin gate for the admin pages
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] The repeated `createSupabaseServerClient()` + `isAdmin` + `notFound()` in `/admin`, `/admin/settings`, `/admin/flags` and `/admin/draw` becomes one helper (for example `requireAdminPage()` in `src/lib/admin.ts`) that returns the client or calls `notFound()`; all four pages use it.
  - [ ] Unit test: a non-admin and a signed-out caller reach `notFound`, an admin gets the client. `npm run verify` passes; non-admins still get a 404.
- Notes: From the maintainer check after T125. The actions re-check admin status in their lib functions, so they are out of scope.

### T128 Keep .env.example in step with the code
- Type: maintenance
- Status: todo
- Depends on: T50, and the human adding the pending `.env.example` lines (NEEDS_HUMAN: T32, T44)
- Acceptance criteria:
  - [ ] A unit test fails when non-test `src/` reads a `process.env.X` (other than `NODE_ENV`) that `.env.example` does not list, and names the missing variables.
  - [ ] The README "Running the app" section uses the same variable names and commands as `.env.example`, `package.json` and `docs/DEPLOYMENT.md`; fix any mismatch.
  - [ ] `npm run verify` passes; no product behaviour changes.
- Notes: From the maintainer check after M4. Agents cannot edit `.env.example` (permission settings), so the test lands once the human has added `NEXT_PUBLIC_SITE_URL` and the three ad variables; until then it would fail.

### T123 Cheat check tests: exact boundaries and flag lists
- Type: maintenance
- Status: todo
- Depends on: T40
- Acceptance criteria:
  - [ ] `src/lib/cheat/detect.test.ts` pins the robotic-rhythm boundary (a standard deviation of exactly `STACKING_RHYTHM_MAX_SD_MS` is not flagged, just under is), and each rule's positive case asserts the whole flag list (`toEqual`), so an extra flag fails.
  - [ ] Each challenge's rules do not fire for another challenge's attempts (one test per type).
- Notes: Non-blocking points from the T40 test review.

### T113 Second Sense starts with a visible timer
- Type: feature
- Status: done
- Depends on: T27
- Acceptance criteria:
  - [ ] Daily play and practice show a running seconds timer from the start for `REVEAL_MS` (1000 ms), then hide it; the target still counts from the start.
  - [ ] Targets rise to 5–12 s (`TARGET_RANGE_MS`), golden engine tests updated; the placeholder pass target is re-checked.
  - [ ] Unit test of the timer's show and hide with mocked time; e2e of the practice page still passes.
- Notes: M3 play-test (Nov 12): the start was ambiguous without a reference.

### T114 Swift Sum balance
- Type: feature
- Status: done
- Depends on: T29
- Acceptance criteria:
  - [ ] Fewer dots and a longer flash (`DOT_COUNT_RANGE` 12–30, `FLASH_MS` 1500), so a player cannot count them all but can estimate; golden tests updated; decision recorded and flagged.
- Notes: M3 play-test (Nov 12): it felt like a crapshoot.

### T116 Admin dev tools: days and attempts
- Type: feature
- Status: done
- Depends on: T25, T31
- Acceptance criteria:
  - [ ] `/admin` gains a "Local tools" panel, shown and accepted only when the Supabase URL is local (the same guard as the scripts; the server actions refuse otherwise) and the user is an admin.
  - [ ] Controls: set today's (or any open day's) challenge; clear my own attempt today so I can play again; reset an open day (delete its attempts, zero its counters, follow the rotation again; a closed day is refused, since the streak counts it); restore the rotation to the default.
  - [ ] Unit tests for each action, including the refusals (not local, not admin); e2e: clear my attempt and play again.
- Notes: M3 play-test (Nov 12): no commands to remember.

### T117 Admin dev tools: seed and close
- Type: feature
- Status: done
- Depends on: T116
- Acceptance criteria:
  - [ ] The "Local tools" panel can seed fake players (count, pass rate, date) and close a day, sharing the code of `npm run seed:dev` and `npm run close-day` (the scripts keep working); remove all fake players too.
  - [ ] Unit tests for the actions and their guards; README points to the panel.
- Notes: M3 play-test (Nov 12).

### T32 Spoiler-free share card with call for help
- Type: feature
- Status: done
- Depends on: T24, T30
- Acceptance criteria:
  - [ ] `src/config/share.ts` exports `NEAR_THRESHOLD_MARGIN = 0.05`. `src/lib/share.ts` exports pure `buildShareText({ passed, gameDate, streak, meter, siteUrl })`.
  - [ ] The text includes the game name from config, the game date, the player's outcome ("I passed today's challenge" / "I didn't make it today"), the world streak, and the site URL. It never includes the score, pass target, challenge parameters or the challenge type (test asserts that none of these values appear).
  - [ ] When the meter is open and `passRate < threshold + margin` (for example threshold 0.60, rate 0.63), the text becomes a call for help: "The world is close to the line at 63%. We need you: play before the deadline!" At 0.70 it is the normal status. In the hidden state, it says "The meter is hidden. Every attempt counts!" and no rate is shown.
  - [ ] The `/play` result shows the card with a Share button that uses `navigator.share` when available and otherwise copies to the clipboard and shows "Copied" (unit-tested with both APIs mocked).
  - [ ] `NEXT_PUBLIC_SITE_URL` is added to `.env.example` (placeholder `http://localhost:3000`).
- Notes: "Near the threshold" has no number in the design. This margin is a configurable placeholder (judgment call, record it and flag it). Principle 3: a pass and a fail produce visually identical cards apart from the outcome line.

## M4 Prize, rules, ads, admin and hardening

Goal: see the live prize ($200 plus any rollover) and cycle progress, read the draft official rules, simulate a 30-day streak locally, draw a winner from the admin page, review cheat flags, see ad placeholders outside the challenges, and run the full end-to-end suite including mobile viewports.

### T33 Cycles table and prize amount
- Type: feature
- Status: done
- Depends on: T21
- Acceptance criteria:
  - [ ] `src/config/prize.ts` exports `PRIZE_PER_CYCLE_CENTS = 20000`, `CYCLE_LENGTH_DAYS = 60`, `STREAK_GOAL_DAYS = 30`, `FIRST_CYCLE_START = "2027-01-01"` and `PAYOUT_WITHIN_DAYS = 45`.
  - [ ] A migration creates `cycles` (`number int pk`, `start_date`, `end_date`, `base_prize_cents int not null default 20000`, `rollover_in_cents int not null default 0`, `goal_reached_on date`, `winner_user_id uuid`, `drawn_at timestamptz`, `paid_on date`) and inserts cycle 1 from 2027-01-01 to 2027-03-01 (60 days inclusive). There are **no** revenue share, floor or cap columns.
  - [ ] `src/lib/prize.ts` exports `currentPrizeCents(cycle) = base + rollover_in` and `nextRolloverCents(cycle) = cycle.goal_reached_on ? 0 : base + rollover_in`. Tests: an unwon cycle 1 gives cycle 2 $400; an unwon cycle 2 gives cycle 3 $600; a won cycle gives the next cycle $200.
  - [ ] `cycle_for(d date)` SQL returns the cycle containing `d`, or null (preseason). pgTAP: 2026-12-31 is null, 2027-01-01 is 1, 2027-03-01 is 1, 2027-03-02 is null until cycle 2 exists.
  - [ ] RLS: readable by everyone except `winner_user_id` (expose a public view without it). Writes are admin-only via functions.
- Notes: Human instruction: the prize is a flat $200 per cycle with rollover. Ignore the "formula, floor and cap" wording and the revenue share and cap fields.

### T34 Close job: cycle-aware streak, goal and rollover
- Type: feature
- Status: done
- Depends on: T33
- Acceptance criteria:
  - [ ] The first game day of a cycle starts a fresh streak run (any open run from before the cycle is ended), so the goal counts only streak days inside the cycle.
  - [ ] When the current run reaches `STREAK_GOAL_DAYS` (30) inside a cycle that has no `goal_reached_on`, `close_game_day` sets `goal_reached_on` to that date.
  - [ ] Closing the last day of a cycle creates the next cycle (start = end + 1, 60 days) with `rollover_in_cents` = 0 if the goal was reached, otherwise base + rollover_in.
  - [ ] pgTAP: 30 survived days from 2027-01-01 set `goal_reached_on = 2027-01-30`; a run broken on day 29 and then 30 more survived days reaches the goal on 2027-02-28; 60 days with no 30-run create cycle 2 with rollover 20000 (prize $400); re-closing any day is idempotent.
- Notes: Judgment calls (record them and flag them): the streak resets at each cycle start (the data model ties WorldStreak to a cycle); once the goal is reached, the cycle keeps running to day 60 and entries keep accruing; preseason days (before 2027-01-01) still count toward the streak display but award no entries.

### T35 Entries for passed days
- Type: feature
- Status: done
- Depends on: T34
- Acceptance criteria:
  - [ ] A migration creates `entries` (`user_id`, `cycle_number`, `game_date`, **`unique (user_id, game_date)`**). `record_attempt_result` inserts one when the attempt passed and `cycle_for(game_date)` is not null.
  - [ ] RLS: a user can select only their own entries, with no client write policies.
  - [ ] `my_entry_count(cycle)` returns the caller's count for the cycle.
  - [ ] pgTAP: a passed attempt in a cycle creates 1 entry; a failed attempt creates none; a preseason pass creates none; a user cannot read another user's entries.

### T36 Prize and cycle display
- Type: feature
- Status: done
- Depends on: T35, T24
- Acceptance criteria:
  - [ ] `/` shows "Prize this cycle: $200" (or the current amount with rollover, for example "$400, including $200 rolled over"), "Day X of 60" and "Goal: a 30-day world streak". Once the goal is reached, it shows "Goal reached on <date>. A winner will be drawn after the cycle ends."
  - [ ] In preseason, it shows "The first cycle starts January 1, 2027. Prize: $200."
  - [ ] Signed-in users see "Your entries this cycle: N".
  - [ ] e2e with SQL fixtures for preseason, mid-cycle with rollover, and goal reached.

### T37 Local multi-day simulation script
- Type: infra
- Status: in-progress
- Depends on: T34, T20
- Acceptance criteria:
  - [ ] `npm run simulate:days -- --from 2027-01-01 --days 30 --players 50 --pass-rate 0.8` creates the game days, fake attempts (via `record_attempt_result`, so counters and entries update) and closes each day in order (local-only guard).
  - [ ] After that command, `world_streak()` reports current 30, and cycle 1 has `goal_reached_on 2027-01-30` (integration check in the script's test, or a documented manual step).
  - [ ] README documents how to play-test the cycle and the draw with it, including resetting with `npm run db:reset`.
- Notes: From the T20 reviews: `record_attempt_result` refuses every game date but today, so "via `record_attempt_result`" cannot hold for simulated past or future days. Reuse T20's direct path in `scripts/seed-dev.mts` (write the result, then add the pass with the attempt's `counted_weight`), or plan another way; see DECISIONS, "Seeding a day other than today". That path reads then writes the counters and uses two requests per pass; for a bigger simulation, consider one small SQL function that writes the result and increments the counters atomically (T20 quality review).
- Decided (Nov 12, human): option A. Add `close_game_day_unchecked(d)`, service-role only, with `close_game_day` keeping its deadline check and calling it; the script refuses any non-local URL, first closes every open day before `--from` that has no attempts (broken), and the README says to run `npm run db:reset` afterwards. Full review (migration, streak).

### T38 Official rules page (draft)
- Type: feature
- Status: done
- Depends on: T33, T03
- Acceptance criteria:
  - [ ] `/rules` states: free to enter, no purchase or payment of any kind; eligibility (US residents aged 18+, enforced at sign-up), with values from config; one account per person; how a day passes and how the world streak and cycles work (60 days, first cycle January 1, 2027, goal a 30-day streak); the prize is $200 per cycle, rolling over in full to the next cycle if the goal is not reached; one entry per passed day; one winner drawn at random from all entries; flagged accounts lose their entries; the winner must verify their email before payout; payment within 45 days of the cycle ending.
  - [ ] Every number on the page comes from `src/config/*` (test: rendering with a changed `MIN_AGE` or `PRIZE_PER_CYCLE_CENTS` changes the text).
  - [ ] The page contains no mention of a prize formula, floor, cap or revenue share (test asserts their absence).
  - [ ] Sponsor name, address and contact email come from `src/config/sponsor.ts` placeholders (`"[Sponsor name]"`), and the page shows a visible "Draft" banner while any placeholder remains.
  - [ ] Linked from the footer and from the sign-up checkbox.
- Notes: The design calls this a draft rules page. Add a NEEDS_HUMAN entry recommending a legal review before public launch (this does not block the task).

### T39 Fill in sponsor details on the rules page
- Type: docs
- Status: todo
- Depends on: T38
- Acceptance criteria:
  - [ ] `src/config/sponsor.ts` holds the human-provided sponsor legal name, mailing address and contact email. The "Draft" banner disappears when no placeholder remains.
- needs-human: The sponsor's legal name, mailing address and a contact email for the official rules (reply in chat or put them in `docs/NEEDS_HUMAN.md`), and confirmation that the draft rules text has been reviewed.

### T40 Cheat detection rules
- Type: feature
- Status: done
- Depends on: T30
- Acceptance criteria:
  - [ ] `src/lib/cheat/detect.ts` exports pure `detectFlags({ challengeType, inputs, score, params, serverElapsedMs, history })`, which returns a list of reason codes. Thresholds live in `src/config/cheat.ts`.
  - [ ] Rules with tests: `stacking-min-interval` (any two taps closer than 120 ms apart); `stacking-robotic-rhythm` (10 or more taps with an interval standard deviation below 5 ms); `stacking-perfect-run` (20 or more consecutive zero-overhang blocks); `inner-clock-implausible` (error below 0.01 s on 3 or more of the user's last 5 Inner Clock attempts); `flash-count-instant` (Flash Count submitted less than 800 ms after the dots cleared, when that is reported); `timing-mismatch` (the client's last input timestamp more than 2 s below the server-observed elapsed time minus a 15 s allowance for loading).
  - [ ] Honest-looking fixtures (human-like jittered taps) produce no flags. Each rule has a positive and a negative test. At least 90% coverage.
- Notes: The purpose is protecting prize entries. Flags never change pass or fail or the meter (cheating to pass only helps the streak, and principle 3 says sabotage looks the same as honest failure). The thresholds are placeholders, recorded as a judgment call.

### T41 Cheat flags wiring
- Type: feature
- Status: done
- Depends on: T40, T35
- Acceptance criteria:
  - [ ] A migration creates `cheat_flags` (`id`, `user_id`, `attempt_id`, `reason`, `created_at`, `status` in `open|confirmed|dismissed`) with no client read or write policies (admin-only via functions).
  - [ ] The submit handler runs `detectFlags` after scoring and records one row per reason. Any flag sets `profiles.flagged = true`. The response to the player is unchanged (test: the flagged and unflagged responses have identical shape and fields).
  - [ ] Flagged attempts still count in the counters and the pass result (pgTAP or unit test).
  - [ ] Entries of flagged accounts are excluded by a SQL view `drawable_entries` (pgTAP: user with 3 entries, flagged, contributes 0).

### T42 Admin settings editor
- Type: feature
- Status: done
- Depends on: T25, T31
- Acceptance criteria:
  - [ ] `/admin/settings` edits every `game_settings` field with zod validation (for example a threshold between 0 and 1, a percentile between 0.5 and 0.99, and rotation entries that must exist in `challenge_types`). A non-admin gets 404.
  - [ ] Unit tests for the server action (admin check, validation).
- Notes: Split on Nov 12 (over 400 lines): the flags review is T124.

### T124 Admin flags review
- Type: feature
- Status: done
- Depends on: T41, T42
- Acceptance criteria:
  - [ ] `/admin/flags` lists open flags with user email, reason, date and attempt score. "Dismiss" sets the status to `dismissed` and, when the user has no remaining open or confirmed flags, clears `profiles.flagged`. "Confirm" keeps the account flagged.
  - [ ] Unit tests for the server actions (admin check, validation). e2e: an admin dismisses a flag and the user's entries reappear in `drawable_entries` (an SQL assertion in the test).
- Notes: Split from T42 (Nov 12).

### T43 Prize draw tool
- Type: feature
- Status: done
- Depends on: T42, T124
- Acceptance criteria:
  - [ ] `src/lib/draw.ts` exports pure `pickWinner(entries: { userId, tickets }[], randomInt: (max) => number)`, which maps ticket index to user. With A:3, B:1, index 0 to 2 picks A and index 3 picks B. An empty list throws. At least 90% coverage.
  - [ ] `/admin/draw` lists cycles. The Draw button is enabled only when the cycle has `goal_reached_on` and today is after `end_date`. It uses `drawable_entries` and `crypto.randomInt`, and stores `winner_user_id` and `drawn_at` in one transaction. A cycle cannot be drawn twice (second attempt rejected, with a pgTAP or unit test).
  - [ ] e2e with SQL fixtures (T37's `simulate:days` is blocked): an admin draws a winner for a finished, won cycle.
- Notes (split): the winner's details and "Mark paid" are T125 (Nov 12, over 400 lines).

### T125 Prize winner details and payout
- Type: feature
- Status: done
- Depends on: T43
- Acceptance criteria:
  - [ ] `/admin/draw` shows a drawn cycle's winner email, whether the email is verified (`auth.users.email_confirmed_at`), the payout deadline (end date + 45 days), and a "Mark paid" action that sets `paid_on`.
  - [ ] Unit tests for the action (admin check, a cycle not drawn yet refused); e2e: an admin sees the email and the deadline, and marks the prize paid.
- Notes: Split from T43 (Nov 12).
- Notes: Judgment call (record it): entries from the whole cycle count, including those earned after the goal day, and the draw happens after the cycle ends. Email verification before payout is a manual step for the owner (confirmations are off in the MVP). From the T41 reviews: if recording a flag fails at submit (logged, not thrown) or the server stops between the result and the flags, that attempt is never checked; consider re-running `detectFlags` over the cycle's passed attempts before the draw.

### T44 Ad slots outside the challenge
- Type: feature
- Status: done
- Depends on: T36
- Acceptance criteria:
  - [ ] `src/components/AdSlot.tsx` renders nothing unless `NEXT_PUBLIC_ADS_ENABLED === "true"` and `NEXT_PUBLIC_ADSENSE_CLIENT` is set. In development, with `NEXT_PUBLIC_ADS_PLACEHOLDER=true`, it renders a labelled grey box of fixed size (no layout shift).
  - [ ] Slots appear on `/`, `/history` and `/rules`, and below the result on `/play` only after an attempt has finished. Never on practice pages or while a challenge is running (e2e asserts no `[data-ad-slot]` exists on `/practice/*` or during an active `/play` run).
  - [ ] The AdSense script loads only when ads are enabled (unit test).
  - [ ] All three env names are added to `.env.example` with comments; ads are off by default.
- Notes: The design both says "Google AdSense from launch" and recommends no ads during the soft launch on Vercel Hobby (non-commercial only). Ads therefore stay off by default behind a flag. Flagged as ambiguous.

### T45 Wire Google AdSense
- Type: infra
- Status: todo
- Depends on: T44
- Acceptance criteria:
  - [ ] With the human's publisher ID set in the deployment environment, the AdSense script and slot markup use it, and `public/ads.txt` contains the correct `google.com, pub-XXXXXXXX, DIRECT, f08c47fec0942fa0` line.
  - [ ] README documents enabling ads (env values, ads.txt) and the reminder that ads require Vercel Pro (commercial use).
- Notes (from the T44 reviews): the AdSense script loads on every page once ads are live, practice included (no slots there), so keep AdSense auto-ads off in the account or load the script only on pages with slots; the per-slot inline push script may not re-run on client-side navigation, so check slots fill after navigating back; `NEXT_PUBLIC_` values need a rebuild and redeploy to change.
- needs-human: An approved Google AdSense account for the site's domain, its publisher ID (`ca-pub-...`) for `NEXT_PUBLIC_ADSENSE_CLIENT`, ad unit slot IDs if using manual units, and the decision to switch to Vercel Pro before ads go live.

### T46 Account weighting
- Type: feature
- Status: done
- Depends on: T17, T16
- Acceptance criteria:
  - [ ] `record_attempt_result` computes the weight at submit time: `1` if the account is at least `full_weight_after_days` old, otherwise `new_account_weight`, multiplied by `profiles.weight` (default 1, a manual override). The weight used is stored on the attempt (`attempts.weight`).
  - [ ] pgTAP: with settings `new_account_weight 0.5, full_weight_after_days 7`, a 2-day-old account adds 0.5 to the weighted counters and an 8-day-old account adds 1; with the defaults (1.0, 0), every account adds 1.
  - [ ] The admin settings page (T42) shows both fields with help text.
- Notes: Depends on **Open** "How much new accounts count, and after how many days they count fully". Per the human's instruction, the default is full weight from day one (1.0 after 0 days), configurable. Record it and flag it. As built: the weight is stamped when the attempt starts, in `attempts.counted_weight` (DECISIONS, T46), since attempts are counted at start.

### T47 Mobile checks
- Type: feature
- Status: done
- Depends on: T32, T44
- Acceptance criteria:
  - [ ] Playwright gains Chromium-based mobile projects (`Pixel 7` and an iPhone-sized viewport, 390×844 with `hasTouch` and `isMobile`) without adding new browsers to CI.
  - [ ] On both: `/`, `/play` (signed in), `/practice/*` and `/rules` have no horizontal scroll (`scrollWidth <= clientWidth`); each challenge canvas fits within the viewport; every button and link has a hit area of at least 44×44 CSS px; each practice challenge can be completed with touch taps (`page.touchscreen.tap`).
  - [ ] Pinch-zoom and double-tap zoom do not trigger during challenge taps (`touch-action: manipulation`, or the stricter `none` the Tower uses, on the canvas, asserted via computed style).
  - [ ] Any layout fixes needed to pass are included (split into a follow-up task if they exceed the size limit).

### T48 Meter performance under load
- Type: feature
- Status: done
- Depends on: T18
- Acceptance criteria:
  - [ ] The meter handler adds a module-level cache with a single in-flight request (`METER_CACHE_SECONDS`): 500 concurrent calls within one window trigger exactly 1 database read, and a call after the window triggers 1 more (unit test with a fake clock and a counting mock).
  - [ ] A database failure serves the last good value for up to 5 minutes with `stale: true`, then 503 (unit-tested).
  - [ ] `npm run load:meter` (free, open-source tool such as autocannon as a devDependency) runs 30 s at 200 connections against a local production build and prints p95 latency. README records a baseline result and the target p95 < 200 ms locally.
- Notes: The design wants traffic spikes to stay cheap on Vercel Hobby: keep the client poll at 60 s and the edge cache at 30 s.

### T49 End-to-end coverage of the main flows
- Type: feature
- Status: done
- Depends on: T43, T46, T47
- Acceptance criteria:
  - [ ] e2e "day survives": seed today with 10 fake attempts at 70% passing, then a new user signs up, plays and finishes. `/api/meter` (bypassing the cache via a test header that is only honoured outside production, or by waiting) shows 11 attempts. `close-day` makes `/` show the streak increased by 1 and `/history` list the day as survived.
  - [ ] e2e "day breaks": seed with 50% passing, close, and `/` shows "World streak: 0 days".
  - [ ] e2e "one attempt": a second start returns 409 and `/play` shows the existing result.
  - [ ] e2e "practice signed out": every practice page is playable without an account, and no `/api/attempts` calls are made.
  - [ ] e2e "ineligible sign-up": an under-18 user is refused.
  - [ ] All e2e tests run green in CI against local Supabase.

### T50 Deployment guide and launch checklist
- Type: docs
- Status: done
- Depends on: T49
- Acceptance criteria:
  - [ ] `docs/DEPLOYMENT.md` lists, step by step for the human: create the Supabase cloud project (free plan); apply migrations (`supabase link` + `supabase db push`); confirm pg_cron is enabled and the jobs exist; set the auth settings (email confirmations off, site URL, redirect URLs, Google provider); create the Vercel project with every env var from `.env.example`; make the owner's account an admin (exact SQL: `update profiles set is_admin = true where id = (select id from auth.users where email = '<owner email>')`); and the pre-launch items (domain, custom email provider, Vercel Pro before ads, AdSense, legal review of the rules).
  - [ ] Every env var in `.env.example` is mentioned in the guide (a unit test or script check compares the two lists).
  - [ ] `docs/NEEDS_HUMAN.md` gains entries for the Supabase cloud project, the Vercel project and the production admin account, each pointing at the relevant guide section.
- Notes: The agents never run commands against production; deployment is a human step. From the T118 review: the server replays each attempt with the engine it runs at submit, so the guide should say to deploy engine changes (target ranges, rules) when no attempt is open, for example just after the daily close.

## Maintenance

### T51 Dev dependency audit and e2e build timing
- Type: maintenance
- Status: todo
- Depends on: T01
- Acceptance criteria:
  - [ ] `npm audit` reports no moderate or higher vulnerabilities, or each remaining one is listed in the PR with why it can't be fixed yet (at T01: 0 in production dependencies, 8 moderate in dev tooling).
  - [ ] If the CI e2e job spends more than 2 minutes building the app inside Playwright's `webServer`, move the build into its own workflow step before `npm run test:e2e` (an addition only) and make `webServer` just run `npm run start`.
- Notes: Suggested in T01 review (quality-reviewer). Also take the patch updates for `react` and `react-dom` (19.3.0 to 19.3.1, from the T05 maintainer check). Do not take the major bumps (TypeScript 7, ESLint 10): `eslint-config-next` 16.4.5 targets ESLint 9 and TypeScript 5. `npm audit fix --force` is not acceptable if it makes breaking major upgrades without tests passing. From the T10 maintainer check: also take the Supabase CLI 3.0.0 to 3.1.0 update; (the `@material/material-color-utilities` hold is moot: T73 removed it). After T77, `npm outdated` also lists `@testing-library/user-event` 14.6.9 (patch); hold `@types/node` 26, which should track the Node 22+ runtime in `engines`. From the end-of-M1 check: also take `next` and `eslint-config-next` 16.4.6 (patch); if its release notes include security fixes, do this task first. From the end-of-M4 check: record the held majors (ESLint 10, TypeScript 7, autocannon 9) with the reason and when to revisit in `docs/DECISIONS.md`.

### T52 Sign-up abuse protection
- Type: maintenance
- Status: todo
- Depends on: T05
- Acceptance criteria:
  - [ ] The sign-up action is rate-limited per client IP (for example at most 5 sign-ups per IP per hour, a config constant), enforced on the server, with a unit test that the 6th attempt is refused with a plain message.
  - [ ] A free CAPTCHA (Cloudflare Turnstile, which Supabase Auth supports) protects `/signup` when `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set, and is skipped with a logged warning when they are not, so local development and e2e tests still work.
  - [ ] Both keys are listed in `.env.example` with placeholders and comments.
- Notes: Raised in the T05 quality review. Sign-up uses the service-role `auth.admin.createUser`, so Supabase's built-in sign-up rate limit does not apply, and a prize game attracts bulk account creation. Should land before the public launch (M4 at the latest).
- needs-human: a free Cloudflare account and a Turnstile widget for the production domain; put the site key and secret key in `.env.local` and Vercel as `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.

### T53 Share eligibility-field validation; plausible-age check moves into checkEligibility
- Type: maintenance
- Status: done
- Depends on: T05
- Acceptance criteria:
  - [ ] `checkEligibility` takes a maximum plausible age in `EligibilityRules`, defaulting to `MAX_PLAUSIBLE_AGE = 120` in `src/config/eligibility.ts`. A birth date older than that returns `reason: "invalid-date"`. It uses the existing calendar-date parsing, not string slicing.
  - [ ] `isImplausiblyOld` and the local `MAX_PLAUSIBLE_AGE` are removed from `src/lib/signup.ts`.
  - [ ] The birth date, country and rules-agreement validation is one exported function that `signUp` uses and T07's `/complete-profile` can reuse. It covers the schema pieces, the field-error mapping and the refusal or invalid-date decision.
  - [ ] `eligibility.test.ts` boundary tests: exactly 120 years old on `today` is eligible; one day older is `invalid-date`. The existing `signup.test.ts` and `actions.test.ts` cases pass unchanged.
  - [ ] The 90% thresholds for `src/lib/eligibility.ts` and `src/lib/signup.ts` still pass; `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T05. Prevents T07 from copying the validation.

### T54 Component tests for the sign-up form
- Type: maintenance
- Status: done
- Depends on: T05
- Acceptance criteria:
  - [ ] Free dev dependencies for component tests (`@testing-library/react` plus `jsdom` or `happy-dom`). The environment is chosen per file (`// @vitest-environment jsdom`), so existing node tests are unaffected.
  - [ ] `src/app/signup/SignUpForm.test.tsx`, with the server action mocked, covers:
    - field errors render with `aria-invalid="true"` and a matching `aria-describedby` id;
    - the form-level message renders in `role="alert"`;
    - the submitted email, birth date and country are refilled after a failed submit;
    - the submit button is disabled and reads "Creating account" while pending.
  - [ ] `SignUpForm.tsx` reaches at least 80% line and branch coverage, with no coverage exclusion added for client components.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T05. Client components count at 0% unit coverage, and the overall branch coverage (about 76%) would drift toward the 70% floor as UI grows.

### T55 Shared form field components
- Type: maintenance
- Status: done
- Depends on: T54
- Acceptance criteria:
  - [ ] `src/components/` provides:
    - `Field`: label, error text and `aria-describedby` wiring, also used by the checkbox row;
    - `FormAlert`;
    - `BirthDateInput`;
    - `CountrySelect`, including the remount-on-value fix;
    - `RulesAgreement`.
  - [ ] The components' CSS lives in a component CSS module; `src/app/signup/signup.module.css` keeps only page layout.
  - [ ] `SignUpForm.tsx` uses the components, and T54's component tests pass unchanged.
  - [ ] The new components meet the coverage thresholds; `npm run verify` and the sign-up e2e tests pass; no product behavior changes.
- Notes: From the maintainer check after T05. T06 needs `Field` and `FormAlert`; T07 needs the birth date, country and rules fields.

### T56 Shared e2e support module
- Type: maintenance
- Status: done
- Depends on: T05
- Acceptance criteria:
  - [ ] `tests/e2e/support/` exports:
    - the service-role admin client;
    - `uniqueEmail()` with automatic clean-up registration;
    - `findUserByEmail`;
    - `hasSessionCookie`;
    - `signUpViaForm(page, { email, birthDate, country })`.
  - [ ] `tests/e2e/signup.spec.ts` uses them with the same assertions.
  - [ ] Clean-up deletes accounts by the user id looked up once, and runs even when a test fails (an `afterEach` or fixture).
  - [ ] `npm run test:e2e` passes locally and in CI; `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T05. T06 and T07 e2e tests need the same helpers.

### T57 Single source for eligibility wording; country-list consistency test
- Type: maintenance
- Status: done
- Depends on: T05
- Acceptance criteria:
  - [ ] One helper (for example `eligibilitySummary()`, built from `MIN_AGE` and `ALLOWED_COUNTRIES`) produces the "US residents aged 18 or over" wording. Both `refusalMessage()` and the `/signup` intro use it. A unit test shows that changing `ALLOWED_COUNTRIES` changes both texts.
  - [ ] A unit test checks that every `ALLOWED_COUNTRIES` code appears in `COUNTRY_OPTIONS`, and that option codes are unique and match `^[A-Z]{2}$`.
  - [ ] The `ELIGIBILITY_TIME_ZONE` comment is accurate: Honolulu is the westernmost US state time zone, so its calendar date is the earliest.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T05. The `/signup` intro currently hard-codes "US residents".

### T58 Fewer Auth round trips per page; keep pages static where possible
- Type: maintenance
- Status: todo
- Depends on: T06
- Acceptance criteria:
  - [ ] Each page render makes at most one Auth server round trip. Options: `getClaims()` in the proxy, or asymmetric JWT signing keys so `getClaims()` verifies locally. Whichever is chosen is recorded in DECISIONS.md with the trade-off.
  - [ ] Pages whose content does not depend on the user (for example `/rules`) can render statically again, for example by making the account header a small client island that loads the session after first paint, without the header flashing the wrong state.
  - [ ] A signed-in user who opens `/signin` or `/signup` is redirected to `/`.
  - [ ] Sign-in shows a specific message for `email_not_confirmed`, in case email confirmation is ever turned on.
  - [ ] `npm run verify` and `npm run test:e2e` pass.
- Notes: From the T06 quality review. Not urgent during development; do before the live meter and play pages add traffic (M2). The T10 maintainer check found the comment in `src/components/AccountHeader.tsx` (lines 10-11) wrong: `getClaims` does not verify locally while `signing_keys_path` is commented out in `supabase/config.toml`, so a signed-in render makes two Auth calls today (`getUser` in the proxy, `getClaims` in the header). Fix the comment as part of this task. The T60 maintainer check adds: `src/proxy.ts` matches `/api/*`, so every signed-in API call makes two Auth `getUser` round trips (the proxy and the route), which matters once the meter is polled (T18/T19).

### T59 One-command local e2e runs
- Type: maintenance
- Status: done
- Depends on: T02
- Acceptance criteria:
  - [ ] `npm run test:e2e:local` reads the local Supabase URL, anon key and service-role key from `npx supabase status` and runs Playwright with them, passing extra arguments through, so no `.env.local` or shell `export` step is needed.
  - [ ] It refuses to run when the Supabase URL is not localhost, and fails with a clear message when local Supabase is not running. Unit tests cover the parsing and both refusals.
  - [ ] README "Checks" documents it; CI keeps using `npm run test:e2e`.
- Notes: Requested by the human (Nov 9, 2026) so unattended sessions and reviewers can run e2e as one allowlisted command, without shell scripting that triggers permission prompts.

### T60 Practice: move focus to the result when a run ends
- Type: maintenance
- Status: done
- Depends on: T10
- Acceptance criteria:
  - [ ] When a practice run finishes, keyboard focus moves to the result, so a keyboard or screen-reader user is not left on `<body>` (the Start button they pressed was unmounted). The heading "You stacked N blocks" is announced, through a polite live region or because it labels the focused element.
  - [ ] A Space key held or pressed as the run ends does not start a new run straight away. A test covers it: Space keydown and keyup right after `onFinish` must not start a run. Options: ignore activation for a short configurable delay, or focus the heading (`tabIndex={-1}`) and let Tab reach "Play again". Record the choice in DECISIONS.md.
  - [ ] `StackingPractice.test.tsx` covers where focus goes after finishing and after "Play again".
  - [ ] `npm run verify` passes; no behavior change beyond focus handling.
- Notes: From the maintainer check after T10. T14's `/play` result view will reuse this pattern, so ideally land it before T14.

### T61 Share the auth form helpers: email schema, form reading, profile insert
- Type: maintenance
- Status: todo
- Depends on: T07
- Acceptance criteria:
  - [ ] One `emailSchema` (trim, lowercase, `z.email("Enter a valid email address.")`) in `src/lib/forms.ts`, used by `signup.ts` and `signin.ts`.
  - [ ] One helper, for example `readFields(formData, names)`, replaces the hand-written `formData.get(x) ?? undefined` readers in `signup.ts`, `signin.ts` and `profileCompletion.ts`.
  - [ ] `refusalMessage()` moves from `signup.ts` to `eligibility.ts` next to `eligibilitySummary()`, so `profileCompletion.ts` no longer imports the sign-up module.
  - [ ] One `insertProfile(client, { userId, birthDate, country })` in `src/lib/profiles.ts` returns `"ok" | "exists" | "error"` and is used by both sign-up and profile-completion actions, each keeping its current meaning (sign-up treats `"exists"` as a failure and deletes the auth user; profile completion treats it as success). The unique-violation code lives in that one place.
  - [ ] Existing unit tests pass unchanged apart from import paths; the 90% thresholds still pass; `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T10. T12, T25, T42 and T52 add more form and profile code, so this stops the copying spreading.

### T62 Shared e2e sign-in, sign-out and header helpers
- Type: maintenance
- Status: todo
- Depends on: T56
- Acceptance criteria:
  - [ ] `tests/e2e/support/pages.ts` exports `header(page)`, `signInViaForm(page, email, password = E2E_PASSWORD)` (button scoped to `main`, not the header link) and `signOutViaHeader(page)` (waits for the "Sign in" link).
  - [ ] `auth.spec.ts` and `profile.spec.ts` use them with the same assertions.
  - [ ] `hasSessionCookie` uses the `AUTH_COOKIE` regex from `support/session.ts` instead of its own copy.
  - [ ] `npm run test:e2e` passes locally and in CI; `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T10. T14, T25, T30, T36, T43 and T49 all need a signed-in browser. The T60 maintainer check adds: `tests/e2e/attempts.spec.ts` repeats "sign up, then expect `/`" and `adminClient().from(...)` plus `if (error) throw error`; a `signedUpPlayer()` fixture would cover both.

### T63 Component-test race audit
- Type: maintenance
- Status: todo
- Depends on: T55
- Acceptance criteria:
  - [ ] Every component test in `src/app/**` and `src/components/**` is checked for assertions made right after a submit whose result arrives asynchronously, with no `findBy*` or `waitFor` first (the pattern behind the `SignUpForm.test.tsx` flake fixed in T59). Each one found waits for the result; no assertion is removed or weakened.
  - [ ] `npx vitest run` passes 5 full runs in a row locally.
  - [ ] `npm run verify` and `npm run test:e2e` pass; no product behavior changes.
- Notes: From the maintainer check after T10, plus the warning seen during the T59 e2e runs. The Field key warning criterion was dropped: T80 fixed it.

### T64 Revoke TRUNCATE from client roles
- Type: maintenance
- Status: todo
- Depends on: T11
- Acceptance criteria:
  - [ ] A migration revokes TRUNCATE on every table in `public` from `anon` and `authenticated` (RLS does not cover TRUNCATE, and Supabase's default grants include it), and changes the default privileges so tables created later are covered too.
  - [ ] pgTAP: `table_privs_are` (or `has_table_privilege`) shows neither role has TRUNCATE on `profiles`, `game_days` or `attempts`, and a table created after the migration also lacks it.
  - [ ] `npm run test:db` and `npm run verify` pass; no product behavior changes.
- Notes: From the T11 quality review. Not exploitable through the API (PostgREST cannot issue TRUNCATE), so this is defence in depth; do it before launch.

### T65 Generated Supabase database types
- Type: maintenance
- Status: todo
- Depends on: T12
- Acceptance criteria:
  - [ ] `npm run db:types` writes `src/lib/supabase/database.types.ts` from the local schema (`supabase gen types typescript --local`), and the server, admin and browser clients are typed with it.
  - [ ] The `data as { ... }` casts in `src/lib/attempts/store.ts` (and any others) are removed.
  - [ ] A unit test or CI step fails when the committed types are out of date with the migrations (for example regenerate and compare in the CI job that already starts Supabase, as an added step).
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the T12 quality review. Worth doing before M2 adds more tables.

### T78 e2e helpers wait for the page to be interactive
- Type: maintenance
- Status: done
- Depends on: T73
- Acceptance criteria:
  - [ ] The sign-in helper in `tests/e2e/profile.spec.ts` (and any shared sign-in, sign-up or Google helper) waits until the page has hydrated before typing or clicking (for example wait for a hydration marker or for the submit button to be enabled by client code), so typed values are not wiped and clicks are not lost on a cold dev-server compile. No timeouts are simply raised.
  - [ ] `npm run test:e2e:local` passes 3 full runs in a row from a cold `.next-e2e` folder.
  - [ ] Seen on main on Nov 11, every time (not after T99): with 6 workers, `tests/e2e/attempts.spec.ts` plus `meter.spec.ts` fail in all 5 sign-up tests. "Create account" stays pending past the 5 s `toHaveURL("/")` wait while several sign-ups run at once against the dev server. With `--workers=2` they pass, and CI (production build) passes. Find the slow step (dev compile of the action and `/`, or GoTrue's password hashing under load) and wait on the sign-up's real completion instead.
- Notes: From the T73 test review: on cold compiles, "Continue with Google goes to Google…" lost its click and "an underage player completing their profile…" had its typed fields cleared; a third run passed 30/30. Fits with T62 (shared e2e helpers). The T74 test review saw the same on a cold compile in `practice.spec.ts` "the home page links to practice" (the click on "Practice first" was lost); include it. Found during T75: with 6 local workers the dev server's Fast Refresh (about 5 s, set off when another worker first opens a page that shares client modules) stalls in-flight sign-up server actions, so the first wave of sign-up tests misses its 5 s URL wait; `--workers=1` passes 36/36 and CI (production build, no Fast Refresh) is unaffected. Consider running `test:e2e:local` against a production build like CI, or warming every route before the tests start.

### T82 One page-title template in the root layout
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] `src/app/layout.tsx` metadata uses `title: { default: GAME_NAME, template: "%s | " + GAME_NAME }`, and the six pages that build `` `X | ${GAME_NAME}` `` by hand set only their own part.
  - [ ] `src/app/layout.test.ts` checks the template (and that changing `GAME_NAME` changes both the default and the template).
  - [ ] `npm run verify` passes; every rendered `<title>` is identical.
- Notes: From the maintainer check after T77 (about 40 lines). Stops the copying before `/history`, `/admin` and more practice pages arrive.

### T83 One source for the password rules
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] `src/lib/passwords.ts` exports `MIN_PASSWORD_LENGTH` (8) and `MAX_PASSWORD_LENGTH` (72), used by the zod schema in `src/lib/signup.ts` (both messages) and by `SignUpForm.tsx` (`minLength` and the label).
  - [ ] A unit test checks `minimum_password_length` in `supabase/config.toml` equals `MIN_PASSWORD_LENGTH`.
  - [ ] Existing sign-up tests pass unchanged; `npm run verify` passes.
- Notes: From the maintainer check after T77 (about 50 lines).

### T84 Guard the design tokens; one source for the canvas colours
- Type: maintenance
- Status: todo
- Depends on: T81
- Acceptance criteria:
  - [ ] A unit test fails if any `var(--name)` under `src/` is neither defined in `src/app/tokens.css`, a `next/font` variable, nor declared in the same file.
  - [ ] The canvas token mapping in `StackingGame.tsx` becomes one exported constant that `tests/e2e/look.spec.ts` imports instead of its own list.
  - [ ] A test fails if `CELL_RADIUS_PX` in `render.ts` stops matching `--fs-radius-cell`; `LinkButton` uses the exported `ButtonVariant` type.
  - [ ] `npm run verify` passes; no behavior change.
- Notes: From the maintainer check after T77 (about 100 lines). Today only `--md-` is guarded, so a misspelled `var(--fs-…)` would silently resolve to nothing.

### T85 Tower wording: rows, not blocks; stale "does not count" comments
- Type: maintenance
- Status: done
- Depends on: T81
- Acceptance criteria:
  - [ ] The result text on `/play` and practice uses the HUD's unit: "You reached row 7. Today's target was row 10." (confirmed by the human, Nov 10), with `blocks.ts` and the e2e text checks following.
  - [ ] The `PlayStatus` comment in `src/lib/attempts/today.ts` says leaving early counts as not passed.
  - [ ] `npm run verify` passes; the only behavior change is the result wording.
- Notes: From the maintainer check after T77 (about 60 lines). Since T76 the score is rows locked, and a 3-cell row is 3 blocks, so "target was 10 blocks" contradicts "Row 10 to pass".

### T86 Share the attempt response types with /play; enforce test-only player.ts
- Type: maintenance
- Status: todo
- Depends on: T81
- Acceptance criteria:
  - [ ] `src/lib/attempts/start.ts` and `submit.ts` export their response body types, and `PlayToday.tsx` builds its `StartBody` and `SubmitBody` from them with type-only imports (narrowing `params` to `StackingParams` until T30).
  - [ ] An ESLint `no-restricted-imports` rule bans `@/challenges/stacking/player` outside `*.test.ts` (and test support), proven by a lint-rule test like `src/challenges/shared/lintRules.test.ts`.
  - [ ] `npm run verify` passes; no behavior change.
- Notes: From the maintainer check after T77 (about 60 lines). T77's `passTarget` had to be added by hand in two places; T30 adds two challenge types to this contract. From the check after T16: `tests/e2e/attempts.spec.ts` imports `tapsForAMiss` straight from `src/challenges/stacking/player`; route it through `tests/e2e/support/tower.ts` so the rule has one allowed path.

### T80 Fix the missing-key warning in form fields; quieter test output
- Type: maintenance
- Status: done
- Depends on: T75
- Acceptance criteria:
  - [ ] The React warning "Each child in a list should have a unique key prop. Check the render method of `Field`" no longer appears on `/signup`, `/signin` or `/complete-profile` (a component test fails on that console error).
  - [ ] The Vitest coverage text reporter prints the summary only (for example `text-summary` plus `html`); every threshold stays as it is and still fails the run when missed.
  - [ ] Playwright writes its results to a subfolder (for example `test-results/playwright`), so an e2e run no longer wipes other files kept in `test-results/` (the agents keep helper scripts and PR bodies there); CI's artifact paths, if any, follow.
- Notes (added Nov 11): do right after T95. The human asked to cut usage; this warning repeats dozens of times in every e2e log, and the full coverage table prints on every test run.
- Notes: Seen in every e2e run's server log since T55. In dev it also opens Next's error overlay, whose stack-frame lookups slow the dev server under parallel e2e (see T78). Overlaps T63's third criterion (maintainer check after T16): whichever lands first does the fix, and the other drops that criterion.

### T79 One shared result-hero style for play and practice
- Type: maintenance
- Status: done
- Depends on: T74
- Acceptance criteria:
  - [ ] The result layout, verdict heading (display face, reveal animation, no focus ring), the big score (`.score`, added in T81; placed as in practice, above the heading, on both screens: the human's choice, Nov 10), actions column and `@keyframes reveal` live once (a `ResultHero` component or shared classes in `src/components/ui/`) and are used by both `/play` and `/practice/stacking`.
  - [ ] The raw pixel sizes inside the verdict and title `clamp()` calls, and `.shellTitle`'s 26px in `ui.module.css`, become `--fs-text-*` tokens or carry a comment saying why.
  - [ ] No visual change; existing unit and e2e tests pass unchanged.
- Notes: From the T74 quality review (non-blocking).

### T88 Sturdier ResultHero test hooks
- Type: maintenance
- Status: todo
- Depends on: T79
- Acceptance criteria:
  - [ ] `ResultHero` exposes its tone as a `data-tone` attribute, and the tone tests (`ui.test.tsx`, `PlayToday.test.tsx`, `StackingPractice.test.tsx`) check that attribute instead of matching CSS-module class names with a regex.
  - [ ] The score-above-verdict check in `tests/e2e/play.spec.ts` asserts that both elements are visible before it reads `boundingBox()`, with no non-null assertions.
  - [ ] The `plain` tone's class names have no trailing space (a small `cx()` helper or similar).
- Notes: From the T79 round-2 reviews (non-blocking).

### T89 game_settings: tighter checks and a drift guard
- Type: maintenance
- Status: todo
- Depends on: T16
- Acceptance criteria:
  - [ ] The two streak-step checks also refuse `'NaN'` and `'Infinity'` (Postgres `numeric` lets them through `>= 0`), with pgTAP cases.
  - [ ] pgTAP: a signed-in user with no profile row gets `is_admin() = false` and their update affects 0 rows.
  - [ ] `loadGameSettings` selects its columns by name instead of `*`.
  - [ ] One shared fixture of boundary rows (accepted and refused) is checked both by pgTAP against the table and by Vitest against `parseGameSettings`, so the zod ranges cannot drift from the check constraints (the pattern of `src/lib/gameDay.fixture.json`).
- Notes: From the T16 round-2 reviews (non-blocking). Later tasks (T18, T22, T24) should read settings through `loadGameSettings`.

### T92 One strict parser for numeric database values
- Type: maintenance
- Status: done
- Depends on: none (coordinate with T65, which also edits `src/lib/attempts/store.ts`)
- Acceptance criteria:
  - [ ] The strict `numeric` zod schema in `src/lib/settings.ts` moves to one shared module (for example `src/lib/db/numeric.ts`): a JSON number or a plain decimal string, and a throw on anything else (null, `""`, `"NaN"`, non-numbers).
  - [ ] `src/lib/attempts/store.ts` (`passTarget` in `gameDay` and `findAttemptForDay`, `score`, `seed`) and `src/lib/meter.ts` (`survival_threshold`, `weighted_attempts`, `weighted_passes`) use it instead of bare `Number(...)`; the "numbers or strings" comment lives once, in the shared module.
  - [ ] Unit tests: a game day with `pass_target: null` or `"abc"` makes the store throw (the endpoint answers 500) instead of returning NaN or 0; the meter likewise for a malformed threshold; `settings.test.ts` passes unchanged.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T18 (about 60-80 lines). `Number(null)` is 0 and `Number("abc")` is NaN; a NaN `passTarget` makes `passes()` false for every score, so every player would fail without an error. Land before T21, T22 and T24 add more numeric reads.

### T93 Day counter integrity
- Type: maintenance
- Status: done
- Depends on: T17
- Acceptance criteria:
  - [ ] A migration makes `attempts.counted_weight` not null for new rows (backfill or exclude old rows without a profile, said in the migration comment).
  - [ ] `record_attempt_result` raises when a pass's counter update changes 0 rows, instead of recording a pass that was never counted.
  - [ ] An attempt insert for a game day with `closed_at` set is refused in the database, and `startAttempt` maps the refusal to a clearly named 409 (for example `day-closed`).
  - [ ] `stamp_attempt_weight` becomes `security invoker` if pgTAP shows the service-role insert still works.
  - [ ] pgTAP: a null weight fails; a pass with no counters row raises; a start on a closed day is refused and leaves the counters unchanged. A unit test covers the start mapping.
  - [ ] `npm run verify` passes; no behavior change beyond refusing starts on closed days (a bug fix).
- Notes: From the maintainer check after T18 (about 100-150 lines), taking the T17 quality-review follow-ups out of T21. With a null `counted_weight`, `weighted_passes + v_weight` is null and the submit fails with an unexplained 500.

### T94 One meter-window helper for the endpoint and the meter UI
- Type: maintenance
- Status: done
- Depends on: T18
- Acceptance criteria:
  - [ ] One pure function holds the only copy of `closes - METER_HIDE_HOURS * HOUR_MS` (for example `meterHiddenFrom(closesAt)`), used by `meterBody` and `meterCacheSeconds`.
  - [ ] `MeterBody` and the pure meter logic live in a module client code can import without the Supabase client, so T19's `Meter.tsx` can import the type and the helper to switch to hidden by its own clock.
  - [ ] The existing meter and route tests pass unchanged; a new test covers the helper at 20:59:59.999Z and 21:00:00.000Z.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T18 (about 40-60 lines). Do before T19.

### T95 One shared local-only toolkit for the dev scripts
- Type: maintenance
- Status: done
- Depends on: T20
- Acceptance criteria:
  - [ ] One module (for example `scripts/lib/localSupabase.mts`) holds the only copy of the localhost check, the service-role client factory and the `check(operation, result)` error helper; `scripts/seed-dev.mts` and `scripts/e2e-local.mts` both use it, and neither keeps its own hostname comparison.
  - [ ] `seed-dev.mts` reads numeric database values strictly, with the same rules as `src/lib/db/numeric.ts` (`pass_target`, `weighted_passes`, `counted_weight`); a malformed value makes the script exit non-zero (unit test with `pass_target: null` and `"abc"`).
  - [ ] Existing script tests pass, changed only where imports move; the shared module has its own guard tests (localhost, 127.0.0.1, remote, missing, unparsable).
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T93 (about 100-150 lines). T23 (`close-day`) and T37 (`simulate:days`) reuse it. Side note for T23: once the catch-up close runs, the README's `--date 2026-11-01` seed example is always closed and refused; update it then.

### T96 Shared pgTAP fixtures for players, attempts and days
- Type: maintenance
- Status: done
- Depends on: T17
- Acceptance criteria:
  - [ ] One helper file under `supabase/tests/` provides, for example, `tests.make_player(id, weight default 1)`, `tests.clear_today()` and `tests.play_day(date, attempts, passes, threshold)`.
  - [ ] The helpers live inside each file's rolled-back transaction or are installed by a setup file that runs first; nothing reaches `supabase/migrations/` (record which way was chosen, and that the helper file is not itself run as a test).
  - [ ] At least `game_day_counters.test.sql`, `day_counter_integrity.test.sql` and `record_attempt_result.test.sql` use them, with unchanged assertions and at least 226 tests in total.
  - [ ] `npx supabase test db` and `npm run verify` pass; no product behavior changes.
- Notes: From the maintainer check after T93 (about 150-250 lines, mostly removed duplication). Land before T21, whose pgTAP needs several days with set counts.

### T97 One meter-reply check, shared and guarded against drift
- Type: maintenance
- Status: done
- Depends on: T19
- Acceptance criteria:
  - [ ] `isMeterBody` moves from `src/components/Meter.tsx` to the client-safe `src/lib/meter.ts` (still without zod; the import allowlist test passes) and is exported for the UI.
  - [ ] A unit test shows every body `meterBody` can produce passes the check (open with a rate, open with `passRate: null`, open with `threshold: null`, hidden), so when T21 fills in `streak` a missed update fails a test instead of showing "unavailable".
  - [ ] The malformed-reply cases in `src/components/Meter.test.tsx` pass unchanged.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T93 (about 40-60 lines). Land before T21.

### T90 ResultHero owns the result focus and the shared result bits
- Type: maintenance
- Status: todo
- Depends on: T79
- Acceptance criteria:
  - [ ] `ResultHero` focuses its own heading when it mounts; the `headingRef` prop and the focus `useRef`/`useEffect` in `PlayToday.tsx` and `StackingPractice.tsx` go. Focus behaviour is unchanged: `/play` focuses the result and "Not counted" views (including a stored result on a later visit), practice focuses the result after every run.
  - [ ] The muted `.note` style is defined once (a `ResultHero` note slot or a shared class in `ui.module.css`), not in both `play.module.css` and `practice.module.css`.
  - [ ] `PlayToday`'s "abandoned" view reuses the existing `backHome` element instead of a second "Back to home" `LinkButton`.
  - [ ] The focus tests pass unchanged (or move into `ui.test.tsx` with the same assertions), and a new `ui.test.tsx` case shows a mounted `ResultHero` focuses its heading.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T16 (about 60-80 lines). T30 adds two more result screens that would otherwise copy the focus pattern. Can be done with T88.

### T91 An unfinished attempt is not necessarily abandoned (wording after T87)
- Type: maintenance
- Status: todo
- Depends on: T87
- Acceptance criteria:
  - [ ] When today's attempt has started but not been submitted, `/play` shows wording that stays true now that runs have no time limit (the human approves the exact text; see NEEDS_HUMAN).
  - [ ] The `PlayStatus` "abandoned" comment in `src/lib/attempts/today.ts` says the same.
  - [ ] `PlayToday.test.tsx` and `tests/e2e/play.spec.ts` check the new text.
  - [ ] `npm run verify` and `npm run test:e2e` pass; the only behavior change is this message.
- Notes: From the maintainer check after T16 (about 20 lines). When this task touches `today.ts`, also consider a read-only player store for `findAttemptForDay` (taking only `from`), so the player's client cannot reach the service-role methods by type rather than by comment (T68 quality review). Since T87 the server accepts a run until the day's deadline, so a player who opens `/play` in a second tab mid-run is told "You left today's attempt before finishing, so it counted as not passed", yet the first tab can still submit a pass. Scoring and counters are correct; only the message is wrong. Wording approved by the human (Nov 10; see DECISIONS).

### T66 Shared route-handler helpers for API endpoints
- Type: maintenance
- Status: done
- Depends on: T13
- Acceptance criteria:
  - [ ] One server-only module (for example `src/lib/http/route.ts`) provides `jsonNoStore(body, status)` (always `cache-control: no-store`), `requireUser()` (the verified user, or a ready 401 `{ error: "unauthenticated" }`), `readJsonBody(request, maxBytes)` (the parsed body, 413 `too-large` by declared or actual size, or 400 `invalid-body`), and a wrapper that logs a thrown error and answers 500 `{ error: "server-error" }`.
  - [ ] The start, submit and health routes use them; neither attempts route defines its own `NO_STORE` or error builder.
  - [ ] One `secureRandomSeed()` replaces the copies in the start route and `StackingPractice.tsx`.
  - [ ] The helpers have unit tests (401, 413 by header, 413 by size, 400 non-JSON, 500 without details, no-store everywhere); the existing route tests pass unchanged.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T60. Land before T18 (the polled meter), so new routes start from one pattern.

### T67 Coverage thresholds where scoring and game-day logic live
- Type: maintenance
- Status: done
- Depends on: T13
- Acceptance criteria:
  - [ ] `passes(score, target, direction)` moves from `src/lib/attempts/submit.ts` to `src/lib/scoring/` (for example `pass.ts`) with its tests; callers import it from there (the T21 close job will reuse it).
  - [ ] `vitest.config.mts` sets 90% lines and branches for `src/lib/attempts/**` and `src/lib/gameDay.ts` (both at 100% today, so this only raises thresholds).
  - [ ] Every threshold glob matches at least one file, or carries a comment naming the task that will fill it (`src/lib/streak/**` matches nothing yet).
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T60. CLAUDE.md asks for 90% on scoring and streak logic, but the pass/fail, result storage and game-date code currently falls only under the 70% overall threshold. Do this soon. From the check after T77: also give `src/app/play/PlayToday.tsx` and `src/app/practice/stacking/StackingPractice.tsx` per-file thresholds (at or below what they measure now); they sit outside `src/components/**`. From the check after T16: also give `src/lib/settings.ts` 90% lines and branches (it parses the threshold and targets that pass/fail and the streak use).

### T68 One attempt store and one challenge lookup for start and submit
- Type: maintenance
- Status: done
- Depends on: T13 (coordinate with T65, which also edits `src/lib/attempts/store.ts`)
- Acceptance criteria:
  - [ ] One helper (for example `challengeForGameDay(gameDate, challengeType)` in `src/challenges/registry.ts`) returns the module or throws the unknown-type error, replacing the duplicate checks in `start.ts` and `submit.ts`.
  - [ ] Both flows read the game day through one store method (`gameDay(gameDate)`: challenge type, pass target, closed), merging start's `gameDayFor` (added in T77) and submit's `gameDay`, which run the same query and parse.
  - [ ] The two `findAttempt` methods get distinct names (`findAttemptForDay(userId, gameDate)`, `findAttemptById(attemptId)`), and the store's internal `fail()` is renamed (for example `throwDbError`).
  - [ ] Unit tests for both flows and stores still cover every status code; `tests/e2e/attempts.spec.ts` is unchanged; `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T60. T17 and T21 will extend these stores. From the end-of-M1 check: `todaysAttempt` in `src/lib/attempts/today.ts` is a third reader of "the player's attempt for a game date"; fold it into the same store method.

### T69 Play page polish: shared button styles, error page, stable run
- Type: maintenance
- Status: todo
- Depends on: T14
- Acceptance criteria:
  - [ ] (Superseded by T73, which builds the shared `Button`; drop this item.)
  - [ ] `src/app/play/error.tsx` shows a calm message with a Reload button when the page's server lookups fail, with a component test.
  - [ ] A server refresh of `/play` during a run (the `key={status.kind}` remount) cannot unmount the running game: `PlayToday` keeps its playing or checking phase, with a test.
  - [ ] After `router.refresh()` (from a 409 on start or submit), a refresh that returns the same status does not leave the page stuck on "Starting" or "Checking your result": it falls back to a reload message, with a test.
  - [ ] An e2e test covers the refresh after a submission elsewhere: start in the page, submit through `page.request`, finish in the page, and see the stored result (this fails if the `key` is dropped).
  - [ ] `npm run verify` and the play and practice e2e tests pass; no other behavior changes.
- Notes: From the T14 quality review. Also add the `data as unknown as Row` cast in `src/lib/attempts/today.ts` to T65's list.

### T70 Local setup accuracy: env helper, db:stop and play-test notes
- Type: maintenance
- Status: todo
- Depends on: T59
- Acceptance criteria:
  - [ ] `npm run env:local` prints the three `.env.local` lines (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), reusing `localSupabaseEnv` and the status command from `scripts/e2e-local.mts`. It never writes a file, refuses non-localhost URLs, and prints the one-line message when Supabase is stopped. Unit tests cover the output and both refusals.
  - [ ] README "Running the app" uses it (or names the exact `npx supabase status -o env` fields `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, not the Publishable/Secret keys), and the `requireEnv` hint in `src/lib/supabase/env.ts` points at the same step.
  - [ ] A `db:stop` script (`supabase stop`); README says to run `npm run db:stop` then `npm run db:start` when Studio (54323) does not open or after changing Google env values.
  - [ ] A README "Play-testing" paragraph: one scored attempt per game day; the day changes at midnight UTC (7 pm US Eastern); for another go, sign up with a new email or delete your `attempts` row in Studio; `npm run db:reset` wipes everything including accounts.
  - [ ] The leftover `src/challenges/shared/.gitkeep` and `src/components/.gitkeep` are deleted.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the end-of-M1 maintainer check. CLI 3.0.0 `supabase status` shows both PUBLISHABLE_KEY/SECRET_KEY and ANON_KEY/SERVICE_ROLE_KEY, while the README uses the old labels. Agents still never read or write `.env.local`; the script only prints.

### T71 Show how to play on /play before the one scored attempt
- Type: maintenance
- Status: done
- Depends on: T14
- Acceptance criteria:
  - [ ] The stacking how-to text has one source (for example `STACKING_HOW_TO` in `src/config/challenges.ts` or a small component), used by `StackingPractice.tsx` and the ready state of `PlayToday.tsx`; the practice wording stays the same.
  - [ ] The `/play` ready state shows it above the one-attempt rule, plus a "Try it in practice first" link to `/practice/stacking`.
  - [ ] Component tests: the ready state shows the how-to and the link; the result, abandoned and playing states do not. `StackingPractice.test.tsx` passes unchanged.
  - [ ] `npm run verify` passes; the only behavior change is the added instructions and link.
- Notes: From the end-of-M1 maintainer check. Today a player who comes straight from the home page uses their only daily attempt without seeing the controls. Absorbed into T81 (split from T77, Nov 9, 2026): mark this done when T81 merges.

### T72 Unit test for the /play server page
- Type: maintenance
- Status: todo
- Depends on: T14
- Acceptance criteria:
  - [ ] `src/app/play/page.test.tsx`, following `src/app/complete-profile/page.test.tsx` (mocked server client, `landingPath`, `todaysAttempt`, `redirect`, a stub `PlayToday`), covers: signed out (sign-in text and both links, no lookups); no profile (redirect, no `todaysAttempt`); with a profile (`todaysAttempt` called with the user id and a Date, its status passed on); a `todaysAttempt` failure is not swallowed.
  - [ ] `npm run verify` passes; no product behavior changes.
- Notes: From the end-of-M1 maintainer check. Page files are excluded from coverage, so `/play`'s gates are covered only by e2e today; T69's error page depends on the last case.

### T100 One fake Supabase query builder for unit tests
- Type: maintenance
- Status: todo
- Depends on: T25
- Acceptance criteria:
  - [ ] One helper (for example `src/lib/testing/fakeSupabase.ts`) provides the chainable, thenable query-builder Proxy that scripts results per call and records every builder call.
  - [ ] `src/lib/meterRead.test.ts`, `src/lib/streak/streak.test.ts` and `src/lib/admin.test.ts` use it; `src/lib/settings.test.ts`, `src/lib/attempts/store.test.ts` and `src/lib/attempts/today.test.ts` too if they fit the size limit. No assertion is weakened.
  - [ ] The helper has its own small test or is excluded from coverage; `npm run verify` passes; no product behavior changes.
- Notes: From the maintainer check after T25 (about 250 lines, mostly deletions). Six test files each hand-roll the same Proxy, so a query-shape change means editing several fakes. Check the copies are close enough to share before migrating all six.

### T101 AdminDayList gets its own table styles
- Type: maintenance
- Status: done (folded into T99: `src/components/ui/DataTable.module.css`)
- Depends on: T25
- Acceptance criteria:
  - [ ] `AdminDayList.tsx` and `HistoryTable.tsx` no longer share `HistoryTable.module.css`: the shared table rules move to a neutral module (for example `DataTable.module.css`) both import, or the admin list gets its own.
  - [ ] Rendered markup is unchanged and the existing component tests pass unmodified; `npm run verify` passes.
- Notes: From the maintainer check after T25 (about 60 lines). A restyle of the history table would otherwise silently change the admin page. Fold into T99 if T99 restyles the admin table anyway.

### T102 Today's pass target locks once the day has started
- Type: feature
- Status: done
- Depends on: T99
- Acceptance criteria:
  - [ ] A migration makes the database refuse a change to a game day's pass target once that day has any attempt (admins included); the threshold stays editable on any open day. pgTAP covers: target edit before any start allowed, refused after a start, threshold edit after a start allowed.
  - [ ] On `/admin`, a started day's pass target is shown read-only with a short reason; the save action reports a refused edit instead of failing silently.
  - [ ] `npm run verify` and `npm run test:db` pass.
- Notes: Human decision at the M2 play-test (DECISIONS, Nov 11). Full review (migration, row-level security).

### T103 Show the meter until the deadline
- Type: maintenance
- Status: done
- Depends on: T19
- Acceptance criteria:
  - [ ] `METER_HIDE_HOURS` becomes 0, and with 0 the meter and `/api/meter` never answer `hidden` before the deadline (unit tests at 0, plus the hidden path still tested with a non-zero value so it can be switched back on).
  - [ ] The hidden message reads correctly for any non-zero value (no "final 0 hours"); README or config comment says how to turn hiding back on.
  - [ ] `npm run verify` passes; e2e if the meter flow tests rely on the window.
- Notes: Human decision at the M2 play-test: hide it later only if sniping becomes a real problem. Keep the private-counters migration as is. Full review (the meter).

### T104 Gauge meter at the top of the home page
- Type: feature
- Status: done
- Depends on: T103
- Acceptance criteria:
  - [ ] Follows the "Chosen" artboard of https://claude.ai/artifact/MRXZU4jQW9RvVqLLDohXXQ (option A's meter). Home order: header, meter, today's challenge card, streak card. The countdown ("Closes in h:mm:ss") moves to the page header.
  - [ ] The meter is a half-circle gauge: the arc fills to the pass rate (mint when at or above the threshold, light tangerine below), a glowing tangerine tick marks the threshold, the big percentage sits inside the arc with "passing right now", and a pill says "N points above the line", "N points below the line" or "Right on the line". Under it: the threshold ("60% needed") and the attempt count. A soft glow behind it takes the same colour as the state.
  - [ ] Keeps today's behaviour: `role="meter"` with value and value text, loading and unavailable states, "No attempts yet" when the pass rate is null, the reload at the deadline, polling only while visible. The arc animates to a new value (about 400 ms ease-out); instant with reduced motion.
  - [ ] The challenge card keeps its current content, with option A's "Your part today" eyebrow. On a 390 x 844 phone the Play button is visible without scrolling (e2e check).
  - [ ] Text contrast at least 4.5:1 (3:1 for 24 px and up); colours, radii and shadows from `tokens.css` (add tokens if needed); `npm run verify` and `npm run test:e2e` pass; meter tests updated to the new markup without weakening.
- Notes: Human choice after the M2 play-test (Nov 11). The mockup draws the arc with a conic gradient and a masking circle; an SVG arc is fine too if it animates more cleanly.

### T105 Streak card with a 14-day bar chart
- Type: feature
- Status: done
- Depends on: T104
- Acceptance criteria:
  - [ ] Follows the "Chosen" artboard (option A's header with option C's bars). Header: "World streak" eyebrow, the big glowing mint streak number with "days", and "Best N" on the right.
  - [ ] Under it, one bar for each of the last 14 days, oldest on the left: the bar height is that day's final pass rate and a tangerine line marks that day's threshold. Survived days in the streak are mint, the day that broke a streak is light tangerine, other closed days are muted, and a day with no row or no attempts shows as an empty slot. Labels "14 days ago" and "Yesterday". An accessible text alternative lists the days (date, pass rate, needed, survived or broken).
  - [ ] Keeps yesterday's line and the "Every day so far" link. The read of the last 14 closed days is public (no service role), with unit tests for the shaping (missing days, broken day, fewer than 14 days of history).
  - [ ] Contrast and tokens as in T104; `npm run verify` and `npm run test:e2e` pass; streak tests updated without weakening.
- Notes: Human choice after the M2 play-test (Nov 11). Reuse the history read in `src/lib/streak/streak.ts` where it fits.

### T106 Patch-level dependency bump
- Type: maintenance
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] Patch/minor bumps only: `next` and `eslint-config-next` 16.4.6, `react` and `react-dom` 19.3.1, `supabase` 3.1.0, `@testing-library/user-event` 14.6.9 (package.json and lockfile). Not `eslint` 10, `typescript` 7 or `@types/node` 26.
  - [ ] `npm run verify` and `npm run test:e2e` pass; `npm audit` stays clean; README "Running the app" still matches the Supabase CLI.
- Notes: From the end-of-M2 maintainer check. Its other proposal (flaky 6-worker sign-up e2e) is already T78; do T78 before M3. Done with `npm audit fix` (in-range lockfile updates); one dev-only moderate advisory remains (minimatch inside typescript-eslint, which `eslint-config-next` pins), production audit clean.

### T107 attempts e2e reads today's real pass target
- Type: maintenance
- Status: done (folded into T78: its 3 clean runs needed it)
- Depends on: T22
- Acceptance criteria:
  - [ ] `tests/e2e/attempts.spec.ts` "scores a submission itself" compares `passTarget` with the stored game day's target (as the start check in the same file does), not the literal 10.
  - [ ] The spec passes locally when today's target is not 10 (for example after `npm run seed:dev` or an admin edit).
- Notes: Seen in T104-T106: locally today's target was 8 (recent scores), so this one test failed on every full run; CI passes on a fresh database. About 5 lines.
