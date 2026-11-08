# Progress

Agents update this file after every task, newest entries first. A fresh session reads it to know where things stand.

## Current status

- Milestone: M1 Foundation and first challenge end to end
- Active task: T09 Stacking engine
- Blocked tasks: none
- Waiting on the human: see docs/NEEDS_HUMAN.md

## Log

<!-- Format:
### YYYY-MM-DD — T07 Stacking game engine (PR #12)
- Summary in one line
- Review rounds: spec 1, quality 2, tests 1
- Notes: anything the next session should know
-->

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
