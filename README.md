# World Streak

A daily browser game where the whole world shares one streak, built by a team of AI agents with automated and independent review on every change. The game itself is specified in [`docs/DESIGN.md`](docs/DESIGN.md).

This README is for you, the human owner. The agents' instructions live in [`CLAUDE.md`](CLAUDE.md).

---

## How the system works

```
                you approve the plan once per milestone
                                │
  docs/DESIGN.md ──► planner ──► docs/BACKLOG.md
                                │
              ┌─────────────────┴──────────────────┐
              │  for each task (lead agent):        │
              │  1. write tests first               │
              │  2. write code until tests pass     │
              │  3. npm run verify (lint, types,    │
              │     tests + coverage, build)        │
              │  4. three independent reviewers:    │
              │     spec · quality/security · tests │
              │     (fix and re-review, max 3x)     │
              │  5. pull request with auto-merge    │
              │  6. GitHub CI must pass to merge    │
              └─────────────────┬──────────────────┘
                                │
          every 5 tasks: maintainer proposes cleanup tasks
                                │
           milestone done ──► you play-test ──► next milestone
```

**Three layers check every change:**

1. **Automated checks** run locally and again in GitHub CI: lint, type checking, unit tests with enforced coverage thresholds, end-to-end tests, and a production build. GitHub will not merge anything that fails.
2. **Three independent AI reviewers**, each with a fresh context, read-only access, and a different focus: does it meet the spec, is the code correct and secure, and would the tests actually catch bugs.
3. **You**, at a few checkpoints: approving the backlog, providing accounts and keys, answering flagged questions, and play-testing each milestone.

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | Rules and workflow for the lead agent (read automatically by Claude Code) |
| `.claude/agents/` | The planner, three reviewers, and the maintainer |
| `.claude/settings.json` | Commands agents may run without asking, and commands they may never run |
| `.github/workflows/ci.yml` | The CI checks GitHub runs on every pull request |
| `docs/DESIGN.md` | The game design and technical spec |
| `docs/BACKLOG.md` | Task list (created by the planner, approved by you) |
| `docs/PROGRESS.md` | What has been done; where things stand |
| `docs/NEEDS_HUMAN.md` | Everything waiting on you |
| `docs/DECISIONS.md` | Judgment calls agents made on open design questions |

---

## One-time setup (about 30–45 minutes)

### 1. Install the tools

- **Node.js** (current LTS version) and **Git**
- **GitHub CLI**, then sign in: `gh auth login`
- **Docker Desktop**, running (used for a local Supabase database, so no cloud account is needed to start)
- **Claude Code**: follow the official install guide at https://docs.claude.com/en/docs/claude-code/overview

### 2. Create the GitHub repository

From inside this folder:

```bash
git init
git add .
git commit -m "chore: agent workflow kit"
git branch -M main
gh repo create world-streak --private --source=. --push
```

This first push to `main` also runs CI once, which makes the `verify` and `e2e` checks available for the next step. Wait for it to finish (`gh run watch`).

### 3. Turn on auto-merge

On GitHub: **Settings → General → Pull Requests**, then tick:
- **Allow auto-merge**
- **Automatically delete head branches**

### 4. Lock the main branch (this is what makes the system safe)

On GitHub: **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.

- **Ruleset name:** `protect main`
- **Enforcement status:** Active
- **Bypass list:** leave empty (so not even your own account, which the agent uses, can skip the rules)
- **Target branches:** Add target → Include default branch
- Tick these rules:
  - **Restrict deletions**
  - **Require a pull request before merging**, with required approvals set to **0**
  - **Require status checks to pass**, then add `verify` and `e2e`
  - **Block force pushes**
- Click **Create**.

Why 0 approvals: the agent opens pull requests using your GitHub login, and GitHub does not let anyone approve their own pull request. The three AI reviewers run before the pull request is opened, and their verdicts are recorded in each pull request description. CI is the hard gate.

### 5. Accounts you will need later (no need to do these now)

The agents will add precise requests to `docs/NEEDS_HUMAN.md` when they reach these:

- A **Supabase** cloud project (free plan) for the hosted database
- A **Vercel** account linked to the repository, for previews and hosting
- A **Google OAuth** client for Google sign-in
- Later, for public launch: a domain, an email provider, and Google AdSense

---

## Running the agents

Open a terminal in the repository and start Claude Code:

```bash
cd path/to/this/folder
claude
```

Then type:

```
get started
```

**What happens next:**

1. **The planner writes `docs/BACKLOG.md` and the agent stops.** Read it, edit anything you like, then reply `approved`. This is your main steering point; small, clear tasks make everything after it go better.
2. **The agent works through tasks on its own**, opening a pull request for each one, and stops when a milestone is finished (or when everything left is waiting on you).
3. **Play-test** using the instructions it gives you, then reply `continue`.

**Checking in while it works:**

- `docs/PROGRESS.md` for what is done
- `docs/NEEDS_HUMAN.md` for anything waiting on you
- Your repository's **Pull requests** tab, including from your phone

**Resuming:** if a session ends, slows down, or you close it, start a new Claude Code session in the folder and type `continue`. Everything the agent needs is in the repository files.

**Permissions:** Claude Code asks before running any command that is not on the allow list in `.claude/settings.json`. When it asks about something clearly safe, you can choose to allow it from then on. Commands on the deny list (force-pushing, pushing to main, touching production) are always refused, and the GitHub ruleset blocks them anyway.

---

## Your checkpoints, summarized

| When | What you do |
| --- | --- |
| Once, at the start | Setup above |
| Each new plan | Review and approve `docs/BACKLOG.md` |
| Whenever `NEEDS_HUMAN.md` has items | Create accounts, paste keys into `.env.local`, or answer questions |
| End of each milestone | Play-test and reply `continue` (or describe what to change) |
| Before going live | Deploy to production (agents never touch production) |

## Costs and limits

- Each task runs the lead agent plus three reviewers, so usage adds up. Watch your Claude usage during the first milestone to get a feel for the cost per task.
- Hosting and database stay on free plans during development (see `docs/DESIGN.md`, Hosting costs).

## Running the app

Requires Node.js 22.18 or newer (current LTS recommended), npm, and Docker Desktop (running) for the local database.

**First time:**

```bash
npm install                      # install dependencies (includes the Supabase CLI)
npm run db:start                 # start local Supabase in Docker (first run downloads images)
cp .env.example .env.local       # then fill in the values, see below
```

Fill in `.env.local` from the output of `npx supabase status`: copy **API URL** to `NEXT_PUBLIC_SUPABASE_URL`, the **anon key** to `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the **service_role key** to `SUPABASE_SERVICE_ROLE_KEY`. These are local-only development keys.

**Windows PowerShell:** if `npm` or `npx` fails with "running scripts is disabled on this system", use `npm.cmd` and `npx.cmd` instead (for example `npm.cmd run dev`). They are the same tools, and no security setting needs changing.

**Google sign-in (optional):** without it everything else works; only "Continue with Google" needs it.

1. In [Google Cloud Console](https://console.cloud.google.com) (free), create a project, then an **OAuth consent screen** (audience **External**, left in **Testing**, with your own Gmail added as a **test user**).
2. Create an **OAuth client** of type **Web application** with the authorised redirect URI `http://127.0.0.1:54321/auth/v1/callback`. Copy its client ID and client secret. Never commit them.
3. Local Supabase reads them from the shell it starts in (not from `.env.local`), and only when it starts. In PowerShell:

   ```powershell
   $env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID = "<client id>"
   $env:SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET = "<client secret>"
   npx.cmd supabase stop
   npm.cmd run db:start
   ```

   On macOS or Linux (bash): `export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client id>` and `export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client secret>`, then `npx supabase stop` and `npm run db:start`.

   To keep them for every new PowerShell window, run `setx SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID "<client id>"` and `setx SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET "<client secret>"` once, then open a new window (`setx` does not change the window it runs in). This stores the secret for your Windows user account, where every program you start can read it; that is fine for a local test client. Remove it with `setx SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET ""` or under System Properties > Environment Variables.
4. Check: on `/signin`, "Continue with Google" leads to Google, then (for a new account) to "Finish setting up your account", then home, signed in. If Google says "The OAuth client was not found", Supabase started without the keys: set the two variables, then stop and start Supabase again, all in that same window.

Deployment will need a second redirect URI for the hosted Supabase project.

**Every time:**

```bash
npm run db:start                 # if Docker was restarted
npm run dev                      # start the app at http://localhost:3000
```

http://localhost:3000/api/health should return `{"db":"ok"}`. Local Supabase Studio (a database browser) is at http://127.0.0.1:54323. `npm run db:reset` wipes the local database and re-applies every migration in `supabase/migrations/`.

**Fake players (to watch the meter move):**

```bash
npm run seed:dev -- --players 200 --pass-rate 0.7                    # today: 200 players, 140 pass
npm run seed:dev -- --players 50 --pass-rate 0.4 --date 2026-11-01   # another (open) day
```

It creates fresh fake accounts (`seed-…@example.test`, with profiles) and submitted attempts, so the day's counters and the meter on http://localhost:3000 change at once. Run it again to add another batch. It refuses a day that is already closed. It reads `.env.local` and refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` is localhost, so it can never touch a real project. The meter shows its numbers right up to the deadline (to hide them in the final hours again, set `METER_HIDE_HOURS` in `src/config/meter.ts`). `npm run db:reset` removes every fake player. Each player takes a moment to create, so 200 take about a minute.

**The daily close:** the database closes each game day itself at the midnight UTC deadline (a `pg_cron` job, with a catch-up run every 5 minutes), recording the outcome, updating the world streak and preparing the next day. Locally this means past days close on their own within 5 minutes of `npx supabase start`. To close one by hand and see the result:

```bash
npm run close-day -- --date 2026-11-10   # prints e.g. "2026-11-10 survived. World streak: 3 (best 5)."
```

Only a day whose deadline has passed can close, and days close in order (close earlier ones first). Closing a closed day again just prints its outcome. Like `seed:dev`, it reads `.env.local` and refuses anything but a localhost URL.

**Play-testing a prize cycle and the draw:** start from a fresh database, then simulate the cycle's days:

```bash
npm run db:reset
npm run simulate:days -- --from 2027-01-01 --days 30 --players 50 --pass-rate 0.8
```

It closes the empty days before `--from` (broken), creates 50 fake players, and for each day lets all of them play (80% pass, earning entries) and closes it, ahead of its deadline. Afterwards the world streak is 30 and cycle 1 has reached its goal on 2027-01-30 (check `/` and `/admin`). The draw opens only once a won cycle's last day is in the real past, so to try it, move cycle 1 into the past right after the reset (Studio's SQL editor at http://localhost:54323: `update cycles set start_date = '2026-08-01', end_date = '2026-09-29' where number = 1;`), run `npm run simulate:days -- --from 2026-08-01 --days 60 --players 50 --pass-rate 0.8`, then open `/admin/draw` as the admin. It refuses a day before `--from` that someone has played, and a day from `--from` on that is already closed: run `npm run db:reset` first. It changes past and future days for good, so run `npm run db:reset` again when you are done. Like the other scripts, it refuses anything but a localhost URL.

**Admin page:** sign in as `admin@local.test` with the password `admin-local-only` and open http://localhost:3000/admin to see today and the next 7 game days. That account comes from `supabase/seed.sql`, which `npm run db:reset` applies. To add it without wiping your local data, run `npx supabase db query -f supabase/seed.sql`. It exists only locally; everyone else gets a 404 at `/admin`. Against the local Supabase, `/admin` also has **Local tools**: set a day's challenge, clear your own attempt today (to play again), reset an open day, restore the rotation, seed fake players, close a day and remove the fake players. They do what the commands below do, so you need not remember those.

**Checks** (the same ones CI runs):

```bash
npm run verify                   # lint, typecheck, unit tests with coverage, production build
npm run test:db                  # database tests (pgTAP) against local Supabase
npx playwright install chromium  # once, to download the test browser
npm run test:e2e:local           # end-to-end tests against local Supabase (starts the app automatically)
```

`npm run test:e2e:local` reads the local Supabase URL and keys from `npx supabase status` itself, so it needs no `.env.local`. It refuses to run if the URL is not localhost or local Supabase is stopped. It always starts its own app server on port 3100, so it never reuses or clashes with an `npm run dev` on port 3000. Extra arguments go to Playwright, for example `npm run test:e2e:local -- tests/e2e/practice.spec.ts`. CI uses plain `npm run test:e2e` with the keys already in its environment. During a run the daily rotation is pinned to the Tower and put back at the end; if a run is killed part-way, restore it with `npx supabase db query "update public.game_settings set rotation = '{stacking,inner-clock,flash-count}'"`.

**Meter load test:** the meter endpoint keeps its own reading for each cache window, so however many requests reach it, the database is read once per window; if the database fails it answers the last good reading (marked `stale`) for up to 5 minutes, then 503. To measure it under load against a local production build:

```bash
npm run build
npm run start -- -p 3200         # in one terminal
npm run load:meter               # in another: 200 connections for 30 s, prints p50, p95 and p99
```

It refuses any server but localhost (`LOAD_URL` picks another local port). Target: p95 under 200 ms locally. Baseline (Nov 12, 2026, Windows dev machine, one Node process, no CDN): about 1,500 requests/s, p50 63 ms, p95 403 ms, p99 574 ms, no errors, so the target is not met here yet. In production the CDN answers most meter requests (`s-maxage=30`), so few reach the server.

**Theme:** the Fresh Sport colours, gradients, shapes, type, spacing and motion are CSS variables in `src/app/tokens.css`. The colours are listed once more in `src/lib/theme/palette.ts`, where a unit test checks text contrast and that the two stay identical, so change both together. Shared UI pieces (buttons, back button, spinner, surfaces, page shell) live in `src/components/ui/`. The design rules are in [`docs/UI_GUIDELINES.md`](docs/UI_GUIDELINES.md).
