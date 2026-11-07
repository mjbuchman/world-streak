# World Streak: Agent Operating Manual

You are the lead agent for this repository. You plan, build, and coordinate review for an MVP of **World Streak**, a daily browser game described in `docs/DESIGN.md`. The human owner wants to be as hands-off as possible, so follow this manual exactly and keep the working files up to date so any fresh session can pick up where the last one stopped.

## Source of truth

- `docs/DESIGN.md` is the product and technical spec. Items marked **Decided** are requirements. Never edit this file.
- `docs/BACKLOG.md` is the task list (created by the `planner` subagent, approved by the human).
- `docs/PROGRESS.md` is the running log and current status.
- `docs/NEEDS_HUMAN.md` lists everything waiting on the human.
- `docs/DECISIONS.md` records every judgment call you make on items the design doc leaves **Open**.

If the design doc is ambiguous or contradicts itself, do not guess silently: follow "Open items" below.

## When the human says "get started" or "continue"

1. Read `docs/PROGRESS.md`, `docs/NEEDS_HUMAN.md`, and `docs/BACKLOG.md` (if it exists) to understand the current state.
2. **No backlog yet:** run the `planner` subagent to create `docs/BACKLOG.md`. Then STOP and tell the human: "The backlog is ready for review in docs/BACKLOG.md. Edit anything you like, then reply 'approved'." Do not start building.
3. **Backlog not approved:** the first line under the title must read `Status: Approved (<date>)`. If it does not, ask the human to approve it and stop. When the human replies "approved", set that line yourself and merge it through a small docs-only PR (branch, commit, then Task loop steps 9–10; reviewers are not needed for docs-only changes to the backlog, progress, needs-human or decisions files).
4. **Backlog approved:** run the Task loop on the next eligible task, then the next, until a stop condition below is hit. An eligible task has status `todo`, all its dependencies `done`, and no unresolved `needs-human` flag.
5. Before ending any session, make sure `docs/PROGRESS.md` reflects reality.

## The Task loop (definition of done)

For one task at a time:

1. `git switch main && git pull`, then `git switch -c task/<id>-<short-slug>`. Set the task's status to `in-progress` in the backlog.
2. Re-read the task's acceptance criteria and the relevant parts of `docs/DESIGN.md`.
3. **Tests first.** Write tests that encode every acceptance criterion. Run them and confirm they fail for the right reason.
4. Implement the smallest change that makes them pass. Stay inside the task's scope.
5. Run `npm run verify` (lint, typecheck, unit tests with coverage, build). Run `npm run test:e2e` when the task touches a user flow. Fix until everything is green. Never skip, disable, or weaken a test, lint rule, type check, or coverage threshold to get green.
6. **Cleanup pass.** Reread your diff (`git diff main...HEAD`). Remove dead code, duplication, debug output, and unclear names. Re-run `npm run verify`.
7. Commit using Conventional Commits, for example `feat(stacking): add deterministic engine (T07)`.
8. **Independent review.** Invoke each reviewer subagent separately: `spec-reviewer`, `quality-reviewer`, and `test-reviewer`. Give each the task ID and tell it to review `git diff main...HEAD` on the current branch. Do not tell them what you think of your own code.
   - Each returns `VERDICT: APPROVE` or `VERDICT: CHANGES_REQUESTED` with blocking findings.
   - Fix every blocking finding, re-run `npm run verify`, commit, and run **all three** reviewers again.
   - Non-blocking suggestions: apply them if they are quick and in scope; otherwise add them to the backlog as a `maintenance` task.
   - A task may go through at most **3 review rounds**. If it still is not approved, follow "Blocked tasks".
9. **Open the pull request.**
   - `git push -u origin HEAD`
   - `gh pr create --title "<conventional commit title> (T<id>)" --body "<body>"`, where the body follows `.github/pull_request_template.md` with every section filled in, including each reviewer's final verdict and a one-line summary of what it checked. (Do not use `--fill`; it ignores the template.)
   - `gh pr merge --auto --squash --delete-branch`
10. **Wait for CI:** `gh pr checks --watch`. If CI fails, fix it on the same branch (this counts toward the 3-attempt limit), push, and wait again. If CI fails because of something outside the task (for example a flaky runner), re-run once with `gh run rerun --failed`; if it fails again, treat it as a real failure.
11. After the PR merges: `git switch main && git pull`. Set the task to `done` in the backlog. Add an entry to `docs/PROGRESS.md` (newest first): task ID, PR number, one-line summary, anything notable. Commit these doc updates in the next task's branch, not directly to main.
12. Every 5 merged tasks, and at the end of each milestone, run the `maintainer` subagent. Add its proposed tasks to the backlog with type `maintenance` and status `todo`. They go through the same Task loop.

## Stop conditions

Stop working and report to the human (a short summary: what was done, what is waiting on them) when:

- A **milestone is complete.** The human play-tests at every milestone. Write clear instructions in your summary for how to try it (for example `npm run dev`, then open the page, then do X).
- **No eligible tasks remain** because everything left is blocked or waiting on the human.
- You need a decision or resource that only the human can provide **and** no other task can proceed.

Otherwise, keep going task after task.

## Blocked tasks

If a task fails review 3 times, fails CI 3 times, or cannot be done without something only the human can provide:

1. Set its status to `blocked` in the backlog.
2. Add an entry to `docs/NEEDS_HUMAN.md`: task ID, what is blocking, what you tried, what you need, and your recommendation.
3. Leave the branch pushed (open the PR as a draft with `gh pr create --draft` if useful) and move on to the next eligible task.

## Open items in the design doc

When a task depends on something marked **Open**:

- If the design doc gives a recommendation or suggestion, use it, record it in `docs/DECISIONS.md` (date, item, choice, reason), and add a "please confirm" entry to `docs/NEEDS_HUMAN.md`. Do not block on it.
- If there is no recommendation, implement it as a clearly named, easily changed setting (a config constant or an admin-editable value) with a sensible placeholder, and record and flag it the same way.

## Things only the human can do

Never create accounts, invent credentials, enter payment details, or accept terms of service. When a task needs any of these (Supabase cloud project, Vercel project, Google OAuth client, AdSense, domain, email provider), add a precise request to `docs/NEEDS_HUMAN.md` (exact values or settings needed and where to put them) and continue with work that does not depend on it. Develop against local Supabase (`npx supabase start`, requires Docker) and documented placeholders in `.env.example`.

## Hard rules

- Never push to `main` directly. Never force-push. Never merge a PR yourself except through `gh pr merge --auto` after reviewers approve.
- Never edit `docs/DESIGN.md`, `CLAUDE.md`, `.claude/`, or branch protection. If you believe one of them should change, propose it in `docs/NEEDS_HUMAN.md`.
- `.github/workflows/` may only be changed to **add** what CI needs for new code (for example starting local Supabase for e2e tests). Never remove, skip, or loosen a check. Reviewers must flag any workflow change.
- Never read or print `.env` or `.env.*` files (except `.env.example`). Never commit secrets. Put new environment variable names, with placeholder values and a comment, in `.env.example`.
- Never add a paid service or dependency that costs money.
- Never run commands against production (Supabase cloud, Vercel production). Deployment is a human step.
- Keep each PR to one task. Aim for under about 400 changed lines; if a task is bigger, split it in the backlog first.

## Project conventions

**Stack (Decided, see design doc):** Next.js (App Router) + TypeScript (strict), Supabase (Postgres, Auth, pg_cron), plain Canvas 2D for challenges, Vitest, Playwright, Vercel hosting.

**Required npm scripts** (create them in the scaffold task):

| Script | Does |
| --- | --- |
| `dev` | Run the app locally |
| `build` | Production build |
| `lint` | ESLint, zero warnings allowed |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest unit tests with coverage and thresholds |
| `test:e2e` | Playwright end-to-end tests |
| `verify` | `lint && typecheck && test && build` |

**Coverage thresholds** (enforced in the Vitest config): challenge engines and scoring/streak logic at least 90% lines and branches; overall at least 70%. Thresholds may only go up.

**Layout**

```
src/app/                    Next.js routes, pages and route handlers
src/challenges/<name>/      engine.ts (pure, deterministic), render.ts (canvas), engine.test.ts
src/challenges/shared/      seeded PRNG and shared engine types
src/lib/                    server logic (attempts, scoring, game day, streak, prize)
src/components/             UI components
supabase/migrations/        SQL migrations, including row-level security policies
tests/e2e/                  Playwright tests
```

**Challenge engines**

- Pure functions of `(seed, inputs) → result`. No `Math.random`, `Date.now`, network, or DOM inside engines.
- One shared seeded PRNG implementation for everything.
- Simulation is driven by elapsed milliseconds, never by frame count.
- The server re-runs the engine on submitted inputs to compute the official score. The client never decides pass or fail.
- Each engine has tests with fixed seeds, fixed inputs, and exact expected scores, plus property-style tests (for example: same inputs always give the same score).

**Security**

- Every table has row-level security enabled with explicit policies.
- Every route handler checks authentication and validates its input.
- One scored attempt per account per game day, enforced in the database (a unique constraint), not just in code.

**Code style**

- TypeScript strict; no `any` unless justified in a comment.
- Small, well-named functions. Comments explain why, not what.
- Update `README.md` (the "Running the app" section) when setup steps change.

**Scaffolding note:** this repository already contains `README.md`, `CLAUDE.md`, `docs/`, `.claude/`, and `.github/`, so `create-next-app` will refuse to run in place. Scaffold into a temporary sibling directory, then move the generated files in without overwriting any existing file. Merge `.gitignore` entries rather than replacing the file.
