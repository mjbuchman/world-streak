# Progress

Agents update this file after every task, newest entries first. A fresh session reads it to know where things stand.

## Current status

- Milestone: M1 Foundation and first challenge end to end
- Active task: T02 Local Supabase, clients and database tests
- Blocked tasks: none
- Waiting on the human: see docs/NEEDS_HUMAN.md

## Log

<!-- Format:
### YYYY-MM-DD — T07 Stacking game engine (PR #12)
- Summary in one line
- Review rounds: spec 1, quality 2, tests 1
- Notes: anything the next session should know
-->

### 2026-11-07 — T01 Scaffold the app (PR #2)
- Next.js 16 + strict TS, Vitest with coverage thresholds, Playwright, Material 3 tokens generated from a brand seed, UI-guidelines guard test.
- Review rounds: spec 1, quality 1, tests 1 (all approved; non-blocking suggestions applied, rest in T51).
- Notes: `typecheck` runs `next typegen` first (needed for `LayoutProps`). `@material/material-color-utilities` pinned to 0.3.0 (0.4.0 has a broken ESM import). Config constants live in `src/config/`. After changing `BRAND_SEED_HEX`, run `npm run tokens`. Next 16 ships its docs in `node_modules/next/dist/docs/`; check them before using Next APIs.

### 2026-11-07 — Backlog approved, UI guidelines added (PR #1)
- 50-task backlog in 4 milestones approved by the human; `docs/UI_GUIDELINES.md` approved.
