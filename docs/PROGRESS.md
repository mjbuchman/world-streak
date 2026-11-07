# Progress

Agents update this file after every task, newest entries first. A fresh session reads it to know where things stand.

## Current status

- Milestone: M1 Foundation and first challenge end to end
- Active task: T04 Profiles table with row-level security
- Blocked tasks: none
- Waiting on the human: see docs/NEEDS_HUMAN.md

## Log

<!-- Format:
### YYYY-MM-DD — T07 Stacking game engine (PR #12)
- Summary in one line
- Review rounds: spec 1, quality 2, tests 1
- Notes: anything the next session should know
-->

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
