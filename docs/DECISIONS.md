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

### 2026-11-10 — Launch values in game_settings (T16)
- Choice: one admin-editable `game_settings` row holds: survival threshold 60%; pass target at the 80th percentile (the score 80% of recent players reach); pass-target and threshold steps per streak day of 0 (flat for now); new accounts count fully from day one (weight 1.0, full weight after 0 days); a percentile over the last 14 days needing at least 50 scores; a stacking default pass target of 10 rows. `ensure_game_day` now reads its defaults from this row.
- Reason: the design's Open items "survival threshold and pass-target percentile", "how pass targets and threshold rise as the streak grows" and "how much new accounts count" come with suggestions for the first two (60% when about 80% pass; a rise that is configurable, here flat at 0). The design gives no recommendation for new accounts; full weight from day one comes from the backlog's T16 notes as the simplest start. The lookback of 14 days and minimum sample of 50 have no recommendation either, so they are placeholders.
- How to change it later: an admin updates the row (the admin page in a later M2 task, or SQL as an admin); no migration needed. Only users with `profiles.is_admin = true` can update it.
- Confirmed by human: yes (Nov 10).

### 2026-11-10 — Counters use the weight an attempt started with (T17)
- Choice: each attempt stores `counted_weight`, the player's `profiles.weight` when it starts (a before-insert trigger). The start adds it to `weighted_attempts` (an after-insert trigger, in the start insert's transaction) and a recorded pass adds the same value to `weighted_passes`. Existing attempts are counted once by the migration.
- Reason: the backlog says the pass uses "the submitting user's `profiles.weight`". If the weight changed mid-day (for example an account flagged at noon), reading it again at submit could add more to weighted passes than the attempt added to weighted attempts, so the pass rate could exceed 100%. One stored weight keeps both sides consistent, and lets the close job (T21) recount from the rows. The table also refuses passes above attempts.
- How to change it later: a migration changing `count_started_attempt` and `record_attempt_result`.
- Confirmed by human: not needed (implementation detail within the backlog's intent); recorded for reviewers.

### 2026-11-10 — Wording when a result is refused or not sent (T17)
- Choice: a submission the server refused (day closed, implausible timing) shows "Counted as not passed" and "...so it counted as not passed."; one that never arrived shows "Result not sent" and "Reload the page to see whether it counted."
- Reason: from T17 a started attempt counts, so "Not counted" became wrong (the T74 spec review asked for this rewording). A result that never arrived may have been recorded, so it claims neither.
- How to change it later: `SUBMIT_REFUSED`, `REFUSED_HEADING` and `SUBMIT_FAILED` in `src/app/play/PlayToday.tsx`.
- Confirmed by human: yes (Nov 11).

### 2026-11-10 — Hide the meter for the final 3 hours (T18)
- Choice: from 3 hours before the deadline until the deadline, `GET /api/meter` answers `status: "hidden"` with the threshold and closing time only, and no pass rate or attempt count at all. `METER_HIDE_HOURS = 3` in `src/config/meter.ts`.
- Reason: the design's Open item "How to handle last-minute sniping" recommends hiding the meter for the final hours; the backlog sets 3 as the configurable placeholder. Leaving the fields out, not nulling them, means a client cannot show them by accident.
- What makes it real (T18 quality review): the anon key ships to every browser, so T17's "counters readable by everyone" would let anyone read the live numbers straight from Supabase during the window. Migration `20261110020000_private_day_counters` drops that read policy and the table privileges; only the service role reads the counters, and `/api/meter` reads them that way. The proxy skips `/api/meter`, so no session refresh can put a cookie on the shared, cached answer, and the cache time shrinks near 21:00 and midnight so a cached "open" reading is never served into the window.
- How to change it later: edit `METER_HIDE_HOURS` (the meter UI, T19, reads the same constant).
- Confirmed by human: no (Nov 11). Show the meter until the deadline; hide it later only if sniping becomes a real problem (T103).
- Update (T103): `METER_HIDE_HOURS = 0`; the endpoint never answers `hidden` before the deadline and open readings cache up to it. The hidden path stays in place and tested, so setting a non-zero value turns it back on. The private-counters migration is kept.

### 2026-11-10 — The meter before today's game day exists (T18)
- Choice: if nobody has started today and the day's row does not exist yet, the meter answers `threshold: null`, `attempts: 0`, `passRate: null`, instead of reading the default threshold from `game_settings`.
- Reason: the endpoint must read only `game_days` and `game_day_counters` in one query (T18). Once the close job (T21) prepares each next day, the row always exists, so this is a short-lived early state.
- How to change it later: `readMeter` in `src/lib/meterRead.ts`.
- Confirmed by human: not needed (implementation detail); recorded for reviewers.

### 2026-11-11 — A start on a closed day is refused in the database (T93)
- Choice: the attempt insert trigger refuses an insert for a game day with `closed_at` set (SQLSTATE `WS001`), share-locking the day row so it cannot race the close job. `POST /api/attempts/start` answers 409 `{ error: "day-closed" }`, and `/play` says "Today's challenge just closed. Press Start to play the next one." (Start stays available and starts the new day). A recorded pass whose day has no counters row raises instead of recording an uncounted pass. `attempts.counted_weight` is not null.
- Reason: from the T17 quality review and the maintainer check after T18: a start that works out its game date just before the deadline and inserts after the close job ran would change a closed day's counts after its outcome was fixed.
- How to change it later: `count_started_attempt` and `record_attempt_result` (migration `20261111000000_day_counter_integrity`); the message in `src/app/play/PlayToday.tsx`.
- Confirmed by human: not needed (a bug fix); the new message follows the existing refused-start wording.

### 2026-11-11 — Seeding a day other than today (T20)
- Choice: `npm run seed:dev` records today's results through `record_attempt_result`, as the backlog asks. For `--date` on another day it writes each result directly and adds each pass to that day's counters right after, with the attempt's own `counted_weight`, so the counters end the same as if `record_attempt_result` had recorded them. It refuses a closed day.
- Reason: `record_attempt_result` deliberately refuses any game date but today (the deadline rule), so the backlog's "through record_attempt_result" cannot hold for other dates without weakening that rule.
- How to change it later: `runSeed` and `supabaseSeedDeps` in `scripts/seed-dev.mts`. T37 (`simulate:days`) meets the same constraint and can reuse this path.
- Confirmed by human: not needed (dev tooling); recorded for reviewers.

### 2026-11-10 — Wording for a started, unsubmitted attempt (T91)
- Choice: "You started today's attempt but haven't finished it here. If it's still open in another tab, finish it there before the day ends. Otherwise it counts as not passed. Come back tomorrow."
- Reason: since T87 a run has no time limit, so a run still open in another tab can be submitted; the old "You left today's attempt before finishing, so it counted as not passed" could be wrong.
- How to change it later: the abandoned view in `src/app/play/PlayToday.tsx` (T91).
- Confirmed by human: yes (Nov 10).

### 2026-11-11 — A day nobody played breaks the streak (T21)
- Choice: a day with no weighted attempts (nobody played, no game day row at all, or only zero-weight accounts) closes as `broken` with `final_pass_rate` null. `close_game_day` also refuses a day before its deadline and a day while an earlier day is still open (days close in order). A broken day ends the run on its last survived day. A day with no row at all is a gap and counts as not survived: a survived day after it starts a new run rather than extending across it.
- Reason: the backlog's judgment call. The design's rule is "survives if the day's pass rate meets the threshold"; with no attempts there is no rate to meet it, and a world that does not show up has not held the line.
- How to change it later: the `v_outcome` line in `close_game_day` (a new migration); the empty-day cases in `supabase/tests/daily_close.test.sql`.
- Confirmed by human: yes (Nov 11).

### 2026-11-11 — One path prepares every game day (T22)
- Choice: `ensure_game_day(d)` computes the pass target (`pass_target_for`: the `pass_target_percentile` best score of the `percentile_lookback_days` days before `d`, given `percentile_min_sample` scores, else the default; plus the streak step in the harder direction) and the threshold (`default + threshold_streak_step × current streak`, at most 0.95). `close_game_day(d)` calls it for `d + 1` after updating the streak, and an attempt start calls it for today. An existing day is never touched.
- Reason: the backlog puts the computation in the close, but a player starting just after midnight (before the close job runs, T23) would otherwise create the day with the plain defaults. One path keeps both the same. The only difference in that race is the streak used for the steps, which is one day behind; with the launch steps at 0 it changes nothing.
- How to change it later: `pass_target_for` and `ensure_game_day` (migration `20261112010000_prepare_next_day`); the values are the admin-editable `game_settings` (T16, confirmed).
- Confirmed by human: not needed (the values are the confirmed T16 settings); recorded for reviewers and T23.

### 2026-11-11 — /admin creates the next 7 days early (T25)
- Choice: as the backlog asks, opening `/admin` creates any missing day among today and the next 7 with `ensure_game_day`. A day created early gets the pass target and threshold that today's scores and streak give, and keeps them, since `ensure_game_day` never touches an existing row. So until an admin edits it, it misses the streak step and the newer scores it would have got from the close the night before.
- Reason: the admin needs rows to edit (T99). With the launch steps at 0 only the percentile target differs, and only once there are 50 recent scores.
- How to change it later: T99 could show such days as "provisional" and recompute any unedited, unstarted future day at the close (for example with an `edited` flag), or `/admin` could list future days without creating them until one is saved.
- Update (T99, admin edits of a started day): an admin may still edit today (or any open day) after players have started. The backlog wants today's threshold change to show in the meter. A pass target change also judges later submissions by the new target, while passes already recorded stay counted. Left to the admin's judgment; NEEDS_HUMAN asks whether the pass target should lock once a day has attempts.
- Update (T99): done the first way. `game_days.edited` is set by an admin's save, and `ensure_game_day` refreshes any day that is not edited, not started and not closed. So an early day picks up the streak and recent scores at the close before it, and also follows a change to `game_settings` until then. An admin's edit, or anyone starting the day, freezes it.
- Confirmed by human: yes (Nov 11), and the pass target must also lock once anyone has started the day (T102). The threshold stays editable.

### 2026-11-11 — Human decisions at the M2 play-test (overrides)
- **Empty day:** breaks the streak, as built (T21).
- **Coming days:** follow the settings until edited or started, as built (T99). Today's pass target locks once anyone has started the day (T102).
- **Hidden meter:** not wanted for now. "We can always later hide it if it becomes an active problem in real play." The meter shows until the deadline (T103).
- **Refused or not-sent wording:** keep it (T17).
- **Meter and streak look:** the meter is the core of the game and should be the star of the home screen, maybe its top element; the streak card should be more interesting too. Three mockups (gauge, tower meter, rising tide): https://claude.ai/artifact/MRXZU4jQW9RvVqLLDohXXQ. Chosen: A's gauge meter and play card; the streak card takes A's header with C's bar chart over 14 days ("Chosen" artboard). Built as T104 (meter) and T105 (streak card).
- No other issues found in the play-test.
- Confirmed by human: yes (these are the human's decisions).

### 2026-11-12 — Daily rotation (T31)
- Choice: every day's challenge is `game_settings.rotation[(date - 2027-01-01) mod n]`, default Teetering Tower, Second Sense, Swift Sum in turn (the MVP's three; the Open item "which challenges join the rotation after the first three" stays open). A day nobody has edited or started follows the rotation, so a day created early (by `/admin`) changes with it. Nov 12, 2026 is a Second Sense day.
- Reason: the backlog's formula; a plain cycle is easy to predict and to change.
- How to change it later: update `game_settings.rotation` (any known challenge types, at least one); an admin choosing one day's challenge is T111.
- Confirmed by human: pending (NEEDS_HUMAN).

### 2026-11-11 — Gauge details (T104)
- Choice: the pill compares the rounded numbers on screen, but its colour follows the real comparison; a day that rounds to the line while below it says "Just below the line", never "Right on the line". The mint glow is 0.16 (the mockup's 0.22 left muted text at 4.3:1). The home page drops the big title and pitch, as the chosen artboard does (the h1 stays for screen readers).
- How to change it later: `standing()` in `src/components/Meter.tsx`; `--fs-glow-mint` in `tokens.css` (and `METER_TINTS`); `src/app/page.tsx`.
- Confirmed by human: pending (NEEDS_HUMAN).
