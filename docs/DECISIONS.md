# Decisions made by agents

Judgment calls on items `docs/DESIGN.md` marks as Open. Each one is also flagged in `docs/NEEDS_HUMAN.md` for confirmation. If the human overrules a decision, record that here too.

<!-- Format:
### YYYY-MM-DD — <item> (T05)
- Choice: ...
- Reason: ... (cite the design doc's recommendation if there was one)
- How to change it later: e.g. edit GAME_DEADLINE_UTC in src/lib/config.ts or the admin page
- Confirmed by human: pending | yes | changed to ...
-->

### 2026-11-07 — Prize amount (pre-planning)
- Choice: flat $200 per cycle; if there's no 30-day streak, the prize rolls into the next cycle ($400 after one rollover, and so on). The design doc's "prize formula, floor and cap" wording and the Cycle "revenue share" and "cap" fields are left out of the schema and the rules page.
- Reason: the human's answer; those fields are leftovers that may come back later.
- How to change it later: prize amount config constant (set in the prize task).
- Confirmed by human: yes

### 2026-11-07 — Eligibility (pre-planning)
- Choice: US residents aged 18 and over, enforced at sign-up.
- Reason: the human's answer.
- How to change it later: minimum age and allowed region config settings (set in the sign-up task).
- Confirmed by human: yes

### 2026-11-07 — Milestone count (pre-planning)
- Choice: 4 milestones instead of the planner's suggested 6.
- Reason: the human wants fewer play-test interruptions.
- Confirmed by human: yes

### 2026-11-07 — Open design items use the doc's suggestions (pre-planning)
- Choice: deadline at midnight UTC; live meter hidden for the final 3 hours; survival threshold 60%; pass target at the 80th percentile, admin-editable; new accounts count fully from day one through a configurable weight; working name "World Streak" in one config constant; pass-target rise with the streak is a setting with a flat placeholder; challenges after the first three are not in the MVP.
- Reason: the human said to take the design doc's suggestions for now.
- How to change it later: each is a config constant or admin setting; the implementing task records where.
- Confirmed by human: yes (for now)

### 2026-11-07 — UI guidelines and styling approach (pre-build)
- Choice: follow `docs/UI_GUIDELINES.md`: Material 3, styled with plain CSS Modules and CSS-variable tokens; no Tailwind, shadcn or MUI; no emojis except in the share text; no em dashes in UI text.
- Reason: the human wants a clean Material look without the usual signs of an AI-built app; the human approved the list and the styling approach.
- How to change it later: edit `docs/UI_GUIDELINES.md` (human approval needed).
- Confirmed by human: yes. The brand color and typefaces are placeholders, pending confirmation in NEEDS_HUMAN.

### 2026-11-07 — Public health endpoint (T02)
- Choice: `GET /api/health` needs no sign-in, an exception to CLAUDE.md's "every route handler checks authentication".
- Reason: it is a liveness probe for monitoring and the T02 e2e test; it takes no input and reveals only whether the database answers (via `public.health_check()`, which reads no data).
- How to change it later: add an auth check in `src/app/api/health/route.ts`, or delete the route.
- Confirmed by human: not needed (no Open design item); recorded for visibility.

### 2026-11-07 — Final game name (T03)
- Choice: working name "World Streak", defined once as `GAME_NAME`.
- Reason: the design doc lists the final name as Open; the human said to keep the working name for now.
- How to change it later: edit `GAME_NAME` in `src/config/game.ts`; the page title and home heading follow it.
- Confirmed by human: yes (for now)

### 2026-11-07 — Which "today" the age check uses (T05)
- Choice: the calendar date in Pacific/Honolulu (`ELIGIBILITY_TIME_ZONE` in `src/config/eligibility.ts`). Hawaii is the westernmost US state time zone, so its calendar date is the earliest in the US.
- Reason: using the UTC date would accept someone during the US evening before their 18th birthday. The earliest US date can never be ahead of any US resident's local date, so it never admits anyone early; at worst it makes someone in the eastern US wait a few extra hours on their birthday.
- How to change it later: edit `ELIGIBILITY_TIME_ZONE`.
- Confirmed by human: not needed (follows from the human's 18+ rule); recorded for visibility.

### 2026-11-07 — Sign-up says when an email is already registered (T05)
- Choice: signing up with a registered email shows "An account with this email already exists. Try signing in."
- Reason: clearer for real players than a vague message. The trade-off is that anyone can check whether an email has an account. That is acceptable for a game account holding no sensitive data, and abuse of the sign-up form is handled by T52.
- How to change it later: edit the email-taken message in `src/lib/signup.ts`.
- Confirmed by human: not needed; recorded for visibility.

### 2026-11-07 — Location check is self-declared (T03)
- Choice: eligibility uses the date of birth and country of residence the player enters at sign-up. No IP geolocation check in the MVP.
- Reason: judgment call by the planner (the design doc says "age and location eligibility enforced at sign-up" without a method). IP checks need a paid or third-party service, block VPN users and travellers unfairly, and the prize winner's identity and address are verified before payout anyway.
- How to change it later: add a check alongside `checkEligibility` in `src/lib/eligibility.ts`; the rules live in `src/config/eligibility.ts`.
- Confirmed by human: pending (see NEEDS_HUMAN)

### 2026-11-08 — Public Google sign-in callback (T07)
- Choice: `GET /auth/callback` needs no sign-in, an exception to CLAUDE.md's "every route handler checks authentication".
- Reason: it is where Google sign-in returns, before any session exists. Its only input is the one-time code, which Supabase validates against the PKCE verifier cookie; a missing or rejected code redirects to `/signin?error=oauth`.
- How to change it later: nothing to change unless sign-in moves elsewhere; the handler is `src/app/auth/callback/route.ts`.
- Confirmed by human: not needed (no Open design item); recorded for visibility.

### 2026-11-08 — Stacking speed ranges (T09)
- Choice: start speed 0.10-0.12 units/ms, ramp 0.002-0.003 units/ms per block, hard cap 60 s (`PARAM_RANGES` in `src/challenges/stacking/engine.ts`).
- Reason: the design says speed rises with height "to cap runs near one minute". A simulated player who lines up each block and taps within ±30 ms lasts a median of about 41-60 s across the ranges, while a ±80 ms player ends well before the minute. The first try (0.18-0.24, 0.004-0.008) ended good runs in 15-30 s. `src/challenges/stacking/tuning.test.ts` pins this.
- How to change it later: edit `PARAM_RANGES`, update the tuning test bounds and `engine.golden.json` (scores for issued seeds change), and record the new values here.
- Confirmed by human: pending; judge it at the M1 play-test.

### 2026-11-08 — Stacking score is a whole block count (T09)
- Choice: the score is the number of blocks placed, an integer.
- Reason: the Decided challenge table says the measure is "Blocks stacked". The design also asks for a "continuous scale" elsewhere, which an integer count only approximates; the backlog flags this as ambiguous.
- How to change it later: add a tie-breaking fraction (for example the remaining width of the top block divided by 200) to `simulate`'s score, and regenerate the golden fixture.
- Confirmed by human: pending (see NEEDS_HUMAN).

### 2026-11-08 — On-screen name for the stacking challenge (T10)
- Choice: "Tower", defined once in `CHALLENGE_NAMES` in `src/config/challenges.ts`.
- Reason: the design asks for an original name and art, not those of existing stacking games; the backlog suggested "Tower". The art is plain flat blocks in the Material color roles.
- How to change it later: edit `CHALLENGE_NAMES.stacking`; the practice page, home link and canvas label follow it.
- Confirmed by human: changed (Nov 9): the name is "Teetering Tower" and the look is Fresh Sport; see "Human decisions at the M1 play-test" below.

### 2026-11-09 — Deadline and survival threshold in code (T11)
- Choice: midnight UTC as `DEADLINE_UTC_HOUR = 0` in `src/config/schedule.ts`, repeated as `public.deadline_utc_hour()` in the game-days migration because the close job runs in Postgres; a 60% survival threshold set by `ensure_game_day`.
- Reason: the design doc's suggestions for its Open "exact global deadline time" and "survival threshold" items, already accepted at planning. A shared boundary fixture (`src/lib/gameDay.fixture.json`) is tested in Vitest and pgTAP, and a Vitest test checks the pgTAP copy matches, so the two cannot drift.
- How to change it later: edit both the constant and the SQL function in a new migration; the fixture tests fail if only one changes. The threshold moves into `game_settings` in T16.
- Confirmed by human: yes (at planning).

### 2026-11-09 — Placeholder stacking pass target: 10 blocks (T11)
- Choice: new game days get a pass target of 10 blocks until T16 and T22 set it from recent scores.
- Reason: the design says the target is set so about 80% of recent players reach it, but there are no recent players yet. The simulated player in `tuning.test.ts` stacks far more than 10, so 10 errs towards passing.
- How to change it later: the default in `public.ensure_game_day` now; `game_settings` from T16; a day's own `pass_target` can be edited directly.
- Confirmed by human: yes, keep for now (Nov 9); re-tuned with the grid Tower (T76) so a decent player reaches about row 10.

### 2026-11-09 — Attempts belong to a profile (T11)
- Choice: `attempts.user_id` references `profiles` (cascade on delete), not `auth.users` directly.
- Reason: a scored attempt needs an eligible account (T12 refuses players without a profile), and the database then enforces it too. Deleting an account removes its profile and attempts.
- How to change it later: a migration changing the foreign key.
- Confirmed by human: not needed (no Open item); recorded for reviewers.

### 2026-11-09 — An abandoned attempt cannot be restarted (T12)
- Choice: starting an attempt creates its row at once; leaving before finishing never counts toward the pass rate (only submitted attempts are counted), but the player cannot start again that day. `POST /api/attempts/start` answers 409 `already-started` with `submitted: false`.
- Reason: the design says abandoning "records nothing", yet a restart would replay the same seed, so the player would already know the instance (for example Flash Count's dot count). Refusing the restart keeps the one-attempt rule meaningful. T14 states the rule on the play page before Start.
- How to change it later: let `startAttempt` return the existing unsubmitted attempt, but only with a fresh seed, which needs a migration allowing the seed to change.
- Confirmed by human: changed (Nov 9). No restart, and leaving early is a loss: a started attempt counts as an attempt that did not pass (see the next-but-one entry).

### 2026-11-09 — Submissions after the deadline record nothing (T13)
- Choice: `POST /api/attempts/submit` answers 409 `day-closed`, and stores nothing, once the attempt's game date has passed or its day is closed, even if the attempt started before the deadline. `record_attempt_result` repeats both checks (closed, and game date passed by the database clock) under row locks, so the close job and a late submission cannot interleave.
- Reason: the day's pass rate must be final at the deadline; accepting late results would change a day that has already closed for everyone. Since T87 a run has no time limit, so a run still going at the deadline does not count; players should start well before it.
- How to change it later: a grace period would need the close job (T21/T23) to wait for it, plus a matching check in `submitAttempt`.
- Confirmed by human: yes (Nov 9), no grace period.

### 2026-11-09 — Focus after a run ends (T60)
- Choice: when a run ends, focus moves to the result heading (`tabIndex={-1}`), not to "Play again"; Tab reaches the button next. When a run starts, the game canvas takes focus.
- Reason: players drop blocks with Space, and a run usually ends mid-tap. Focusing "Play again" would let that same Space restart the run at once. Focusing the heading also makes screen readers announce the score, and needs no timing delay. T14's `/play` result view should do the same.
- How to change it later: `StackingPractice.tsx` (the focus effect) and `StackingGame.tsx` (the canvas focus on start).
- Confirmed by human: not needed (accessibility detail, no Open item); recorded for T14.

### 2026-11-09 — Human decisions at the M1 play-test (overrides)
- Choice:
  - **Look:** UI guidelines v2, the Fresh Sport direction (deep teal, mint, tangerine, Unbounded and Manrope, purposeful motion), replacing strict Material 3 and the terracotta placeholder.
  - **Names:** Teetering Tower (stacking), Second Sense (Inner Clock), Swift Sum (Flash Count).
  - **Tower:** an arcade-style column grid, 7 columns and 3 cells wide, forced narrowing at set heights, overhanging cells lost, ends only on a miss, capped at a winning top row; a decent player should reach about 10 (T76). Supersedes the T09 speed-range entry.
  - **Leaving early is a loss:** a started attempt counts in the day's attempts and only a recorded pass counts as a pass (T17). This overrides the design doc's "abandoning before finishing records nothing".
  - **Score** stays a whole block count; **no grace period** after the deadline; **location** stays self-declared until the human researches contest rules.
- Reason: the human's play-test feedback (Nov 9, 2026).
- How to change it later: ask the human; each is recorded in the task that implements it.
- Confirmed by human: yes (these are the human's decisions).

### 2026-11-09 — Teetering Tower grid tuning and the idle drop (T76)
- Choice:
  - **Board:** 7 columns by 15 rows, starting 3 wide; capped at 2 from row 6 and at 1 from row 11. Row 1 rests on the floor. Each new row appears at a wall, alternating direction.
  - **Speed:** row r steps every `startStepMs - stepDecayMs × (r − 1)` ms, never under 45 ms. Per seed: `startStepMs` 150 to 170 and `stepDecayMs` 6 to 8 (whole ms), plus the starting column and direction. Row 15 steps every 52 to 80 ms.
  - **Tuning check** (`tuning.test.ts`, a simulated player tapping with an even timing error, averaged over 200 seeds): perfect reaches 15, decent (±80 ms) about 9.7, careless (±250 ms) about 4.
  - **Idle drop** (judgment call; removed by T87, the human's decision): a row nobody tapped for 8 s dropped off and ended the run like a miss. Now a row waits for its tap indefinitely, and the server refuses a submission whose taps do not finish the run.
- Reason: the human's M1 play-test requirements (arcade-style grid, forced narrowing, end only on a miss, a winning top row, a decent player reaches 10). Supersedes the T09 speed-range entry.
- How to change it later: `PARAM_RANGES`, `MIN_STEP_MS` and `WIDTH_CAPS` in `src/challenges/stacking/engine.ts`; the tuning and golden tests pin them, so a change is deliberate.
- Confirmed by human: speed yes, for now (Nov 10; more testers later). Idle drop: changed, removed so slow players are never timed out (T87; see "Human decisions at the second play-test").

### 2026-11-10 — The header hides during a running game (T81)
- Choice: while a game runs (practice or `/play`), the top bar (wordmark, Sign in or Sign out) is hidden like the back button, keeping its space so the board does not move; it returns with the result.
- Reason: UI rule 8 removes the way back during a running game. On `/play` a stray tap on a header link mid-run would forfeit the day's only attempt (leaving early counts as not passed), and treating practice the same keeps the game screen consistent and focused.
- How to change it later: the `:global(body):has([data-game-running]) .bar` rule in `src/components/AccountHeader.module.css` (narrow it to `/play` by adding a marker only PlayToday sets).
- Confirmed by human: yes (Nov 10).

### 2026-11-09 — Which forms keep a typed password after an error (T75)
- Choice: sign-up keeps both the password and its confirmation after a failed submit (the human's play-test request); sign-in still clears the password after "Email or password is incorrect", the usual practice, so a wrong password is not resubmitted by accident. Neither password is ever sent back by the server.
- Reason: the play-test feedback named the create-account form only; T75's criteria cover `/signup`.
- How to change it later: `SignInForm.tsx` could keep its password the way `SignUpForm.tsx` does: save the values in a ref at submit and write them back to the inputs in a layout effect after React's form reset. Never use `defaultValue` for a password, which puts it in the page's HTML as a `value` attribute.
- Confirmed by human: yes (Nov 10).

### 2026-11-10 — Human decisions at the second play-test (overrides)
- **Tower speed:** keep the current tuning; fine-tune later with more testers (NEEDS_HUMAN).
- **Idle drop:** remove it. "We don't want to time out slow players." A row waits for its tap as long as the player likes (T87). Consequences: a run is no longer bounded in time, so the 3-minute submission age limit goes too (the day's deadline still applies, and the "taps from the future" check stays); a player who walks away mid-run never submits, which counts as an attempt that did not pass (T17).
- **Result wording:** use rows, as the HUD does: "You reached row 7. Today's target was row 10." (T85).
- **Result layout:** the practice layout (big score above the heading) for both result screens (T79).
- **Accessibility:** keep building it in; the human tests it later in one pass (NEEDS_HUMAN).
- Confirmed by human: yes (these are the human's decisions).
