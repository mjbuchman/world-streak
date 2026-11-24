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

Older entries (everything up to Nov 19, 2026) are in `docs/archive/BACKLOG-to-2026-11-19.md`. Search it only when you need history. All tasks not listed here are done or dropped.

## Batches

One branch, review round and PR per batch, in this order (dependencies still apply).

M9 New games: Bank Shot and Arrow Flip (planned Nov 22, 2026; approved Nov 24, all proposals as written; the daily lineup stays 3 games, now drawn from a pool of 7). The owner wants an MVP first: build each game playable on its practice page only, then stop for the owner's play-test before any registration, migration, cheat check or pool work.

Phase 1, practice-only MVP (then stop for the owner's play-test):

- M9-a. Bank Shot geometry and engine: T230, T231 (full: scoring)
- M9-b. Bank Shot renderer, game and practice page: T232, T233, T245 (light)
- M9-c. Arrow Flip engine, input, renderer, game and practice page: T236, T237, T238, T246 (full: scoring)

Phase 2, only after the owner says they like the games (apply their tweaks first):

- M9-d. Registration, migrations and cheat checks: T234, T235, T239, T240 (full: migration, scoring)
- M9-e. Pool, admin, end-to-end and phone checks, docs: T241, T242, T243, T244 (full: migration; T244 is docs only)

M8 M7 play-test tweaks (Nov 19, 2026; approved Nov 19 (2 lives, 25 dots, score hidden everywhere for bank games); runs before batch 19):

- M8-a. Second Sense, Swift Sum and Trail Trace tuning: T217, T218, T219, T220 (full: scoring, migration)
- M8-b. Clean Cut blobs and irregular polygons: T221, T222, T223 (full: scoring, migration)
- M8-c. Round counter and results window: T224, T225 (light)
- M8-d. M8 end-to-end checks and docs: T226, T227 (light; T227 is docs only)

Maintenance after M7: T215 (full: scoring tests), T216 (light); after M8.

Maintenance after M8: T228 then T229 (light), after the M8 play-test.

## Open tasks waiting on the owner

### T128 Keep .env.example in step with the code
- Type: maintenance
- Status: todo
- Depends on: T50, and the human adding the pending `.env.example` lines (NEEDS_HUMAN: T32, T44)
- Acceptance criteria:
  - [ ] A unit test fails when non-test `src/` reads a `process.env.X` (other than `NODE_ENV`) that `.env.example` does not list, and names the missing variables.
  - [ ] The README "Running the app" section uses the same variable names and commands as `.env.example`, `package.json` and `docs/DEPLOYMENT.md`; fix any mismatch.
  - [ ] `npm run verify` passes; no product behaviour changes.
- Notes: From the maintainer check after M4. Agents cannot edit `.env.example` (permission settings), so the test lands once the human has added `NEXT_PUBLIC_SITE_URL` and the three ad variables; until then it would fail.

### T45 Wire Google AdSense
- Type: infra
- Status: todo
- Depends on: T44
- Acceptance criteria:
  - [ ] With the human's publisher ID set in the deployment environment, the AdSense script and slot markup use it, and `public/ads.txt` contains the correct `google.com, pub-XXXXXXXX, DIRECT, f08c47fec0942fa0` line.
  - [ ] README documents enabling ads (env values, ads.txt) and the reminder that ads require Vercel Pro (commercial use).
- Notes (from the T44 reviews): the AdSense script loads on every page once ads are live, practice included (no slots there), so keep AdSense auto-ads off in the account or load the script only on pages with slots; the per-slot inline push script may not re-run on client-side navigation, so check slots fill after navigating back; `NEXT_PUBLIC_` values need a rebuild and redeploy to change.
- needs-human: An approved Google AdSense account for the site's domain, its publisher ID (`ca-pub-...`) for `NEXT_PUBLIC_ADSENSE_CLIENT`, ad unit slot IDs if using manual units, and the decision to switch to Vercel Pro before ads go live.

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

## M9 New games: Bank Shot and Arrow Flip

Planned Nov 22, 2026 from the owner's request to add two games to the daily pool, after which the MVP is done. The owner chose the two games and their one-line ideas; every number and rule detail below marked "proposal" is an agent proposal, recorded as "owner to confirm" (T244).

Goal: play-test two new games. Practice Bank Shot (watch a puck bounce, then tap where it will cross the finish line) and Arrow Flip (swipe the direction the cue asks for, the word or the arrow) at `/practice/bank-shot` and `/practice/arrow-flip`, on a phone and on a desktop; both turn up in the daily lineup rotation with the five existing games, are scored by the server, and hide their score like the other bank games.

Planning notes for M9:

- **Stored keys and names:** `bank-shot` and `arrow-flip` (folders, routes, flag names and `challenge_types` values follow them, as T199 set). Shown names "Bank Shot" and "Arrow Flip" are the owner's; the "original names, not those of existing games" rule in `src/config/challenges.ts` means the owner should confirm neither clashes with a known game (T244).
- **Both are bank games** (the rule in `src/challenges/shared/bank.ts`): `playBank` and `bankScore`, score = whole rounds survived plus the bank left as a fraction, `direction "higher-better"`, `challengeUi.showScore` false, default pass target 5 ("survive all five"), editable in `/admin`. No `scores_since` reset is needed: a new type has no old-scale scores.
- **Same rules as every game:** pure deterministic engine (`createRng` only; no `Math.random`, `Date.now`, DOM, network), simulation driven by elapsed ms, the server re-runs the engine on the submitted inputs and the client never decides pass or fail, the 3-2-1 before every round (`RUN_COUNTDOWN_MS`), `RoundProgress` numbered counter, `BankGauge`, `useRevealRounds` or the game's own frame loop (`runFrames`) as the model needs, `lastInputMs` and a schema bound on every input array, `finished`, practice page through `PracticeShell`, Fresh Sport look per `docs/UI_GUIDELINES.md` (no emojis, no em dashes, real buttons with visible focus, no colour as the only cue), and rule 8 (no back button during a run).
- **Models to copy:** `src/challenges/fair-split/` (bank, per-round countdown, outcome type, canvas, keyboard fallback), `src/challenges/flash-count/` (round reveal), `src/components/fair-split/FairSplitGame.tsx`, `src/app/practice/fair-split/`, `supabase/migrations/20261116030000_fair_split.sql` and `supabase/tests/fair_split.test.sql`.
- **Every place that lists the games** must learn the two new keys; a grep for `fair-split` and `FairSplit` under `src/`, `supabase/`, `scripts/` and `tests/` is part of each registration task (the `ChallengeType` union and `satisfies Record<ChallengeType, ...>` checks catch most at typecheck: `CHALLENGE_TYPES`, `CHALLENGES`, `CHALLENGE_UI`, `CHALLENGE_NAMES`, `CHALLENGE_TAGLINES`, `detect.ts`, `adminSettings`, `localTools`, the `gameSettings.fixture.json` drift guard, `seed:dev`, `simulate:days`).
- **The pool migration comes last (T241)** so the committed lineups in `supabase/tests/lineups.test.sql` are re-pinned once, not twice. Until then the two games are practice-only and no day can draw them (admins can still hand-place them after T234 and T239 through the lineup editor, which reads `challenge_types`).
- **Open items:** none in the design doc covers these games. The numbers below are proposals; each is an exported, easily changed constant and each needs an "owner to confirm" line in `docs/DECISIONS.md` and `docs/NEEDS_HUMAN.md` (T244). `docs/DESIGN.md` is not edited (NEEDS_HUMAN "please update DESIGN.md": its pool table lists five games).

### T230 Bank Shot: reflection geometry (pure)
- Type: feature
- Status: in-progress
- Depends on: T08
- Acceptance criteria:
  - [ ] `src/challenges/bank-shot/geometry.ts` exports pure helpers with no engine state: `reflect(direction, normal)` (exact vector reflection), `unfoldedX(x0, vx, t, width)` (a puck's x after bouncing off two vertical walls, by the triangle-wave unfolding, not by stepping), `crossingTime`, and `traceStraight(start, velocity, board)` returning the list of wall hit points (`{ x, y, atMs }`) and the finish-line crossing (`{ x, atMs }`). The board is `BOARD_W` = 100 by `BOARD_H` = 150 units (proposal), the puck starts on the bottom edge, the finish line is the top edge (y = 0).
  - [ ] Exact tests (values worked out by hand, independent of the code): a puck from (50, 150) with velocity (0.02, -0.1) per ms crosses the top at x = 80 at 1 500 ms with no bounce; from (50, 150) with velocity (0.05, -0.1) it hits the right wall at (100, 50) at 1 000 ms and crosses at x = 75 at 1 500 ms; from (20, 150) with velocity (-0.1, -0.1) it hits the left wall at (0, 130) at 200 ms, the right wall at (100, 30) at 1 200 ms and crosses at x = 70 at 1 500 ms; `reflect` of (1, -1) off a vertical wall is (-1, -1) and off a horizontal one (1, 1); speed is preserved through every bounce to 1e-9.
  - [ ] Property tests over seeds 0 to 999 (random starts and angles drawn with `createRng`): the closed form `unfoldedX` and a brute-force 1 ms stepping trace agree on the crossing x within 0.2 units; the crossing x is always inside 0 to `BOARD_W`; the number of wall hits equals the count from the closed form; a shot aimed exactly at a corner is nudged or rejected deterministically (documented), never ambiguous.
  - [ ] A `rotatingBar(center, length, omegaPerMs, phase)` helper returns the bar's endpoints at a given elapsed ms, and `barHit(prev, next, bar, atMs)` returns the contact point and the exact reflected velocity by segment intersection (or none); tests for a head-on hit on a bar at a fixed angle, a miss, and a hit on the bar's end. Reflection off a rotating bar uses the bar's normal at the hit tick (the bar's own surface speed is ignored, a documented simplification; proposal).
  - [ ] At least 90% lines and branches in the file.
- Notes: About 300 lines. No physics library; the closed form is what makes the server replay cheap and exact. The stepping trace exists only inside tests and for the spinning bumper (fixed 1 ms ticks, so the result depends on elapsed ms, never on frame count). Light review is not enough here because the engine builds on it: part of batch M9-a, full review (scoring).

### T231 Bank Shot engine: five rounds against a bank of distance missed
- Type: feature
- Status: in-progress
- Depends on: T230, T180
- Acceptance criteria:
  - [ ] `src/challenges/bank-shot/engine.ts` implements `ChallengeModule` with `direction "higher-better"`, `ROUNDS` = 5 and a `BANK_UNITS` bank (proposal: starts at 30, final value set by the simulation test below). `paramsFromSeed(seed)` returns per round `{ start, velocity, bounces, glimpseMs, bumper? }` with bounces 1, 1, 2, 3, 4 (proposal), the glimpse shortening 1 600, 1 400, 1 200, 1 000, 800 ms (proposal), and a spinning bar bumper in rounds 4 and 5 only (proposal); each round's real crossing x is derived by the geometry, never stored in the params the client receives beyond what the render needs (the client could compute it anyway, which is why the server, not the client, decides pass or fail).
  - [ ] Rounds are valid by construction: crossing x between `EDGE_MARGIN` (proposal 6) and `BOARD_W - EDGE_MARGIN`, no bounce within 4 units of a corner, the right number of bounces, a bumper hit (rounds 4 and 5) that happens before the last wall bounce is not required, but the crossing must still be reached within `MAX_FLIGHT_MS`. A seed with no valid draw in 20 tries falls back to a fixed shot (documented); a test forces the fallback.
  - [ ] Inputs `{ taps: { round, atMs, x }[], endMs }`. Timing, as in Clean Cut: round k's puck launches `ROUND_COUNTDOWN_MS` (the 3-2-1) after the previous round's reveal ended, the glimpse ends `glimpseMs` after launch, and a tap before the glimpse ended is ignored. A tap costs `|x - crossingX|` (0.01 steps, tested); a round with no tap by `TAP_LIMIT_MS` (proposal 10 000) after the glimpse costs `BOARD_W` (no bank survives it); `SHOW_MS` (1 200) shows the real path before the next 3-2-1. Costs run through `playBank`; a cost equal to what is left survives.
  - [ ] Score = `bankScore(survived, left, BANK_UNITS)`. Exact tests with explicit params: taps exactly on every crossing score 5 + 1 = 6; misses of 2, 3, 4, 5, 6 units on a 30 unit bank score 5 + 10 / 30 = 5.333; a miss of exactly what is left survives and one 0.01 above ends the run; no tap in round 1 scores 0; a tap before the glimpse ends is ignored and a later tap counts; taps of rounds past the run's end are ignored.
  - [ ] `finished`, `lastInputMs` (`endMs`) and a schema bound (`taps.max(ROUNDS)`, `x` within 0 to `BOARD_W`, rising `atMs`, `endMs` not before the last tap). Determinism (same seed and inputs, same score), range (seeds 0 to 999: score within 0 to ROUNDS + 1), a golden test for 3 seeds, and a test that the engine source has no `Math.random`, `Date.now` or DOM (as `lintRules.test.ts` already does for the others).
  - [ ] Simulation test: a careful simulated player aims at the true crossing with Gaussian error of standard deviation `0.9 + 0.8 x bounces` units, spinning-bar rounds adding 2 (proposal; the builder may re-shape the model but documents it) and taps 3 s after the glimpse. Over 2 000 seeds, 40 to 60% survive all five; `BANK_UNITS` is set from this and the band is asserted. A looser player (twice the error) survives under 15% and a perfect one 100%.
  - [ ] At least 90% lines and branches.
- Notes: About 380 lines (split the simulation test into its own file if the diff nears 400). The bank is distance missed, as Clean Cut's is points off half. Proposal: five rounds, target "survive all five" (owner to confirm the bank size, bounce and glimpse ladders, the spinning bumper in rounds 4 and 5, and that the simulated-player model is a fair proxy; real play-test numbers should replace it). Full review (scoring).

### T232 Bank Shot renderer
- Type: feature
- Status: todo
- Depends on: T231, T135
- Acceptance criteria:
  - [ ] `src/challenges/bank-shot/render.ts` draws, from state and elapsed ms alone: the board with its walls, the finish line along the top, the puck and a fading trail during the glimpse, the spinning bumper (visible the whole round, rotating by elapsed ms), the player's marker on the finish line, and the reveal (the real path, the real crossing point and the miss as a labelled distance) after the tap. Colours come from the canvas token helper (T135); the marker, the real crossing and the walls differ by shape and label as well as colour; reduced motion drops the trail fade and the bumper's spin animation for a static bar plus its angle label, never the pass or fail information.
  - [ ] Pure helpers: `boardLayout(canvasW, canvasH)` fits the 100 x 150 board in the canvas with margins, `toBoard(layout, px, py)` and `toCanvas(layout, x, y)` round trip within 0.01 units at 5 canvas sizes including 390 x 560, `markerX(layout, px)` clamps a canvas x to the finish line, and a `puckAt(params, round, elapsedMs)` function used by both the renderer and tests returns the puck position (using T230 helpers).
  - [ ] Tests: puck positions at 0, 500 and the glimpse end match T230's hand-computed trace; at glimpse end plus 1 ms nothing is drawn for the puck (a recording canvas mock); the bumper's angle at 0 and 1 000 ms; each mapped marker x from 0 to 100 stays on the line; the finish line is at least 44 CSS px tall as a tap strip at 390 px wide (asserted from the layout numbers).
- Notes: About 330 lines. Fresh Sport look per `docs/UI_GUIDELINES.md`. Light review in a full-review batch (scoring files nearby).

### T233 Bank Shot game component
- Type: feature
- Status: todo
- Depends on: T232, T137, T178, T179
- Acceptance criteria:
  - [ ] `src/components/bank-shot/BankShotGame.tsx` (not yet wired in; uses `runFrames`): the 3-2-1 before every round, the launch and glimpse, a tap or drag on the canvas that places the marker on the finish line (a tap anywhere on the board maps to its x; the marker can be moved again before locking), a 44 px or taller "Lock in" button and the Enter key that commit the guess (proposal: place, then lock, so a fat finger can correct itself), the reveal for `SHOW_MS`, then the next round. The Left and Right arrow keys move the marker by 1 unit (Shift: 5) and Enter locks, so it is playable without a pointer. Taps before the glimpse ends are ignored.
  - [ ] `RoundProgress` (T178), a `BankGauge` (T179) with the bank in units to one decimal ("18.5 left") and the numbered round counter (M8); no score or crossing distance is shown during play beyond the reveal's own miss; on a bust the run ends with the real path shown for `SHOW_MS`.
  - [ ] It reports `{ taps, endMs }` (each `atMs` from the game's start, so the 3-2-1s are inside it) when the run ends, including a round that timed out at `TAP_LIMIT_MS`.
  - [ ] Unit test with mocked time: one good round (marker locked on the crossing), one timeout, a bust; the marker keys; a tap during the glimpse changes nothing. The canvas has `touch-action: none`, a `role="img"` name and a status line for assistive tech ("Round 2 of 5"), and focus is visible on the button.
- Notes: About 380 lines. Full review (attempts, since it produces the submitted inputs). Part of batch M9-b.

### T234 Bank Shot: registration, practice page and migration
- Type: feature
- Status: todo
- Depends on: T233, T109
- Acceptance criteria:
  - [ ] `CHALLENGE_TYPES`, the registry, `challengeUi` (`showScore: false`, `bankSummary(ROUNDS, "rounds")`, `bankTarget`), `CHALLENGE_NAMES` ("Bank Shot"), `CHALLENGE_TAGLINES`, `BANK_SHOT_HOW_TO` and the how-to / `challengeUi` wording gain `bank-shot` (for example "Watch the puck bounce. It vanishes. Tap where it will cross the finish line, then lock in. Every unit you miss by comes out of one bank; survive all five rounds to pass."). Every other place that lists the games is updated (the grep in the planning notes); all tests for them are extended without being weakened.
  - [ ] A migration adds `challenge_types` `bank-shot` / `higher-better` and `default_pass_targets` `"bank-shot": 5` (both the existing row's value and the column default), with the `game_settings` pool left unchanged (T241). pgTAP: the type row exists with direction `higher-better`, the settings default holds 5, `ensure_game_day` still creates three games from the unchanged pool, an admin can hand-place `bank-shot` into an unstarted day's lineup, and RLS on `challenge_types` is unchanged (still readable by everyone, no client writes).
  - [ ] `/practice/bank-shot` (route folder `src/app/practice/bank-shot/`) uses `PracticeShell`, works signed out with no `/api/attempts` calls, shows "rounds survived" and pass or fail (no score), and the practice hub lists it with its tagline. `npm run db:types`, `npm run verify` and `npm run test:db` pass.
  - [ ] Unit tests for `BankShotPractice` (a bust and a full pass with mocked inputs), `challengeUi` (no score shown for `bank-shot`), the hub list and `isChallengeType`.
  - [ ] `seed:dev` and `simulate:days` can record a `bank-shot` attempt with a valid score; the local-tools lineup setter accepts it.
- Notes: About 350 lines. Full review (migration, attempts). Not in the daily rotation until T241. A new type needs no `scores_since`.

### T235 Bank Shot: cheat checks
- Type: feature
- Status: todo
- Depends on: T231, T234
- Acceptance criteria:
  - [ ] `src/config/cheat.ts` gains placeholder thresholds (proposal, judgment call to record): `BANK_SHOT_PRECISE_ROUNDS` = 3 rounds of one run each within `BANK_SHOT_PRECISE_UNITS` = 0.25 units of the real crossing (a thumb on a phone cannot place a marker that close, and a script can), and `BANK_SHOT_MIN_TAP_AFTER_GLIMPSE_MS` = 250 (a counted tap sooner than this after the puck vanished is faster than a person can read the path and place a guess).
  - [ ] `detectFlags` gains `bank-shot-precise` and `bank-shot-instant`; the generic `timing-mismatch` already covers the new game with the countdown allowance (a test shows it does).
  - [ ] An honest-looking fixture (misses of 3.1, 1.4, 4.8, 2.2, 0.9 units, taps 1.5 to 4 s after the glimpse) has no flags; each rule has a positive and a negative test asserting the whole flag list; the rules never fire for another game's attempts and the other games' fixtures stay flag-free. Thresholds are checked against the T231 simulated careful player: it raises no flag in at least 99% of 2 000 simulated runs.
  - [ ] The submit response shape is unchanged with and without flags; at least 90% lines and branches in `detect.ts`.
- Notes: About 160 lines. Flags only hold prize entries for review; they never change a result or the meter. Light review (the cheat checks do not touch scoring) in a full-review batch.

### T236 Arrow Flip: prompt generator and engine
- Type: feature
- Status: todo
- Depends on: T08, T180
- Acceptance criteria:
  - [ ] `src/challenges/arrow-flip/engine.ts` implements `ChallengeModule` with `direction "higher-better"`, `ROUNDS` = 5, `PROMPTS_PER_ROUND` = 6 (proposal; about 8 s of prompts a round at human pace so a run is 60 to 80 s) and a time bank `BANK_MS` (proposal 6 000, final value set by the simulation test below). `paramsFromSeed(seed)` returns every prompt of the run: `{ arrow, word, cue }` with `arrow` and `word` each one of LEFT, RIGHT, UP, DOWN (arrow as a direction, word as text) and `cue` either `"word"` or `"arrow"`, plus per-round `allowanceMs` and `limitMs`.
  - [ ] Difficulty ladder (proposals, exported constants): the mismatch share (word disagrees with arrow) rises 20%, 30%, 40%, 50%, 60% by round, with the exact number per round fixed (round 1 has 1 of 6 mismatching, round 5 has 4 of 6, positions shuffled by the seeded PRNG) so no seed is luckier than another; the cue is `"word"` for half of each round's prompts and `"arrow"` for the other half, shuffled; no prompt repeats the previous prompt's answer, so a player cannot just repeat a swipe; `allowanceMs` (the time a correct answer may take before the bank drains) 1 400, 1 200, 1 000, 900, 800 and `limitMs` (no answer by then counts as a miss) 2 400, 2 100, 1 800, 1 600, 1 400.
  - [ ] Inputs `{ answers: { prompt, atMs, dir }[], endMs }`. Timing: the run opens with the 3-2-1; each round opens with its own 3-2-1 (`RUN_COUNTDOWN_MS`, as every game), prompt k+1 appears `PROMPT_GAP_MS` (proposal 450) after prompt k was answered or timed out, and a short `FEEDBACK_MS` is part of that gap. The correct answer is the cue's direction (the arrow's direction when the cue is `"arrow"`, the word's when `"word"`). Each prompt's cost: a correct answer costs `max(0, reactionMs - allowanceMs)`; a wrong answer costs `WRONG_COST_MS` (proposal 1 000) plus the same slow part; no answer by `limitMs` costs `TIMEOUT_COST_MS` (proposal 1 500). An answer before the prompt appeared is ignored.
  - [ ] Costs of every prompt of the run go through `playBank`; rounds survived = whole rounds with all their prompts survived (`Math.floor(promptsSurvived / PROMPTS_PER_ROUND)`, capped at `ROUNDS`); score = `bankScore(roundsSurvived, left, BANK_MS)` (a bust mid-round leaves the bank at 0, so the score is the whole rounds before it). Exact tests with explicit params: all 30 prompts answered correctly within the allowance scores 5 + 1 = 6; one wrong answer in round 1 answered at the allowance costs exactly 1 000 and leaves 5 000 / 6 000 (score 5.833); a correct answer 300 ms over the allowance costs 300; a cost equal to what is left survives and 1 ms more ends the run; ending in round 3 with 2 whole rounds done scores 2; a missed prompt costs 1 500; an answer before the prompt appeared is ignored; swiping the word's direction when the cue is "arrow" counts as wrong.
  - [ ] `finished`, `lastInputMs` (`endMs`) and a schema bound (`answers.max(ROUNDS * PROMPTS_PER_ROUND)`, `prompt` an integer in range, `dir` one of four values, rising `atMs`). Determinism, range (seeds 0 to 999: score within 0 to ROUNDS + 1), per-round mismatch and cue counts exact for every seed in 0 to 999, a golden test for 3 seeds, and no `Math.random`, `Date.now` or DOM in the source.
  - [ ] Simulation test: a careful simulated player reacts in 450 to 700 ms plus 100 ms per round of difficulty (documented), and gets a mismatched prompt wrong with probability 4% rising to 14% by round 5 (proposal; the builder documents the model). Over 2 000 seeds, 40 to 60% survive all five; `BANK_MS` and `WRONG_COST_MS` are set from this and the band asserted. A distracted player (three times the wrong rate) survives under 15%.
  - [ ] At least 90% lines and branches.
- Notes: About 400 lines (split the simulation test out if it grows). Proposal: bank drained by wrong and slow answers, rounds of six prompts speeding up with rising mismatches, target "survive all five" (owner to confirm all numbers). Full review (scoring).

### T237 Arrow Flip: input helpers and renderer
- Type: feature
- Status: todo
- Depends on: T236, T135
- Acceptance criteria:
  - [ ] `src/challenges/arrow-flip/input.ts` (pure): `swipeDirection(dx, dy, minPx)` returns LEFT, RIGHT, UP, DOWN or null (a swipe shorter than `MIN_SWIPE_PX` = 24 is ignored, an exact diagonal resolves by a documented rule, never randomly), `keyDirection(key)` maps the four arrow keys, and the same direction type is used by the four on-screen buttons. Tests at every quadrant boundary, a 23 px and a 24 px swipe, and each key.
  - [ ] `src/challenges/arrow-flip/render.ts` draws, from the prompt and elapsed ms: a large arrow, the direction word in large type under or over it, and the cue as a labelled badge, a text "WORD" or "ARROW" in a differently shaped frame (a rounded rectangle for WORD, a diamond for ARROW, proposal) so the cue is never told apart by colour alone; a feedback mark after each answer (a tick or cross shape plus the right direction as text on a wrong answer); a draining limit bar. Colours come from the canvas token helper; reduced motion drops the slide-in of a prompt, not the content; text is at least 28 CSS px at 390 px wide.
  - [ ] Tests: swipe and key tests above; a recording canvas mock shows the arrow, word and badge each drawn once per prompt and the badge text equals the cue; the limit bar's fraction at 0, half and the limit; the layout puts the arrow, word and badge inside the canvas at 320 x 480 and 390 x 560 and keeps the contrast ratio of text over its background at least 4.5:1 for the palette tokens used (asserted with a contrast helper, as the other games' tests do if one exists, or a small pure one added here).
- Notes: About 320 lines. Colour-blind safety: cue and feedback are shapes and text, the arrow's direction is its shape. Fresh Sport look per `docs/UI_GUIDELINES.md`. Full review in batch M9-c (scoring neighbours).

### T238 Arrow Flip game component
- Type: feature
- Status: todo
- Depends on: T237, T137, T178, T179
- Acceptance criteria:
  - [ ] `src/components/arrow-flip/ArrowFlipGame.tsx` (not yet wired in; uses `runFrames`): the 3-2-1 before every round, the prompts in sequence, answered by a swipe on the canvas (pointer events from pointerdown to pointerup, `touch-action: none`), by four on-screen direction buttons (each at least 56 x 56 CSS px, with visible focus, laid out so all four and the canvas fit a 390 x 664 viewport without scrolling) or by the arrow keys, all through the same answer path; a short feedback beat (`FEEDBACK_MS`) after each answer; `RoundProgress`, a `BankGauge` in seconds to one decimal ("4.2 s left") and the numbered round counter. A prompt that times out shows the right answer as text.
  - [ ] It reports `{ answers, endMs }` (each `atMs` from the game's start, so the 3-2-1s are inside it) when the run ends. Inputs before the prompt appeared, or during the 3-2-1, are ignored; a swipe that is too short is ignored and does not count as an answer.
  - [ ] Unit test with mocked time and pointer events: a correct swipe on a matching prompt, a correct swipe on a mismatched "arrow" cue, a wrong answer, a timeout; a button press and a key press give the same answer as a swipe; the run ends on a bust and after the last prompt.
  - [ ] Accessibility: the buttons have names "Left", "Right", "Up" and "Down"; the canvas has a `role="img"` label that does not reveal the answer ahead of the visual cue (for example "Prompt 3 of 6, round 2"); a live status announces "Right" or "Wrong" after an answer, never the colour alone.
- Notes: About 380 lines. Full review (attempts, since it produces the submitted inputs). Part of batch M9-d.

### T239 Arrow Flip: registration, practice page and migration
- Type: feature
- Status: todo
- Depends on: T238, T109
- Acceptance criteria:
  - [ ] `CHALLENGE_TYPES`, the registry, `challengeUi` (`showScore: false`, `bankSummary(ROUNDS, "rounds")`, `bankTarget`), `CHALLENGE_NAMES` ("Arrow Flip"), `CHALLENGE_TAGLINES` and `ARROW_FLIP_HOW_TO` gain `arrow-flip` (for example "Each prompt shows an arrow and a word that may disagree. A badge tells you which to follow, the WORD or the ARROW. Swipe that direction, or press the buttons or arrow keys. Wrong and slow answers come out of one time bank. Survive all five rounds to pass."). Every other place that lists the games is updated as in T234, tests extended without being weakened.
  - [ ] A migration adds `challenge_types` `arrow-flip` / `higher-better` and `"arrow-flip": 5` to `default_pass_targets` (existing row and column default); the pool stays unchanged until T241. pgTAP as T234 (type row, default 5, hand placing into an unstarted lineup, RLS unchanged).
  - [ ] `/practice/arrow-flip` uses `PracticeShell`, works signed out with no `/api/attempts` calls, shows rounds survived and pass or fail with no score, and is listed on the practice hub. `npm run db:types`, `npm run verify` and `npm run test:db` pass.
  - [ ] Unit tests for `ArrowFlipPractice`, `challengeUi`, the hub list; `seed:dev`, `simulate:days` and the local-tools lineup setter accept `arrow-flip`.
- Notes: About 330 lines. Full review (migration, attempts).

### T240 Arrow Flip: cheat checks
- Type: feature
- Status: todo
- Depends on: T236, T239
- Acceptance criteria:
  - [ ] `src/config/cheat.ts` gains placeholder thresholds (proposal, judgment call to record): `ARROW_FLIP_MIN_REACTION_MS` = 180 (a correct answer sooner than this after the prompt appeared is faster than a person can read the cue and swipe; `ARROW_FLIP_FAST_ANSWERS` = 3 such answers in one run to flag, since one lucky anticipation is human) and `ARROW_FLIP_RHYTHM_MIN_ANSWERS` = 12 with `ARROW_FLIP_RHYTHM_MAX_SD_MS` = 12 (reaction times that even over 12 or more answers look scripted; reaction times, not gaps, so the countdowns do not hide a script, the lesson of M6's echo-path rule).
  - [ ] `detectFlags` gains `arrow-flip-too-fast` and `arrow-flip-robotic`; `timing-mismatch` covers the game with the countdown allowance (tested).
  - [ ] Honest-looking fixture (reactions 420 to 900 ms, two wrong answers, a miss) has no flags; each rule has a positive and a negative test asserting the whole flag list; no rule fires for another game's attempts; the simulated careful player from T236 raises no flag in at least 99% of 2 000 runs.
  - [ ] Submit response shape unchanged; at least 90% lines and branches in `detect.ts`.
- Notes: About 160 lines. Light review in a full-review batch.

### T241 Add both games to the daily pool and the admin controls
- Type: feature
- Status: todo
- Depends on: T234, T239
- Acceptance criteria:
  - [ ] A migration sets the `game_settings.pool` default to the seven games and appends `bank-shot` and `arrow-flip` to the existing settings row's pool (keeping any pool the admin already edited: it only appends the two when absent), each entry still checked against `challenge_types`, at least three distinct entries. Days already created keep their lineups; days not yet created draw from seven games.
  - [ ] `supabase/tests/lineups.test.sql` committed fixed-date lineups are re-pinned for the seven-game pool (the expected lists are recomputed with the SQL function and checked by hand for being valid lineups, not just copied from the output); over 365 consecutive days no lineup has a repeated game and no day repeats the previous day's exact lineup; every one of the seven games appears at least once; a pool of exactly three games still changes order daily; a pool the admin already narrowed to five is left alone by the migration (tested).
  - [ ] `/admin/settings` edits the pool and a default pass target for all seven games (the drift guard against `gameSettings.fixture.json` is updated); the lineup editor lists the two new games; unit tests for the action's validation (a pool with an unknown game refused, pool of two refused, the two new games accepted, a default target of 5 shown for each).
  - [ ] `npm run db:types`, `npm run verify` and `npm run test:db` pass.
- Notes: About 250 lines. Full review (migration, streak). Last migration of M9, so the lineup fixtures are re-pinned only once.

### T242 End-to-end checks for the two new games
- Type: feature
- Status: todo
- Depends on: T240, T241
- Acceptance criteria:
  - [ ] Practice e2e for both games signed out, with no `/api/attempts` calls: Bank Shot shows the 3-2-1, the puck and then nothing after the glimpse, the marker, the "Lock in" button and the reveal, and the bank gauge drops by the missed distance; a deliberately bad run busts the bank and shows "rounds survived" with no big score; Arrow Flip shows the arrow, the word and the cue badge, a correct arrow-key answer keeps the gauge, a wrong one drains it by about the wrong cost, the numbered round counter lights round 1 after it is passed; neither game shows a score number; Teetering Tower and Trail Trace still do.
  - [ ] Daily flow e2e: with today's lineup set by the SQL fixture so one of the new games is in it (as `tests/e2e/after/daily-three.spec.ts` and `global-setup.ts` do), a new user starts, plays and submits the game, the server re-runs the engine on the inputs (assert the response's `passed` follows the server's score and that submitting a score field or a `passed` field is ignored), the one-attempt-per-game rule returns 409 for a second start, and the results page and share text show pass or fail with no game name, score or target. The two games appear in the `/play` lineup names and in `/history`.
  - [ ] A grep of `tests/e2e` and the `global-setup.ts` fixtures for lists of the five games finds none left that should say seven; `look.spec.ts` and the no-emoji, no-em-dash tests cover the new text; the practice hub e2e lists seven games.
  - [ ] `npm run test:e2e` passes from a cold start.
- Notes: About 350 lines. Light review. The daily-flow games are chosen by the fixture, never by the rotation, so the test does not depend on which games a date draws.

### T243 Phone checks for the two new games
- Type: feature
- Status: todo
- Depends on: T242
- Acceptance criteria:
  - [ ] On both mobile projects in `tests/e2e/mobile/mobile.spec.ts`: `/practice/bank-shot` and `/practice/arrow-flip` have no horizontal scroll (`expectBoardFits`), and the canvas, "Lock in" button, and all four Arrow Flip direction buttons lie wholly on screen once a round starts, asserted with `expectControlOnScreen` (the Lock in button and the lowest direction button with a 16 px margin below, as T228); every button and the Bank Shot finish-line strip are at least 44 x 44 CSS px.
  - [ ] Bank Shot completes a round with `page.touchscreen.tap` on the finish line and the Lock in button; Arrow Flip completes a prompt with a touch swipe and with a button tap; both canvases have a computed `touch-action` that stops pinch and double-tap zoom (`expectNoZoom`); Arrow Flip text is at least 28 CSS px (computed from the layout).
  - [ ] Any layout fix needed (spacing, canvas height) is included, or split into a follow-up if it passes about 150 lines; `npm run verify` and `npm run test:e2e` pass on both projects.
- Notes: About 200 lines. Light review.

### T244 Record the M9 decisions and update the docs
- Type: docs
- Status: todo
- Depends on: T243
- Acceptance criteria:
  - [ ] `docs/DECISIONS.md` gets one entry for Bank Shot (T230 to T235) and one for Arrow Flip (T236 to T240), plus one for the pool (T241), each in the existing format, listing every proposal below as "owner to confirm" and where to change it.
  - [ ] `docs/NEEDS_HUMAN.md` gets a "please confirm" entry for the M9 numbers and a "please update DESIGN.md" entry (the pool table lists five games, and the "45 to 90 seconds" run length is checked against the new games' measured run times). Owner-to-confirm list: the shown names "Bank Shot" and "Arrow Flip" (no clash with an existing game); Bank Shot's five rounds, bounces 1, 1, 2, 3, 4, glimpses 1 600 to 800 ms, the spinning bar in rounds 4 and 5 (and the simplification that the bar's surface speed is ignored in a bounce), the 10 s tap limit, the final `BANK_UNITS` from the simulation, the place-then-lock-in control, and the 40 to 60% survival target; Arrow Flip's five rounds of six prompts, the mismatch ladder 20% to 60%, the half-and-half cue split, allowances and limits, `WRONG_COST_MS`, `TIMEOUT_COST_MS`, the final `BANK_MS`, the swipe threshold of 24 px, the cue shapes (rounded rectangle for WORD, diamond for ARROW), and the 40 to 60% survival target; both default pass targets of 5; the placeholder cheat thresholds; the pool of seven games.
  - [ ] `docs/PROGRESS.md` is updated, the run-time of one honest Bank Shot and one honest Arrow Flip attempt (measured in practice, written down) is recorded, and `README.md` lists the two new practice routes. `docs/DESIGN.md` is not edited.
- Notes: Docs only; no reviewers needed. After the batch, run the maintainer subagent (milestone end) and then stop for the M9 play-test: `npm run dev`, open `/practice/bank-shot` and `/practice/arrow-flip` on a phone and a desktop; in the admin local tools set today's lineup to include each new game and play the Daily Three.

### T245 Bank Shot practice page (MVP, unregistered)
- Type: feature
- Status: todo
- Depends on: T233
- Acceptance criteria:
  - [ ] `/practice/bank-shot` plays `BankShotGame` with a fresh seed each run and scores it locally with the T231 engine (practice never decides anything official), showing rounds survived and pass or fail, no score, and "Play again"; it works signed out and makes no `/api/attempts` calls.
  - [ ] The game is not added to `CHALLENGE_TYPES`, the registry, migrations or the daily pool (that is T234, phase 2). The practice hub links to it marked "New" (or similar plain label) so the owner can find it.
  - [ ] A unit test for the page (a bust and a full pass with mocked inputs) and one smoke e2e that the page loads and starts a run; `npm run verify` passes.
- Notes: About 120 lines. Phase 1 MVP so the owner can judge the game before the full wiring. Light review. If `PracticeShell` needs a registered type, use a minimal local wrapper rather than registering early.

### T246 Arrow Flip practice page (MVP, unregistered)
- Type: feature
- Status: todo
- Depends on: T238
- Acceptance criteria:
  - [ ] As T245, for `/practice/arrow-flip` with `ArrowFlipGame` and the T236 engine.
- Notes: About 120 lines. Light review (it shares batch M9-c with the full-review engine).

## M8 M7 play-test tweaks

Planned Nov 19, 2026 from the owner's M7 play-test feedback; overrides the M7 values where they conflict. Approved Nov 19.

Goal: play-test again. Second Sense has a 4 s bank; Swift Sum shows 10 to 25 dots; Trail Trace gives one extra life; Clean Cut shapes are irregular blobs and polygons; the round counter is big numbers joined by bars; bank games show no score in the results window.

Planning notes for M8:

- **Values that change:** `BUDGET_MS` (`inner-clock/engine.ts`), `DOT_COUNT_MAX` (`flash-count/engine.ts`), `LIVES` (`echo-path/engine.ts`). Each stays an exported constant, so the owner can edit it.
- **Bank games** (the games that use the shared bank rule in `challenges/shared/bank.ts`): Second Sense (`inner-clock`), Swift Sum (`flash-count`) and Clean Cut (`fair-split`). Teetering Tower and Trail Trace are not bank games and keep their scores.
- **One migration task per batch** resets `scores_since` (T183 pattern: a new file, day after it runs, recompute unedited unstarted open days) for the games whose scale changed.

### T217 Second Sense: a 4 second bank
- Type: feature
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] `BUDGET_MS` in `src/challenges/inner-clock/engine.ts` becomes 4 000; `timeoutMs = targetMs + BUDGET_MS` follows. Target ranges, `REVEAL_MS`, `ROUNDS` and the schema are unchanged.
  - [ ] Tests re-pinned: with targets 10 000, 13 000, 16 000, 19 000 and bank 4 000, perfect taps score 4 + 4 000 ÷ 4 000 = 5; taps `[10 500, 13 000, 16 000, 19 000]` score 4.875; an error of exactly 4 000 on every round scores 4 (the bank is spent but not exceeded); an error above 4 000 busts round 1 and scores 0. Golden scores and `lastInputMs` re-pinned. The simulated-player survival band (spread 250 ms) is re-run, re-set from the simulation and documented.
  - [ ] `INNER_CLOCK_HOW_TO`, the tagline and `challengeUi` say "a 4 second bank"; the gauge test uses `total=4` (format "0.8 s"). Tests quoting "2 s" are updated without weakening.
- Notes: Owner: "time bank about 4 s". Full review (scoring).

### T218 Swift Sum: at most 25 dots
- Type: feature
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] `DOT_COUNT_MAX` in `src/challenges/flash-count/engine.ts` becomes 25 (default, owner may edit; the recommended range was 10 to 25). `DOT_COUNT_MIN` (10), the 10 dot bank, `ROUNDS` and flash times are unchanged.
  - [ ] Tests: over seeds 0 to 999 every count is within 10 to 25 and all 16 values appear in every round position; round 1 and round 5 means differ by less than 1.5; with counts 12, 25, 18, 20, 21 exact answers score 6. Golden scores re-pinned. The simulated estimator (error about 15%) is re-run; the survival band is re-set from the simulation and documented.
  - [ ] `dots.ts` spacing test covers 10 to 25. `FLASH_COUNT_HOW_TO`, tagline and `levels` label say "10 to 25 dots"; the 30-dot cheat fixture in `detect.test.ts` becomes 25 dots and still has no flags.
- Notes: Judgment call: 25 chosen as the top of the owner's recommended 10 to 25 band, because the 10 dot bank allows about 1.2 miss per round at 20 dots. Full review (scoring).

### T219 Trail Trace: one extra life
- Type: feature
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] `LIVES` in `src/challenges/echo-path/engine.ts` becomes 2 (the first try plus one extra life); `MAX_TAPS` follows. Scoring formula (longest length cleared + lives left ÷ LIVES, 3 decimals) is unchanged.
  - [ ] Tests: with an explicit 10-tile path, all correct scores 10 + 1 = 11; clearing 4 to 6 then missing twice scores 6; clearing everything with one miss scores 10.5; a first miss then a clean run to 10 scores 10.5. Golden scores re-pinned.
  - [ ] The lives display in `EchoPathGame.tsx` shows 2 marks with label "1 of 2 lives left"; `EchoPathPractice` detail, `ECHO_PATH_HOW_TO` and tagline say "one extra life". Tests updated without weakening.
- Notes: Judgment call: "only one extra life" read as two lives in total, not one. Full review (scoring).

### T220 Migration: scale reset for Second Sense, Swift Sum and Trail Trace
- Type: infra
- Status: done
- Depends on: T217, T218, T219
- Acceptance criteria:
  - [ ] One new migration sets `challenge_types.scores_since` to the day after it runs (UTC) for `inner-clock`, `flash-count` and `echo-path`, keeps `default_pass_targets` (4, 5, 8) and recomputes unedited, unstarted open days of those types. pgTAP: older attempts ignored, newer counted, other types untouched, exact date asserted.
  - [ ] Cheat thresholds re-checked: `detect.test.ts` keeps its honest and scripted fixtures flag-for-flag for the three games (a 4 s bank widens honest Second Sense errors; change `TIME_BANK_PRECISE_*` only if the honest fixture flags, with a comment).
  - [ ] `npm run db:types`, `npm run verify`, `npm run test:db` and `npm run test:e2e` pass.
- Notes: Full review (migration, scoring).

### T221 Clean Cut: irregular blob and polygon generators
- Type: feature
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] `src/challenges/fair-split/shapes.ts` draws every shape from two seeded generators, replacing the named kinds: an irregular blob (a smooth star-shaped outline from 3 to 5 random harmonics with random amplitudes and phases) and an irregular polygon (7 to 12 vertices at sorted random angles with random radii). Both are star-shaped around an interior point, so they are simple by construction. Same seed gives the same shape. Mix: 70% blobs, 30% polygons (keeps the curved share test at 70%).
  - [ ] Shapes use the box margin and area floor already in `shapes.ts`, and a deterministic fallback still applies when retries fail (this absorbs T215's fallback item, which becomes done by this task and is removed from T215).
  - [ ] The identifiable-shape helpers (heart, star, plus and the like) and their tests are removed, not left as dead code. The "at least 10 kinds" test is replaced by distinctness: over 1 000 seeds, at least 99% of shapes are distinct, and five shapes in one run all differ.
- Notes: Owner: "entirely asymmetrical, irregular blobs or polygons, not any identifiable shape". Full review (scoring).

### T222 Clean Cut: asymmetry and validity tests
- Type: feature
- Status: done
- Depends on: T221
- Acceptance criteria:
  - [ ] Over seeds 0 to 999 and all five positions, every shape passes `asymmetry` (mirror and 2 to 5-fold rotation measures both at least `MIN_ASYMMETRY`, raised from 0.04 if the measured minimum allows; record the measured minimum in a comment). A square, circle, regular star and symmetric heart still fail it.
  - [ ] Validity, checked by an independent brute-force test (not the generator's own code): no two non-adjacent edges intersect (simple), every point inside the box margin, at most 160 points, area 25% to 70% of the box, and a straight halving line exists that splits the area within 1 point of 50% (cuttable).
  - [ ] "Not identifiable" proxy: radius from the centroid varies by at least 1.3 times (max over min), so no shape is near a circle or regular polygon; asserted for all 1 000 seeds.
  - [ ] Engine tests keep passing; golden scores re-pinned; the simulated cutter survival band re-run and documented. At least 90% lines and branches.
- Notes: Full review (scoring).

### T223 Migration: Clean Cut scale reset
- Type: infra
- Status: done
- Depends on: T222
- Acceptance criteria:
  - [ ] A new migration sets `scores_since` for `fair-split` to the day after it runs, keeps `default_pass_targets` at 5, recomputes unedited, unstarted open days. pgTAP with exact-date assertion as in T220.
  - [ ] `detect.test.ts` honest fixture (distances 0.9, 1.6, 0.4, 2.1, 1.2 points) still has no flags; thresholds change only if it flags, with a comment. `FAIR_SPLIT_HOW_TO`, tagline and `shapes` label say "irregular blobs and polygons".
  - [ ] `npm run db:types`, `npm run verify` and `npm run test:db` pass.
- Notes: Full review (migration, scoring).

### T224 Round counter: big numbers joined by progress bars
- Type: feature
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] `src/components/rounds/RoundProgress.tsx` (and its CSS module) renders one large number per round with a bar between each pair, replacing the boxes. Props are unchanged (`total`, `current`, `failedRound`), so all users (Second Sense, Swift Sum, Clean Cut, `useRevealRounds` consumers) keep working.
  - [ ] A passed round lights its number and the bar after it (mint); the current number is ringed and the bar after it is unlit; a failed round's number is tangerine and its bar stays unlit; later ones are outlined. The last round has no bar. States are exposed as `data-step` and `data-bar` attributes.
  - [ ] Unit tests (`RoundProgress.test.tsx`): total 4, current 2 gives numbers 1 and 2 lit, bars 1 and 2 lit, bar 3 unlit; failed round 3 gives number 3 failed; `aria-label` stays "Round N of M". A Playwright check at 390 px wide shows a 5-round bar without horizontal scroll and numbers at least 24 px tall. Follows `docs/UI_GUIDELINES.md`; reduced motion respected for bar fill.
- Notes: Owner: shared UI for all multi-round games. Light review.

### T225 Results window: no score for bank games
- Type: feature
- Status: done
- Depends on: none
- Acceptance criteria:
  - [ ] `challengeUi` gains a `showScore` flag: false for `inner-clock`, `flash-count` and `fair-split`, true for `stacking` and `echo-path`. `PlayToday` (`between` phase) and `PracticeShell` (via the practice `result`) pass `score` to `ResultHero` only when the flag is true; the big number and the fractional "You scored" text are gone for bank games.
  - [ ] For bank games the summary shows the whole rounds survived and the pass target (for example "You got through 3 of 4 rounds. Today's target was all 4."), with no decimals. Won or lost heading and the day-so-far note are unchanged.
  - [ ] The day's results page, history and share text also show only pass or fail (no score) for bank games.
  - [ ] Unit tests for the three bank games and the two others in every place above (no score shown for bank games, present for the others). Stored server-side scores are not changed.
- Notes: Owner, Nov 19: hide the score everywhere for bank games, show only pass or fail. Light review.

### T226 End-to-end and phone checks for the M8 changes
- Type: feature
- Status: done
- Depends on: T220, T223, T224, T225
- Acceptance criteria:
  - [ ] Existing e2e specs and `global-setup.ts` fixtures follow the new values without weakening (Second Sense 4 s bank, Swift Sum 10 to 25, Trail Trace 2 lives, Clean Cut blobs); a grep of `tests/e2e` for stale values finds none.
  - [ ] Practice e2e: Second Sense shows a 4 s gauge; Swift Sum never shows more than 25 dots over ten attempts; Trail Trace shows 2 lives; Clean Cut shapes differ between attempts; the round counter shows numbers and bars and lights round 1 after it is passed; bank games show no big score and Teetering Tower does.
  - [ ] On both mobile projects: no horizontal scroll, buttons at least 44 x 44 CSS px. The Daily Three flows still pass.
- Notes: Light review.

### T227 Record the M8 decisions
- Type: docs
- Status: done
- Depends on: T226
- Acceptance criteria:
  - [ ] `docs/DECISIONS.md` gets entries for: the 4 s bank, 25 dot cap, two lives in total, the blob and polygon generators with the 70/30 mix and `MIN_ASYMMETRY`, the bank-game list and where the score is still shown, the new `scores_since` resets.
  - [ ] `docs/NEEDS_HUMAN.md` gets a "please update DESIGN.md" entry for the M8 rules and a "please confirm" entry for the 70/30 mix (25 dots and 2 lives were confirmed Nov 19) and where each lives. `docs/PROGRESS.md` is updated. `docs/DESIGN.md` is not edited.
- Notes: Docs only; no reviewers needed.

## Maintenance after M7 (maintainer, Nov 18)

### T215 Clean Cut's last-try shape and exact scale-reset checks
- Type: maintenance
- Status: done
- Depends on: none
- Acceptance criteria:
  - [x] The fallback shape and its forced-path test (done by T221).
  - [x] The pgTAP checks of each game's `scores_since` reset assert the exact date, not `>=`; the copied re-target setup in `fair_split.test.sql` is shared or trimmed.
  - [x] `npm run verify` and `npm run test:db` pass; no behaviour change for real seeds.
- Notes: From M7 review notes. About 120 lines. If T221 lands first, its fallback covers the first criterion; keep only the test and the pgTAP part. Full review (scoring tests).

### T216 Admin sign-in e2e tests steady on a cold dev server
- Type: maintenance
- Status: done
- Depends on: none
- Acceptance criteria:
  - [x] The admin e2e tests no longer time out on the first run against a cold dev server (for example a warm-up of the admin routes before they run), without raising the global timeout or skipping tests.
  - [x] `challengeUi`'s `shapes` formatter is renamed or commented so its job is clear; its tests still pass.
  - [x] `npm run verify` and `npm run test:e2e` pass from a cold start.
- Notes: Cold starts made the admin sign-in check fail once in three local runs during M7. About 60 lines. Light review.

## Maintenance after M8 (maintainer, Nov 19)

### T228 Room for Swift Sum's Submit button on phones
- Type: maintenance
- Status: done
- Depends on: none
- Acceptance criteria:
  - [x] On both mobile projects, Swift Sum's Submit button is fully inside the viewport with at least 16 px below it, asserted in `tests/e2e/mobile/mobile.spec.ts` before the tap.
  - [x] The fix tightens vertical spacing (or similar); no change to rules, scoring or the desktop layout.
  - [x] `npm run verify` and `npm run test:e2e` pass.
- Notes: In M8 the 30 px round counter only just fits Submit on pixel-7, and no test checks the margin. About 100 lines. Light review.

### T229 Every game's main button fits the phone screen
- Type: maintenance
- Status: done
- Depends on: T228
- Acceptance criteria:
  - [x] A shared mobile e2e helper asserts that a game's main action button (Submit, Cut, the tap area and the like) lies fully inside the viewport once a round starts; it is used for all five games on both mobile projects.
  - [x] Any game that fails gets a minimal layout fix.
  - [x] `npm run verify` and `npm run test:e2e` pass.
- Notes: Guards against layout changes hiding controls on small screens. About 120 lines. Light review.
