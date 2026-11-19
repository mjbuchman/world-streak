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

M8 M7 play-test tweaks (Nov 19, 2026; approved Nov 19 (2 lives, 25 dots, score hidden everywhere for bank games); runs before batch 19):

- M8-a. Second Sense, Swift Sum and Trail Trace tuning: T217, T218, T219, T220 (full: scoring, migration)
- M8-b. Clean Cut blobs and irregular polygons: T221, T222, T223 (full: scoring, migration)
- M8-c. Round counter and results window: T224, T225 (light)
- M8-d. M8 end-to-end checks and docs: T226, T227 (light; T227 is docs only)

Maintenance after M7: T215 (full: scoring tests), T216 (light); after M8.

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
- Status: in-progress
- Depends on: none
- Acceptance criteria:
  - [ ] `src/challenges/fair-split/shapes.ts` draws every shape from two seeded generators, replacing the named kinds: an irregular blob (a smooth star-shaped outline from 3 to 5 random harmonics with random amplitudes and phases) and an irregular polygon (7 to 12 vertices at sorted random angles with random radii). Both are star-shaped around an interior point, so they are simple by construction. Same seed gives the same shape. Mix: 70% blobs, 30% polygons (keeps the curved share test at 70%).
  - [ ] Shapes use the box margin and area floor already in `shapes.ts`, and a deterministic fallback still applies when retries fail (this absorbs T215's fallback item, which becomes done by this task and is removed from T215).
  - [ ] The identifiable-shape helpers (heart, star, plus and the like) and their tests are removed, not left as dead code. The "at least 10 kinds" test is replaced by distinctness: over 1 000 seeds, at least 99% of shapes are distinct, and five shapes in one run all differ.
- Notes: Owner: "entirely asymmetrical, irregular blobs or polygons, not any identifiable shape". Full review (scoring).

### T222 Clean Cut: asymmetry and validity tests
- Type: feature
- Status: in-progress
- Depends on: T221
- Acceptance criteria:
  - [ ] Over seeds 0 to 999 and all five positions, every shape passes `asymmetry` (mirror and 2 to 5-fold rotation measures both at least `MIN_ASYMMETRY`, raised from 0.04 if the measured minimum allows; record the measured minimum in a comment). A square, circle, regular star and symmetric heart still fail it.
  - [ ] Validity, checked by an independent brute-force test (not the generator's own code): no two non-adjacent edges intersect (simple), every point inside the box margin, at most 160 points, area 25% to 70% of the box, and a straight halving line exists that splits the area within 1 point of 50% (cuttable).
  - [ ] "Not identifiable" proxy: radius from the centroid varies by at least 1.3 times (max over min), so no shape is near a circle or regular polygon; asserted for all 1 000 seeds.
  - [ ] Engine tests keep passing; golden scores re-pinned; the simulated cutter survival band re-run and documented. At least 90% lines and branches.
- Notes: Full review (scoring).

### T223 Migration: Clean Cut scale reset
- Type: infra
- Status: in-progress
- Depends on: T222
- Acceptance criteria:
  - [ ] A new migration sets `scores_since` for `fair-split` to the day after it runs, keeps `default_pass_targets` at 5, recomputes unedited, unstarted open days. pgTAP with exact-date assertion as in T220.
  - [ ] `detect.test.ts` honest fixture (distances 0.9, 1.6, 0.4, 2.1, 1.2 points) still has no flags; thresholds change only if it flags, with a comment. `FAIR_SPLIT_HOW_TO`, tagline and `shapes` label say "irregular blobs and polygons".
  - [ ] `npm run db:types`, `npm run verify` and `npm run test:db` pass.
- Notes: Full review (migration, scoring).

### T224 Round counter: big numbers joined by progress bars
- Type: feature
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] `src/components/rounds/RoundProgress.tsx` (and its CSS module) renders one large number per round with a bar between each pair, replacing the boxes. Props are unchanged (`total`, `current`, `failedRound`), so all users (Second Sense, Swift Sum, Clean Cut, `useRevealRounds` consumers) keep working.
  - [ ] A passed round lights its number and the bar after it (mint); the current number is ringed and the bar after it is unlit; a failed round's number is tangerine and its bar stays unlit; later ones are outlined. The last round has no bar. States are exposed as `data-step` and `data-bar` attributes.
  - [ ] Unit tests (`RoundProgress.test.tsx`): total 4, current 2 gives numbers 1 and 2 lit, bars 1 and 2 lit, bar 3 unlit; failed round 3 gives number 3 failed; `aria-label` stays "Round N of M". A Playwright check at 390 px wide shows a 5-round bar without horizontal scroll and numbers at least 24 px tall. Follows `docs/UI_GUIDELINES.md`; reduced motion respected for bar fill.
- Notes: Owner: shared UI for all multi-round games. Light review.

### T225 Results window: no score for bank games
- Type: feature
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] `challengeUi` gains a `showScore` flag: false for `inner-clock`, `flash-count` and `fair-split`, true for `stacking` and `echo-path`. `PlayToday` (`between` phase) and `PracticeShell` (via the practice `result`) pass `score` to `ResultHero` only when the flag is true; the big number and the fractional "You scored" text are gone for bank games.
  - [ ] For bank games the summary shows the whole rounds survived and the pass target (for example "You got through 3 of 4 rounds. Today's target was all 4."), with no decimals. Won or lost heading and the day-so-far note are unchanged.
  - [ ] The day's results page, history and share text also show only pass or fail (no score) for bank games.
  - [ ] Unit tests for the three bank games and the two others in every place above (no score shown for bank games, present for the others). Stored server-side scores are not changed.
- Notes: Owner, Nov 19: hide the score everywhere for bank games, show only pass or fail. Light review.

### T226 End-to-end and phone checks for the M8 changes
- Type: feature
- Status: todo
- Depends on: T220, T223, T224, T225
- Acceptance criteria:
  - [ ] Existing e2e specs and `global-setup.ts` fixtures follow the new values without weakening (Second Sense 4 s bank, Swift Sum 10 to 25, Trail Trace 2 lives, Clean Cut blobs); a grep of `tests/e2e` for stale values finds none.
  - [ ] Practice e2e: Second Sense shows a 4 s gauge; Swift Sum never shows more than 25 dots over ten attempts; Trail Trace shows 2 lives; Clean Cut shapes differ between attempts; the round counter shows numbers and bars and lights round 1 after it is passed; bank games show no big score and Teetering Tower does.
  - [ ] On both mobile projects: no horizontal scroll, buttons at least 44 x 44 CSS px. The Daily Three flows still pass.
- Notes: Light review.

### T227 Record the M8 decisions
- Type: docs
- Status: todo
- Depends on: T226
- Acceptance criteria:
  - [ ] `docs/DECISIONS.md` gets entries for: the 4 s bank, 25 dot cap, two lives in total, the blob and polygon generators with the 70/30 mix and `MIN_ASYMMETRY`, the bank-game list and where the score is still shown, the new `scores_since` resets.
  - [ ] `docs/NEEDS_HUMAN.md` gets a "please update DESIGN.md" entry for the M8 rules and a "please confirm" entry for the 70/30 mix (25 dots and 2 lives were confirmed Nov 19) and where each lives. `docs/PROGRESS.md` is updated. `docs/DESIGN.md` is not edited.
- Notes: Docs only; no reviewers needed.

## Maintenance after M7 (maintainer, Nov 18)

### T215 Clean Cut's last-try shape and exact scale-reset checks
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [x] The fallback shape and its forced-path test (done by T221).
  - [ ] The pgTAP checks of each game's `scores_since` reset assert the exact date, not `>=`; the copied re-target setup in `fair_split.test.sql` is shared or trimmed.
  - [ ] `npm run verify` and `npm run test:db` pass; no behaviour change for real seeds.
- Notes: From M7 review notes. About 120 lines. If T221 lands first, its fallback covers the first criterion; keep only the test and the pgTAP part. Full review (scoring tests).

### T216 Admin sign-in e2e tests steady on a cold dev server
- Type: maintenance
- Status: todo
- Depends on: none
- Acceptance criteria:
  - [ ] The admin e2e tests no longer time out on the first run against a cold dev server (for example a warm-up of the admin routes before they run), without raising the global timeout or skipping tests.
  - [ ] `challengeUi`'s `shapes` formatter is renamed or commented so its job is clear; its tests still pass.
  - [ ] `npm run verify` and `npm run test:e2e` pass from a cold start.
- Notes: Cold starts made the admin sign-in check fail once in three local runs during M7. About 60 lines. Light review.
