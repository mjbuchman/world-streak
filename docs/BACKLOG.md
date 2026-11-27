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

M9 New games: Bank Shot and Ink (planned Nov 22, 2026; approved Nov 24, all proposals as written; re-planned Nov 24 after the owner's MVP play-test: Bank Shot retuned, Arrow Flip dropped and replaced by the Stroop game Ink; the daily lineup stays 3 games, drawn from a pool of 7). The owner wants an MVP first: each game playable on its practice page only, then a stop for the owner's play-test before any registration, migration, cheat check or pool work.

Phase 1, practice-only MVP (then stop for the owner's play-test):

- M9-a. Bank Shot geometry and engine: T230, T231 (done)
- M9-b. Bank Shot renderer, game and practice page: T232, T233, T245 (done)
- M9-c. Arrow Flip engine, input, renderer, game and practice page: T236, T237, T238, T246 (done, superseded by Ink)
- M9-f. Bank Shot retune (bank 30, free zone, gentler glimpses): T247, T248 (done)
- M9-g. Ink engine and renderer: T249, T250 (full: scoring) (done)
- M9-h. Ink game, practice page and Arrow Flip removal: T251, T252, T253 (full: attempts, scoring files removed) (done)
- STOP (done Nov 25): owner play-test of `/practice/bank-shot` and `/practice/ink`. Outcome: Bank Shot removed, Ink becomes one round (see "M9 play-test tweaks, Nov 25" below).

Phase 1b, play-test tweaks of Nov 25 (then stop for the owner's play-test of `/practice/ink`):

- M9-i. Ink as one round: single run, new score, 50% to 90% mismatches, thin outline: T254, T255, T256 (full: scoring, attempts)
- M9-j. Remove Bank Shot: T257 (light) (done)
- STOP (done Nov 27): owner play-test of `/practice/ink`: "pretty good", 30 words and the name Confusing Colors (T258).
- M9-k. Confusing Colors, 30 words: T258 (full: scoring) (done)
- STOP (done Nov 27): the owner said start phase 2; outline kept as is. Phase 2 uses the name Confusing Colors, 30 words and a default target of 30 where the tasks below say Ink, 40.

Phase 2, only after the owner says they like the games (apply their tweaks first):

- M9-d. Ink registration, migration and cheat checks: T239, T240 (full: migration, scoring); T234 and T235 (Bank Shot) are dropped
- M9-e. Pool (six games), admin, end-to-end and phone checks, docs: T241, T242, T243, T244 (full: migration; T244 is docs only) (done, #210)
- STOP (done Nov 27): M9 play-test, "confusing colors looks good"; pool of 6, 3 games a day.

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

## M9 New games: Bank Shot and Ink

Re-plan approved by the owner (M9 re-plan, 2026-11-24): T247 to T253 are new, T236 to T238 and T246 are superseded, and T234, T235, T239 to T244 were rewritten for Ink. (Older text below that still says "Arrow Flip" or lists the original Bank Shot numbers is superseded by the re-plan notes and by T247, T249 to T253.)

Planned Nov 22, 2026 from the owner's request to add two games to the daily pool, after which the MVP is done. The owner chose the two games and their one-line ideas; every number and rule detail below marked "proposal" is an agent proposal, recorded as "owner to confirm" (T244).

Re-plan after the Nov 24 play-test: Bank Shot is good but too unforgiving, so it is retuned (T247). Arrow Flip was confusing and too fast, so it is dropped and replaced by Ink, a basic Stroop game (T249 to T253).

Goal: play-test two new games. Practice Bank Shot (watch a puck bounce, then tap where it will cross the finish line) and Ink (a colour word is drawn in an ink colour; tap the ink's colour, not the word) at `/practice/bank-shot` and `/practice/ink`, on a phone and on a desktop; after phase 2 both turn up in the daily lineup rotation with the five existing games, are scored by the server, and hide their score like the other bank games.

Planning notes for M9:

- **Stored keys and names:** `bank-shot` and `ink` (folders, routes, flag names and `challenge_types` values follow them, as T199 set). Shown names "Bank Shot" and "Ink" are the owner's or the working name; the "original names, not those of existing games" rule in `src/config/challenges.ts` means the owner should confirm neither clashes with a known game (T244).
- **Both are bank games** (Ink drains a time bank in ms, Bank Shot a distance bank in units; the rule in `src/challenges/shared/bank.ts`): `playBank` and `bankScore`, score = whole rounds survived plus the bank left as a fraction, `direction "higher-better"`, `challengeUi.showScore` false, default pass target 5 ("survive all five"), editable in `/admin`. No `scores_since` reset is needed: a new type has no old-scale scores.
- **Same rules as every game:** pure deterministic engine (`createRng` only; no `Math.random`, `Date.now`, DOM, network), simulation driven by elapsed ms, the server re-runs the engine on the submitted inputs and the client never decides pass or fail, the 3-2-1 before every round (`RUN_COUNTDOWN_MS`), `RoundProgress` numbered counter, `BankGauge`, `useRevealRounds` or the game's own frame loop (`runFrames`) as the model needs, `lastInputMs` and a schema bound on every input array, `finished`, practice page through `PracticeShell`, Fresh Sport look per `docs/UI_GUIDELINES.md` (no emojis, no em dashes, real buttons with visible focus, no colour as the only cue), and rule 8 (no back button during a run).
- **Models to copy:** `src/challenges/fair-split/` (bank, per-round countdown, outcome type, canvas, keyboard fallback), `src/challenges/flash-count/` (round reveal), `src/components/fair-split/FairSplitGame.tsx`, `src/app/practice/fair-split/`, `supabase/migrations/20261116030000_fair_split.sql` and `supabase/tests/fair_split.test.sql`.
- **Every place that lists the games** must learn the two new keys; a grep for `fair-split` and `FairSplit` under `src/`, `supabase/`, `scripts/` and `tests/` is part of each registration task (the `ChallengeType` union and `satisfies Record<ChallengeType, ...>` checks catch most at typecheck: `CHALLENGE_TYPES`, `CHALLENGES`, `CHALLENGE_UI`, `CHALLENGE_NAMES`, `CHALLENGE_TAGLINES`, `detect.ts`, `adminSettings`, `localTools`, the `gameSettings.fixture.json` drift guard, `seed:dev`, `simulate:days`).
- **The pool migration comes last (T241)** so the committed lineups in `supabase/tests/lineups.test.sql` are re-pinned once, not twice. Until then the two games are practice-only and no day can draw them (admins can still hand-place them after T234 and T239 through the lineup editor, which reads `challenge_types`).
- **Open items:** none in the design doc covers these games. The numbers below are proposals; each is an exported, easily changed constant and each needs an "owner to confirm" line in `docs/DECISIONS.md` and `docs/NEEDS_HUMAN.md` (T244). `docs/DESIGN.md` is not edited (NEEDS_HUMAN "please update DESIGN.md": its pool table lists five games).

### T230 Bank Shot: reflection geometry (pure)
- Type: feature
- Status: done
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
- Status: done
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
- Status: done
- Depends on: T231, T135
- Acceptance criteria:
  - [ ] `src/challenges/bank-shot/render.ts` draws, from state and elapsed ms alone: the board with its walls, the finish line along the top, the puck and a fading trail during the glimpse, the spinning bumper (visible the whole round, rotating by elapsed ms), the player's marker on the finish line, and the reveal (the real path, the real crossing point and the miss as a labelled distance) after the tap. Colours come from the canvas token helper (T135); the marker, the real crossing and the walls differ by shape and label as well as colour; reduced motion drops the trail fade and the bumper's spin animation for a static bar plus its angle label, never the pass or fail information.
  - [ ] Pure helpers: `boardLayout(canvasW, canvasH)` fits the 100 x 150 board in the canvas with margins, `toBoard(layout, px, py)` and `toCanvas(layout, x, y)` round trip within 0.01 units at 5 canvas sizes including 390 x 560, `markerX(layout, px)` clamps a canvas x to the finish line, and a `puckAt(params, round, elapsedMs)` function used by both the renderer and tests returns the puck position (using T230 helpers).
  - [ ] Tests: puck positions at 0, 500 and the glimpse end match T230's hand-computed trace; at glimpse end plus 1 ms nothing is drawn for the puck (a recording canvas mock); the bumper's angle at 0 and 1 000 ms; each mapped marker x from 0 to 100 stays on the line; the finish line is at least 44 CSS px tall as a tap strip at 390 px wide (asserted from the layout numbers).
- Notes: About 330 lines. Fresh Sport look per `docs/UI_GUIDELINES.md`. Light review in a full-review batch (scoring files nearby).

### T233 Bank Shot game component
- Type: feature
- Status: done
- Depends on: T232, T137, T178, T179
- Acceptance criteria:
  - [ ] `src/components/bank-shot/BankShotGame.tsx` (not yet wired in; uses `runFrames`): the 3-2-1 before every round, the launch and glimpse, a tap or drag on the canvas that places the marker on the finish line (a tap anywhere on the board maps to its x; the marker can be moved again before locking), a 44 px or taller "Lock in" button and the Enter key that commit the guess (proposal: place, then lock, so a fat finger can correct itself), the reveal for `SHOW_MS`, then the next round. The Left and Right arrow keys move the marker by 1 unit (Shift: 5) and Enter locks, so it is playable without a pointer. Taps before the glimpse ends are ignored.
  - [ ] `RoundProgress` (T178), a `BankGauge` (T179) with the bank in units to one decimal ("18.5 left") and the numbered round counter (M8); no score or crossing distance is shown during play beyond the reveal's own miss; on a bust the run ends with the real path shown for `SHOW_MS`.
  - [ ] It reports `{ taps, endMs }` (each `atMs` from the game's start, so the 3-2-1s are inside it) when the run ends, including a round that timed out at `TAP_LIMIT_MS`.
  - [ ] Unit test with mocked time: one good round (marker locked on the crossing), one timeout, a bust; the marker keys; a tap during the glimpse changes nothing. The canvas has `touch-action: none`, a `role="img"` name and a status line for assistive tech ("Round 2 of 5"), and focus is visible on the button.
- Notes: About 380 lines. Full review (attempts, since it produces the submitted inputs). Part of batch M9-b.

### T234 Bank Shot: registration, practice page and migration
- Type: feature
- Status: done
- Depends on: T248, T109
- Acceptance criteria:
  - [ ] `CHALLENGE_TYPES`, the registry, `challengeUi` (`showScore: false`, `bankSummary(ROUNDS, "rounds")`, `bankTarget`), `CHALLENGE_NAMES` ("Bank Shot"), `CHALLENGE_TAGLINES`, `BANK_SHOT_HOW_TO` and the how-to / `challengeUi` wording gain `bank-shot` (for example "Watch the puck bounce. It vanishes. Tap where it will cross the finish line, then lock in. Every unit you miss by comes out of one bank; survive all five rounds to pass."). Every other place that lists the games is updated (the grep in the planning notes); all tests for them are extended without being weakened.
  - [ ] A migration adds `challenge_types` `bank-shot` / `higher-better` and `default_pass_targets` `"bank-shot": 5` (both the existing row's value and the column default), with the `game_settings` pool left unchanged (T241). pgTAP: the type row exists with direction `higher-better`, the settings default holds 5, `ensure_game_day` still creates three games from the unchanged pool, an admin can hand-place `bank-shot` into an unstarted day's lineup, and RLS on `challenge_types` is unchanged (still readable by everyone, no client writes).
  - [ ] `/practice/bank-shot` (route folder `src/app/practice/bank-shot/`) uses `PracticeShell`, works signed out with no `/api/attempts` calls, shows "rounds survived" and pass or fail (no score), and the practice hub lists it with its tagline. `npm run db:types`, `npm run verify` and `npm run test:db` pass.
  - [ ] Unit tests for `BankShotPractice` (a bust and a full pass with mocked inputs), `challengeUi` (no score shown for `bank-shot`), the hub list and `isChallengeType`.
  - [ ] `seed:dev` and `simulate:days` can record a `bank-shot` attempt with a valid score; the local-tools lineup setter accepts it.
- Notes: About 350 lines. Full review (migration, attempts). Not in the daily rotation until T241. A new type needs no `scores_since`.
- SUPERSEDED (2026-11-25): dropped, never built. The owner removed Bank Shot after the play-test ("nearly impossible", not fun); T257 deletes the code. Status set to `done` only so it is not picked up. History only.

### T235 Bank Shot: cheat checks
- Type: feature
- Status: done
- Depends on: T247, T234
- Acceptance criteria:
  - [ ] `src/config/cheat.ts` gains placeholder thresholds (proposal, judgment call to record; with the T247 free zone of about 3 units, "precise" must be re-judged: count rounds within `BANK_SHOT_PRECISE_UNITS` of the crossing, a much tighter distance than `FREE_UNITS`): `BANK_SHOT_PRECISE_ROUNDS` = 3 rounds of one run each within `BANK_SHOT_PRECISE_UNITS` = 0.25 units of the real crossing (a thumb on a phone cannot place a marker that close, and a script can), and `BANK_SHOT_MIN_TAP_AFTER_GLIMPSE_MS` = 250 (a counted tap sooner than this after the puck vanished is faster than a person can read the path and place a guess).
  - [ ] `detectFlags` gains `bank-shot-precise` and `bank-shot-instant`; the generic `timing-mismatch` already covers the new game with the countdown allowance (a test shows it does).
  - [ ] An honest-looking fixture (misses of 3.1, 1.4, 4.8, 2.2, 0.9 units, taps 1.5 to 4 s after the glimpse) has no flags; each rule has a positive and a negative test asserting the whole flag list; the rules never fire for another game's attempts and the other games' fixtures stay flag-free. Thresholds are checked against the T231 simulated careful player: it raises no flag in at least 99% of 2 000 simulated runs.
  - [ ] The submit response shape is unchanged with and without flags; at least 90% lines and branches in `detect.ts`.
- Notes: About 160 lines. Flags only hold prize entries for review; they never change a result or the meter. Light review (the cheat checks do not touch scoring) in a full-review batch.
- SUPERSEDED (2026-11-25): dropped, never built (Bank Shot removed, see T257). Status set to `done` only so it is not picked up. History only.

### T236 Arrow Flip: prompt generator and engine
- Type: feature
- Status: done
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
- SUPERSEDED (2026-11-24): done and merged (#198), but the owner found Arrow Flip confusing and too fast. It is replaced by Ink (T249 to T253); the code is removed in T253. Criteria above are kept as history only.

### T237 Arrow Flip: input helpers and renderer
- Type: feature
- Status: done
- Depends on: T236, T135
- Acceptance criteria:
  - [ ] `src/challenges/arrow-flip/input.ts` (pure): `swipeDirection(dx, dy, minPx)` returns LEFT, RIGHT, UP, DOWN or null (a swipe shorter than `MIN_SWIPE_PX` = 24 is ignored, an exact diagonal resolves by a documented rule, never randomly), `keyDirection(key)` maps the four arrow keys, and the same direction type is used by the four on-screen buttons. Tests at every quadrant boundary, a 23 px and a 24 px swipe, and each key.
  - [ ] `src/challenges/arrow-flip/render.ts` draws, from the prompt and elapsed ms: a large arrow, the direction word in large type under or over it, and the cue as a labelled badge, a text "WORD" or "ARROW" in a differently shaped frame (a rounded rectangle for WORD, a diamond for ARROW, proposal) so the cue is never told apart by colour alone; a feedback mark after each answer (a tick or cross shape plus the right direction as text on a wrong answer); a draining limit bar. Colours come from the canvas token helper; reduced motion drops the slide-in of a prompt, not the content; text is at least 28 CSS px at 390 px wide.
  - [ ] Tests: swipe and key tests above; a recording canvas mock shows the arrow, word and badge each drawn once per prompt and the badge text equals the cue; the limit bar's fraction at 0, half and the limit; the layout puts the arrow, word and badge inside the canvas at 320 x 480 and 390 x 560 and keeps the contrast ratio of text over its background at least 4.5:1 for the palette tokens used (asserted with a contrast helper, as the other games' tests do if one exists, or a small pure one added here).
- Notes: About 320 lines. Colour-blind safety: cue and feedback are shapes and text, the arrow's direction is its shape. Fresh Sport look per `docs/UI_GUIDELINES.md`. Full review in batch M9-c (scoring neighbours).
- SUPERSEDED (2026-11-24): done, replaced by Ink (T250); removed in T253. History only.

### T238 Arrow Flip game component
- Type: feature
- Status: done
- Depends on: T237, T137, T178, T179
- Acceptance criteria:
  - [ ] `src/components/arrow-flip/ArrowFlipGame.tsx` (not yet wired in; uses `runFrames`): the 3-2-1 before every round, the prompts in sequence, answered by a swipe on the canvas (pointer events from pointerdown to pointerup, `touch-action: none`), by four on-screen direction buttons (each at least 56 x 56 CSS px, with visible focus, laid out so all four and the canvas fit a 390 x 664 viewport without scrolling) or by the arrow keys, all through the same answer path; a short feedback beat (`FEEDBACK_MS`) after each answer; `RoundProgress`, a `BankGauge` in seconds to one decimal ("4.2 s left") and the numbered round counter. A prompt that times out shows the right answer as text.
  - [ ] It reports `{ answers, endMs }` (each `atMs` from the game's start, so the 3-2-1s are inside it) when the run ends. Inputs before the prompt appeared, or during the 3-2-1, are ignored; a swipe that is too short is ignored and does not count as an answer.
  - [ ] Unit test with mocked time and pointer events: a correct swipe on a matching prompt, a correct swipe on a mismatched "arrow" cue, a wrong answer, a timeout; a button press and a key press give the same answer as a swipe; the run ends on a bust and after the last prompt.
  - [ ] Accessibility: the buttons have names "Left", "Right", "Up" and "Down"; the canvas has a `role="img"` label that does not reveal the answer ahead of the visual cue (for example "Prompt 3 of 6, round 2"); a live status announces "Right" or "Wrong" after an answer, never the colour alone.
- Notes: About 380 lines. Full review (attempts, since it produces the submitted inputs). Part of batch M9-d.
- SUPERSEDED (2026-11-24): done, replaced by Ink (T251); removed in T253. History only.

### T239 Ink: registration, practice page and migration
- Type: feature
- Status: done
- Depends on: T256, T257, T109
- Acceptance criteria:
  - [ ] `CHALLENGE_TYPES`, the registry, `challengeUi` (`showScore: false`, a words-survived summary such as "words survived, of 40" built on the bank helpers, `bankTarget`), `CHALLENGE_NAMES` ("Ink"), `CHALLENGE_TAGLINES` and `INK_HOW_TO` gain `ink` (for example "A colour word appears in a coloured ink. Tap the colour of the ink, not the word. Slow and wrong answers come out of one time bank. Survive all 40 words to pass."). Every other place that lists the games is updated (the grep in the planning notes), tests extended without being weakened.
  - [ ] A migration adds `challenge_types` `ink` / `higher-better` and `"ink": 40` (the T254 default target) to `default_pass_targets` (existing row and column default); the pool stays unchanged until T241. pgTAP: the type row exists, the settings default holds 40, `ensure_game_day` still creates three games from the unchanged pool, an admin can hand-place `ink` into an unstarted lineup, RLS on `challenge_types` unchanged.
  - [ ] The existing `/practice/ink` page (T252, T256) moves onto the registered type (`PracticeShell` with the registry), still works signed out with no `/api/attempts` calls, shows words survived and pass or fail with no score, and stays on the practice hub (no longer marked "New"). `npm run db:types`, `npm run verify` and `npm run test:db` pass.
  - [ ] Unit tests for `InkPractice`, `challengeUi`, the hub list; `seed:dev`, `simulate:days` and the local-tools lineup setter accept `ink`.
- Notes: About 330 lines. Full review (migration, attempts). Phase 2: waits for the owner's play-test.

### T240 Ink: cheat checks
- Type: feature
- Status: done
- Depends on: T254, T239
- Acceptance criteria:
  - [ ] `src/config/cheat.ts` gains placeholder thresholds (proposal, judgment call to record): `INK_MIN_REACTION_MS` = 180 (a correct answer sooner than this after the word appeared is faster than a person can read and tap; `INK_FAST_ANSWERS` = 3 such answers in one run to flag, since one lucky anticipation is human) and `INK_RHYTHM_MIN_ANSWERS` = 12 with `INK_RHYTHM_MAX_SD_MS` = 12 (reaction times that even over 12 or more answers look scripted; reaction times, not gaps, so the single opening 3-2-1 does not hide a script, the lesson of M6's echo-path rule).
  - [ ] `detectFlags` gains `ink-too-fast` and `ink-robotic`; `timing-mismatch` covers the game with the one opening countdown allowance (tested).
  - [ ] Honest-looking fixture (reactions 450 to 1 100 ms, two wrong answers, a miss) has no flags; each rule has a positive and a negative test asserting the whole flag list; no rule fires for another game's attempts; the simulated careful player from T254 raises no flag in at least 99% of 2 000 runs.
  - [ ] Submit response shape unchanged; at least 90% lines and branches in `detect.ts`.
- Notes: About 160 lines. Light review in a full-review batch.

### T241 Add Ink to the daily pool and the admin controls
- Type: feature
- Status: done
- Depends on: T239
- Acceptance criteria:
  - [ ] A migration sets the `game_settings.pool` default to the six games and appends `ink` to the existing settings row's pool (keeping any pool the admin already edited: it only appends `ink` when absent), each entry still checked against `challenge_types`, at least three distinct entries. Days already created keep their lineups; days not yet created draw from six games.
  - [ ] `supabase/tests/lineups.test.sql` committed fixed-date lineups are re-pinned for the six-game pool (the expected lists are recomputed with the SQL function and checked by hand for being valid lineups, not just copied from the output); over 365 consecutive days no lineup has a repeated game and no day repeats the previous day's exact lineup; every one of the six games appears at least once; a pool of exactly three games still changes order daily; a pool the admin already narrowed to five is left alone by the migration (tested).
  - [ ] `/admin/settings` edits the pool and a default pass target for all six games (the drift guard against `gameSettings.fixture.json` is updated); the lineup editor lists Ink; unit tests for the action's validation (a pool with an unknown game refused, pool of two refused, `ink` accepted, a default target of 40 shown for Ink).
  - [ ] `npm run db:types`, `npm run verify` and `npm run test:db` pass.
- Notes: About 220 lines. Full review (migration, streak). Last migration of M9, so the lineup fixtures are re-pinned only once. Bank Shot is gone (2026-11-25), so the pool grows from five to six games.

### T242 End-to-end checks for Ink
- Type: feature
- Status: done
- Depends on: T240, T241
- Acceptance criteria:
  - [ ] Practice e2e signed out, with no `/api/attempts` calls: Ink shows the colour word in its ink and four labelled buttons, one 3-2-1 for the whole run (none between words), no round counter, a correct key press (1 to 4) keeps the gauge, a wrong one drains it by about the wrong cost; a deliberately bad run busts the bank and shows "words survived" with no big score; Ink shows no score number; Teetering Tower and Trail Trace still do.
  - [ ] Daily flow e2e: with today's lineup set by the SQL fixture so Ink is in it (as `tests/e2e/after/daily-three.spec.ts` and `global-setup.ts` do), a new user starts, plays and submits the game, the server re-runs the engine on the inputs (assert the response's `passed` follows the server's score and that submitting a score field or a `passed` field is ignored), the one-attempt-per-game rule returns 409 for a second start, and the results page and share text show pass or fail with no game name, score or target. Ink appears in the `/play` lineup names and in `/history`.
  - [ ] A grep of `tests/e2e` and the `global-setup.ts` fixtures for lists of the five games finds none left that should say six; `look.spec.ts` and the no-emoji, no-em-dash tests cover the new text; the practice hub e2e lists six games.
  - [ ] `npm run test:e2e` passes from a cold start.
- Notes: About 280 lines. Light review. The daily-flow game is chosen by the fixture, never by the rotation, so the test does not depend on which games a date draws.

### T243 Phone checks for Ink
- Type: feature
- Status: done
- Depends on: T242
- Acceptance criteria:
  - [ ] On both mobile projects in `tests/e2e/mobile/mobile.spec.ts`: `/practice/ink` has no horizontal scroll (`expectBoardFits`), and the canvas and all four Ink colour buttons lie wholly on screen once the run starts, asserted with `expectControlOnScreen` (the lowest colour button with a 16 px margin below, as T228); every button is at least 44 x 44 CSS px.
  - [ ] Ink completes a word with a touch tap on a colour button; the Ink buttons have a computed `touch-action` that stops pinch and double-tap zoom (`expectNoZoom`); Ink's word is at least 36 CSS px (computed from the layout).
  - [ ] Any layout fix needed (spacing, canvas height) is included, or split into a follow-up if it passes about 150 lines; `npm run verify` and `npm run test:e2e` pass on both projects.
- Notes: About 150 lines. Light review.

### T244 Record the M9 decisions and update the docs
- Type: docs
- Status: done
- Depends on: T243
- Acceptance criteria:
  - [ ] `docs/DECISIONS.md` gets one entry for Ink (T249 to T256, T239, T240, including why Arrow Flip and Bank Shot were dropped and the single-round redesign; the entries T254 and T255 wrote are consolidated, not duplicated), plus one for the pool (T241), each in the existing format, listing every proposal below as "owner to confirm" and where to change it.
  - [ ] `docs/NEEDS_HUMAN.md` gets a "please confirm" entry for the M9 numbers and a "please update DESIGN.md" entry (the pool table lists five games, and the "45 to 90 seconds" run length is checked against the new games' measured run times). Owner-to-confirm list: the shown name "Ink" (no clash with an existing game); Ink's four words and colours (no green, for colour-blind players), one run of 40 words at one steady pace, the mismatch counts per stretch (50% rising to about 90%), the one allowance and one limit, `WRONG_COST_MS`, `TIMEOUT_COST_MS`, the final `BANK_MS` from the simulation (careful player finishes 50 to 70%), the score formula (words survived plus bank left as a fraction, maximum 41), the thin outline on all four inks and the contrast trade-off, keys 1 to 4; the default pass target of 40; the placeholder cheat thresholds; the pool of six games.
  - [ ] `docs/PROGRESS.md` is updated, the run-time of one honest Ink attempt (measured in practice, written down) is recorded, and `README.md` lists the new practice route (`/practice/ink`; Bank Shot and Arrow Flip are not listed). `docs/DESIGN.md` is not edited.
- Notes: Docs only; no reviewers needed. After the batch, run the maintainer subagent (milestone end) and then stop for the M9 play-test: `npm run dev`, open `/practice/ink` on a phone and a desktop; in the admin local tools set today's lineup to include Ink and play the Daily Three.

### T245 Bank Shot practice page (MVP, unregistered)
- Type: feature
- Status: done
- Depends on: T233
- Acceptance criteria:
  - [ ] `/practice/bank-shot` plays `BankShotGame` with a fresh seed each run and scores it locally with the T231 engine (practice never decides anything official), showing rounds survived and pass or fail, no score, and "Play again"; it works signed out and makes no `/api/attempts` calls.
  - [ ] The game is not added to `CHALLENGE_TYPES`, the registry, migrations or the daily pool (that is T234, phase 2). The practice hub links to it marked "New" (or similar plain label) so the owner can find it.
  - [ ] A unit test for the page (a bust and a full pass with mocked inputs) and one smoke e2e that the page loads and starts a run; `npm run verify` passes.
- Notes: About 120 lines. Phase 1 MVP so the owner can judge the game before the full wiring. Light review. If `PracticeShell` needs a registered type, use a minimal local wrapper rather than registering early.

### T246 Arrow Flip practice page (MVP, unregistered)
- Type: feature
- Status: done
- Depends on: T238
- Acceptance criteria:
  - [ ] As T245, for `/practice/arrow-flip` with `ArrowFlipGame` and the T236 engine.
- Notes: About 120 lines. Light review (it shares batch M9-c with the full-review engine).
- SUPERSEDED (2026-11-24): done, replaced by T252; removed in T253. History only.

### T247 Bank Shot retune: bigger bank, free zone, gentler glimpses
- Type: feature
- Status: done
- Depends on: T231
- Acceptance criteria:
  - [ ] In `src/challenges/bank-shot/engine.ts`: `BANK_UNITS` = 30 (was 14; final value set by the simulation test below), new exported `FREE_UNITS` = 3, round cost = `max(0, distance - FREE_UNITS)` (distance still to 0.01; a tap exactly `FREE_UNITS` away costs 0, one at 3.01 costs 0.01); a round with no tap by `TAP_LIMIT_MS` still costs `BOARD_W` (the free zone never forgives a timeout); glimpse ladder 1 600, 1 400, 1 300, 1 150, 1 000 ms (was down to 800).
  - [ ] Exact tests rewritten with explicit params and the new constants: taps on every crossing score 6; misses of 2, 3, 3.01, 5, 10 units cost 0, 0, 0.01, 2, 7 and score 5 + 22.99 / 30 accordingly (worked by hand); a cost equal to what is left survives and 0.01 more ends the run; no tap in round 1 scores 0; goldens re-recorded for 3 seeds with the old values noted as superseded in a test comment; the schema, determinism, range and no-`Math.random` tests still pass unweakened.
  - [ ] Simulation test re-targeted: the careful simulated player (same Gaussian error model, taps 3 s after the glimpse) survives all five in 65 to 85% of 2 000 seeds (aim about 75%; `BANK_UNITS` is tuned to land there and the band is asserted); a distracted player (twice the error) survives well under that (under 35%); a perfect one 100%.
  - [ ] Other code that reads the old numbers (renderer tests, game component tests, practice page tests, any text saying the bank or glimpse values) is updated without weakening; `npm run verify` passes.
  - [ ] `docs/DECISIONS.md` records the retune (date, owner feedback "too unforgiving", old and new values, the simulated survival rates) as "owner to confirm" (T244 lists it).
- Notes: About 250 lines mostly tests. Full review (scoring). Part of batch M9-f. The M9 text in T231 and T230 that quotes old numbers is superseded by this task.

### T248 Bank Shot retune: show the free zone in play
- Type: feature
- Status: done
- Depends on: T247, T232, T233
- Acceptance criteria:
  - [ ] The reveal marks a guess inside `FREE_UNITS` with a plain label ("On target, no cost") as well as a shape, and shows other misses as "Missed by 4.2, cost 1.2"; the finish-line reveal draws the free zone as a band of `FREE_UNITS` each side of the real crossing, labelled, distinguishable without colour (outlined band plus text); the bank gauge text is unchanged ("27.5 left").
  - [ ] Renderer tests with a recording canvas mock: a guess 2.9 units off shows the free label and no cost; one 3.5 off shows the cost 0.5; band edges map to the correct canvas x at 390 x 560 and stay inside the finish line; game component test: a free-zone round leaves the gauge unchanged and a 3.5 miss drops it by 0.5.
  - [ ] The how-to text on the practice page mentions that a guess close enough costs nothing; contrast of the new label at least 4.5:1; reduced motion still shows the band.
- Notes: About 150 lines. Light review in the full-review batch M9-f. Not wired into the registry (T234).

### T249 Ink engine: prompt generator, time bank and simulation
- Type: feature
- Status: done
- Depends on: T08, T180
- Acceptance criteria:
  - [ ] `src/challenges/ink/engine.ts` implements `ChallengeModule` with `direction "higher-better"`, `ROUNDS` = 5, `WORDS_PER_ROUND` = 8 and a time bank `BANK_MS` (placeholder 6 000, final value set by the simulation test). Four colours `red`, `blue`, `yellow`, `black` (no green). `paramsFromSeed(seed)` returns every word of the run `{ word, ink }` (each one of the four) plus per-round `allowanceMs` and `limitMs`.
  - [ ] Ladder (exported constants, proposals): mismatches (ink differs from word) per round exactly 2, 3, 4, 5, 6 of 8 for every seed, positions shuffled by the seeded `createRng` (tests over seeds 0 to 999); no word's answer (its ink) equals the previous word's ink, including across a round boundary; `limitMs` 2 500, 2 250, 2 000, 1 750, 1 500 and `allowanceMs` 1 200, 1 050, 950, 850, 800 (about 2 500 down to 1 500 and about 1 200 down to 800).
  - [ ] Inputs `{ answers: { word, atMs, colour }[], endMs }`. Timing: the run opens with the 3-2-1 and each round with its own (`RUN_COUNTDOWN_MS`); word k+1 appears `WORD_GAP_MS` (proposal 400, includes the feedback beat) after word k was answered or timed out. The correct answer is the word's `ink`. Cost: correct answer `max(0, reactionMs - allowanceMs)`; wrong answer `WRONG_COST_MS` (placeholder 1 000) plus the same slow part; no answer by `limitMs` costs `TIMEOUT_COST_MS` (placeholder 1 500); an answer before the word appeared is ignored. All costs go through `playBank`; rounds survived = whole rounds fully survived (`floor(wordsSurvived / WORDS_PER_ROUND)`, at most `ROUNDS`); score = `bankScore(roundsSurvived, left, BANK_MS)`.
  - [ ] Exact tests with explicit params: 40 correct answers inside the allowance score 5 + 1 = 6; one wrong answer at the allowance costs exactly 1 000 (score 5 + 5 000 / 6 000); a correct answer 300 ms over the allowance costs 300; a cost equal to what is left survives and 1 ms more ends the run; a bust in round 3 after 2 whole rounds scores 2; a missed word costs 1 500; answering with the word's own name (the word, not the ink) when they differ counts as wrong; an answer before the word appeared is ignored.
  - [ ] `finished`, `lastInputMs` (`endMs`) and a schema bound (`answers.max(ROUNDS * WORDS_PER_ROUND)`, `word` an integer in range, `colour` one of four values, rising `atMs`, `endMs` not before the last answer). Determinism, range (seeds 0 to 999: 0 to ROUNDS + 1), golden test for 3 seeds, no `Math.random`, `Date.now` or DOM in the source.
  - [ ] Simulation test (documented model): a careful player reacts in 550 to 900 ms plus 60 ms per round of difficulty, and gets a mismatched word wrong with probability 4% rising to 12% by round 5; over 2 000 seeds 50 to 70% survive all five (owner to confirm), `BANK_MS` and `WRONG_COST_MS` set from this and the band asserted; a distracted player (three times the wrong rate) survives under 15%.
  - [ ] At least 90% lines and branches.
- Notes: About 380 lines (put the simulation test in its own file). Reuse the structure of `src/challenges/arrow-flip/engine.ts` (copy and adapt; it is deleted in T253, so do not import from it). Full review (scoring). Part of batch M9-g.

### T250 Ink renderer, palette and answer helpers
- Type: feature
- Status: done
- Depends on: T249, T135
- Acceptance criteria:
  - [ ] `src/challenges/ink/palette.ts` (pure) maps the four colours to canvas tokens (T135) with clearly different lightness (for example a dark red, a mid blue, a light yellow, near-black) and each paired with a text label; tests assert pairwise lightness differences of at least a documented minimum (for example 0.15 relative luminance) and a contrast ratio of at least 4.5:1 of each ink on the canvas background and of each button label on its button; no green anywhere. Yellow and black are checked on both light and dark backgrounds the canvas uses.
  - [ ] `src/challenges/ink/input.ts` (pure): `keyColour(key)` maps `1` to `4` (Red, Blue, Yellow, Black, in that order, same as the buttons), anything else null; tests for each key and for other keys.
  - [ ] `src/challenges/ink/render.ts` draws, from the word, elapsed ms and feedback state: the colour word in large type (at least 36 CSS px at 390 px wide) drawn in its ink, centred and inside the canvas at 320 x 480 and 390 x 560; a draining limit bar; a feedback mark after an answer (tick or cross shape plus, on a wrong answer or a timeout, the right colour's name as text). Reduced motion drops the slide-in, never the content. A recording canvas mock shows the word drawn once per word with the ink fill and the word text; the limit bar fraction at 0, half and the limit.
  - [ ] Reuse the layout and feedback ideas of `src/challenges/arrow-flip/render.ts` without importing from it.
- Notes: About 300 lines. Colour-blind safety: the answer buttons carry text labels, ink choice never depends on hue alone (lightness differs), feedback is shape plus text. Fresh Sport look per `docs/UI_GUIDELINES.md`. Full review in batch M9-g (scoring neighbours).

### T251 Ink game component
- Type: feature
- Status: done
- Depends on: T250, T137, T178, T179
- Acceptance criteria:
  - [ ] `src/components/ink/InkGame.tsx` (not yet registered; uses `runFrames`): the 3-2-1 before every round, the words in sequence, answered by four large labelled buttons Red, Blue, Yellow, Black (each at least 56 x 56 CSS px, visible focus, a 2 x 2 grid so the canvas and all four fit a 390 x 664 viewport without scrolling) or the keys 1 to 4, all through one answer path; a short feedback beat after each answer; `RoundProgress` (T178), `BankGauge` (T179) in seconds to one decimal ("4.2 s left") and the numbered round counter. A word that times out shows the right colour name as text. Buttons are not coloured with the answer colour only: each shows its text label (and may show a swatch).
  - [ ] It reports `{ answers, endMs }` (each `atMs` from the game's start, so the 3-2-1s are inside it) when the run ends. Presses before a word appeared, or during the 3-2-1, are ignored.
  - [ ] Unit test with mocked time: a correct tap, a tap of the word's name on a mismatched word (wrong), a timeout; a key press gives the same answer as a button; the run ends on a bust and after the last word.
  - [ ] Accessibility: buttons named "Red", "Blue", "Yellow", "Black"; the canvas has a `role="img"` label that does not reveal the answer (for example "Word 3 of 8, round 2"); a live status announces "Correct" or "Wrong" after an answer.
  - [ ] Reuses the bank, rounds, feedback beat, `RoundProgress`, `BankGauge`, the round 3-2-1 and the practice shell as the other bank games do; no import from `arrow-flip` (copy and adapt).
- Notes: About 350 lines. Full review (attempts, since it produces the submitted inputs). Part of batch M9-h.

### T252 Ink practice page and hub entry (MVP, unregistered)
- Type: feature
- Status: done
- Depends on: T251
- Acceptance criteria:
  - [ ] `/practice/ink` (`src/app/practice/ink/`) plays `InkGame` with a fresh seed each run and scores it locally with the T249 engine, showing rounds survived and pass or fail, no score, and "Play again"; it works signed out and makes no `/api/attempts` calls; it shows a short how-to ("Tap the colour of the ink, not the word. Keys 1 to 4 also work.").
  - [ ] Not added to `CHALLENGE_TYPES`, the registry, migrations or the daily pool (T239). The practice hub lists Ink marked "New", in place of Arrow Flip.
  - [ ] A unit test for the page (a bust and a full pass with mocked inputs) and one smoke e2e that the page loads, shows the four buttons and starts a run; `npm run verify` and `npm run test:e2e` pass.
- Notes: About 140 lines. Use the same local wrapper as the Bank Shot practice page (T245). Light review in the full-review batch M9-h.

### T253 Remove Arrow Flip
- Type: maintenance
- Status: done
- Depends on: T252
- Acceptance criteria:
  - [ ] `src/challenges/arrow-flip/`, `src/components/arrow-flip/`, `src/app/practice/arrow-flip/`, its canvas tokens, its tests and its `NEW_GAMES` (or equivalent) entry are deleted; `/practice/arrow-flip` is gone (404) and the hub no longer lists it; no import or mention of `arrow-flip`, `ArrowFlip` or `ARROW_FLIP` remains under `src/`, `tests/`, `scripts/` and `supabase/` (grep is empty; docs history in the backlog and `docs/PROGRESS.md` may keep the name).
  - [ ] Shared pieces Arrow Flip introduced that Ink or Bank Shot still use are kept and moved to shared locations if needed; nothing else loses coverage (overall and engine thresholds still met, none lowered).
  - [ ] `npm run verify` and `npm run test:e2e` pass; the e2e that referenced Arrow Flip now covers Ink.
- Notes: About 100 lines added and many deleted. Do it after the Ink pieces exist so they can be copied from. Light review in batch M9-h.

## M9 play-test tweaks, Nov 25

Owner play-test of 2026-11-25, all decisions final: Bank Shot was "nearly impossible" and not fun, so it is removed entirely (T257), and the daily pool becomes six games (T241), with Ink the only new game. Ink becomes one round (T254 to T256). Anything above that still says "Bank Shot", "five rounds", "rounds survived" or "seven games" for Ink or the pool is superseded by this section and by the edited T239 to T244.

### T254 Ink as one run: engine, mismatch ramp and new score
- Type: feature
- Status: done
- Depends on: T249
- Acceptance criteria:
  - [ ] `src/challenges/ink/engine.ts` has no rounds: `ROUNDS`, `WORDS_PER_ROUND`, the per-round ladders and the per-round countdown are gone. One exported `WORDS` = 40 (kept unless the simulation shows otherwise), one `ALLOWANCE_MS` and one `LIMIT_MS` for every word (proposal: 1 000 and 2 000, the middle of the old 1 200 to 800 and 2 500 to 1 500 ladders; the final pair is set by the simulation and recorded). One 3-2-1 opens the run (`RUN_COUNTDOWN_MS`); word k+1 appears `WORD_GAP_MS` after word k was answered or timed out, at one steady pace. `paramsFromSeed(seed)` returns the 40 words `{ word, ink }` only.
  - [ ] Mismatches (ink differs from word) follow exact counts per stretch of 8 words, exported as `MISMATCHES_PER_STRETCH` = `[4, 5, 6, 7, 7]` (50%, 62.5%, 75%, 87.5%, 87.5%; 90% of 8 is not a whole number, so 7 of 8 is the nearest and the ramp ends at 87.5%). For every seed 0 to 999 each stretch has exactly that many, 29 of 40 in total, positions shuffled by the seeded `createRng`; no word's ink equals the previous word's ink, including across stretch boundaries (kept rule).
  - [ ] Cost rules unchanged (correct: `max(0, reactionMs - ALLOWANCE_MS)`; wrong: `WRONG_COST_MS` plus the slow part; no answer by `LIMIT_MS`: `TIMEOUT_COST_MS`; early presses ignored), all through `playBank`. New score: `bankScore(wordsSurvived, bankLeftMs, BANK_MS)` = words survived plus bank left / `BANK_MS`, so 0 to 41, higher-better, deterministic; a run that survives all 40 words with the bank full scores 41; bust after n whole words scores n (bank left 0). Default pass target 40 ("survive all 40 words") replaces 5 (T239 migration uses it).
  - [ ] Exact tests with explicit params: 40 correct answers inside the allowance score 41; one wrong answer at the allowance costs exactly `WRONG_COST_MS` (score 40 + (`BANK_MS` - `WRONG_COST_MS`) / `BANK_MS`); a correct answer 300 ms over costs 300; a cost equal to what is left survives and 1 ms more ends the run; a bust after 12 words scores 12; a timeout costs `TIMEOUT_COST_MS`; the word's own name when it differs from the ink counts as wrong; early press ignored. Schema bound `answers.max(WORDS)`, determinism, range (seeds 0 to 999: 0 to 41), goldens re-recorded for 3 seeds (old values noted superseded in a comment), no `Math.random`, `Date.now` or DOM in the source; at least 90% lines and branches.
  - [ ] Simulation test re-set with the same targets: `BANK_MS` (and, if needed, `WRONG_COST_MS`) tuned so 50 to 70% of 2 000 simulated careful players survive all 40 words and under 15% of distracted players (three times the wrong rate); the careful model keeps its documented form with the per-round difficulty term replaced by the stretch (reaction 550 to 900 ms plus a difficulty step per stretch, wrong rate on mismatched words rising 4% to 12% across the stretches); bands asserted.
  - [ ] Every other reader of the old numbers is updated without weakening (`challengeUi` summary "words survived, of 40", `bankTarget`, the practice page text, cheat-check notes in T240 are not built yet); `npm run verify` passes.
  - [ ] `docs/DECISIONS.md` records (date, owner feedback, old and new values, simulated rates, "owner to confirm"): the score replacement (words survived plus bank fraction, max 41, why: it stays higher-better and deterministic and needs no rounds), the mismatch ramp (and why 87.5% rather than 90%), and the chosen allowance, limit and `BANK_MS`.
- Notes: About 350 lines mostly tests (simulation in its own file). Full review (scoring). Part of batch M9-i. Search the repo for `ROUNDS` and `WORDS_PER_ROUND` users first.

### T255 Ink thin outline on all four inks
- Type: feature
- Status: done
- Depends on: T254
- Acceptance criteria:
  - [ ] `src/challenges/ink/palette.ts`: the per-ink `halo` flag is removed; a single exported outline colour (light, pure) and `OUTLINE_CSS_PX` (1.5, inside the 1 to 2 range) are added. `render.ts` strokes every word, in all four inks, with a thin outline of that colour, line width `OUTLINE_CSS_PX * devicePixelRatio` in canvas pixels (stroke before fill so the ink fill stays whole); the old thick halo is gone for red and black.
  - [ ] Palette tests rewritten, not weakened elsewhere: no `halo` anywhere; the pairwise lightness differences of the inks and the 4.5:1 ratio of each button label on its button stay as they were; the contrast rule is re-stated in the test comment: the outline is decorative, ink-on-background contrast is no longer asserted for the red and black words (they were guaranteed by the halo), while yellow and black stay checked on the light and dark backgrounds. Renderer test with a recording canvas mock: one stroke and one fill per word for each of the four inks, stroke width 1.5 at DPR 1 and 3 at DPR 2, stroke called before fill, same positions as before.
  - [ ] `docs/DECISIONS.md` records the trade-off (red and black lose some contrast on the canvas without the halo; consistency across the four inks gained), as "owner to confirm". `docs/NEEDS_HUMAN.md` gets a "please confirm" entry: check red and black words are still easy to read on a phone and on a desktop in `/practice/ink`, and say if the outline should be thicker or the halo restored.
- Notes: About 120 lines. Full review in batch M9-i (the batch touches scoring files). Colour-blind safety is unchanged: lightness differs and buttons carry text.

### T256 Ink game and practice page for one run
- Type: feature
- Status: done
- Depends on: T254, T255, T251, T252
- Acceptance criteria:
  - [ ] `InkGame` drops the round counter and the per-round 3-2-1: one 3-2-1 at the start, then all 40 words at the steady pace; no `RoundProgress` is shown for Ink; the gauge text is unchanged ("4.2 s left"); a word counter ("Word 12 of 40") replaces the round counter, and the canvas `role="img"` label becomes "Word 12 of 40" without the answer. Reported inputs are still `{ answers, endMs }` with `atMs` from the game start.
  - [ ] `BankGauge` `spent` segments: read how `spent` works today (it is split per round for the bank games) and give Ink one unsplit bank: the spending shown is one drain of the whole bank, with no per-round marks. Other games' gauges keep their behaviour and tests; if `spent` has to become optional, the other callers' tests still pass unchanged; a new test shows the Ink gauge with a single bar and no round divisions.
  - [ ] `/practice/ink` shows "words survived" (of 40) and pass or fail, no score, and "Play again"; the how-to text says "Survive all 40 words" in place of "five rounds". Unit tests with mocked time: a full pass (40 correct), a bust part way, a timeout, a key press equal to a button, no countdown between words; one smoke e2e that the page loads, shows the four buttons and a single 3-2-1; `npm run verify` and `npm run test:e2e` pass.
- Notes: About 250 lines. Full review (attempts, since it produces submitted inputs). Part of batch M9-i. `RoundProgress` and `BankGauge` stay in the codebase; leave unused-code cleanup of `RoundProgress` to T257 only if nothing else uses it.

### T257 Remove Bank Shot
- Type: maintenance
- Status: done
- Depends on: T256
- Acceptance criteria:
  - [ ] `src/challenges/bank-shot/`, its component directory under `src/components/`, `src/app/practice/bank-shot/`, its canvas tokens, its tests and its `NEW_GAMES` entry are deleted; `/practice/bank-shot` returns 404 and the hub no longer lists it; a grep for `bank-shot`, `BankShot` and `BANK_SHOT` under `src/`, `tests/`, `scripts/` and `supabase/` comes back empty (docs history may keep the name).
  - [ ] Shared pieces Ink or other games still use are kept: the bank helpers (`src/challenges/shared/bank.ts`, `playBank`, `bankScore`), `BankGauge`, `PracticeShell`, `bankResult`, and `RoundProgress` if any other game uses it (grep; delete it with its tests only if nothing does). Anything Bank Shot introduced that only it used (geometry, free-zone helpers) is deleted with it. Coverage thresholds still met, none lowered.
  - [ ] The e2e and mobile tests that referenced Bank Shot now cover Ink or are removed with it; `npm run verify` and `npm run test:e2e` pass.
- Notes: About 80 lines added, many deleted. Light review. Part of batch M9-j. After it, STOP for the owner's play-test of `/practice/ink` (`npm run dev`, play it on a phone and a desktop: one 3-2-1, 40 words, one bank, mostly mismatched words, thin outline on all four inks).

### T258 Confusing Colors: 30 words and the new name
- Type: feature
- Status: done
- Depends on: T257
- Owner play-test of 2026-11-27: "pretty good"; decrease the total to 30 words, keep the bank as is (3.2 s), rename the game "Confusing Colors". Code name, paths and files stay `ink`.
- Acceptance criteria:
  - [ ] `WORDS` = 30, `BANK_MS` = 3 200 unchanged; stretches of 10 with `MISMATCHES_PER_STRETCH` = `[5, 7, 9]` (50%, 70%, 90%, the original 50% to 90% target, now exact); score 0 to 31; `DEFAULT_PASS_TARGET` 30. Engine tests, goldens and the simulation (rates recorded, bounds asserted) updated.
  - [ ] The hub, page title, how-to and results say "Confusing Colors" and 30 words; unit and e2e tests updated; `npm run verify` passes.
  - [ ] `docs/DECISIONS.md` records the change.
- Notes: Full review (scoring). Batch M9-k. Then STOP for the owner's next decision (phase 2 or more tweaks).

### T259 Fix the e2e flakes under load
- Type: maintenance
- Status: in-progress
- Depends on: none
- Acceptance criteria:
  - [x] `tests/e2e/attempts.spec.ts` "two simultaneous starts" accepts [200, 409] or [200, 200] (the second request may legitimately start position 2 after the first commits, `src/lib/attempts/start.ts`), and asserts no duplicate (user, game_date, position) rows and as many attempts as 200s.
  - [x] The admin sign-in helpers in `tests/e2e/` wait at least 15 s for the redirect (cold dev server under parallel load), not the 5 s default. No test, rule or threshold is weakened.
  - [x] `npm run test:e2e:local` passes 3 times in a row with the default workers; `npm run verify` passes.
- Notes: Maintainer, M9 end. Light review.

### T260 Remove the empty new-games list and the copied pool update
- Type: maintenance
- Status: in-progress
- Depends on: none
- Acceptance criteria:
  - [x] `src/config/newGames.ts` (empty since T239) and its use in `src/app/practice/page.tsx` are removed; the practice hub renders the same; the DECISIONS reference to it points at the game registry instead.
  - [x] `supabase/tests/lineups.test.sql` no longer keeps its own copy of the T241 pool update: the update lives in one named SQL function the migration path and the test both call (new migration if needed), or a test fails when the two diverge. All lineup assertions still pass.
  - [x] `npm run verify` and `npm run test:db` pass.
- Notes: Maintainer, M9 end. Full review if a migration is added, otherwise light. Done with a drift test (`tests/poolMigration.test.ts`), no migration.

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
