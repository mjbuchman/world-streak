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

Requires Node.js (current LTS) and npm.

```bash
npm install                      # install dependencies
npm run dev                      # start the app at http://localhost:3000
```

**Checks** (the same ones CI runs):

```bash
npm run verify                   # lint, typecheck, unit tests with coverage, production build
npx playwright install chromium  # once, to download the test browser
npm run test:e2e                 # end-to-end tests (starts the app automatically)
```

**Theme:** colors, shapes, type and spacing come from `src/app/tokens.css`, which is generated from one brand color. To change the brand color, edit `BRAND_SEED_HEX` in `src/config/theme.ts`, then run `npm run tokens`. The design rules are in [`docs/UI_GUIDELINES.md`](docs/UI_GUIDELINES.md).
