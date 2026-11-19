# Decisions made by agents

Judgment calls on items `docs/DESIGN.md` marks as Open. Each one is also flagged in `docs/NEEDS_HUMAN.md` for confirmation. If the human overrules a decision, record that here too.

<!-- Format:
### YYYY-MM-DD — <item> (T05)
- Choice: ...
- Reason: ... (cite the design doc's recommendation if there was one)
- How to change it later: e.g. edit GAME_DEADLINE_UTC in src/lib/config.ts or the admin page
- Confirmed by human: pending | yes | changed to ...
-->

Older entries (everything up to Nov 19, 2026) are in `docs/archive/DECISIONS-to-2026-11-19.md`. Search it only when you need history.

### 2026-11-18 — Second Sense rounds (T180-T183)
- Choice: (1) The default pass target stays 4, which now means "survive all four rounds"; admins can set fractions such as 4.5. (2) The balance test models a player's error as 15% of the target (sd), not a flat 1000 ms, and expects 30 to 70% of runs to survive. (3) The cheat check flags 3 or more rounds of one run under 25 ms off target. (4) Old-scale scores are left out of the percentile through a new `challenge_types.scores_since` date, set to the day after the migration runs (UTC). (5) The bank shows seconds to one decimal ("8.8 s").
- Reason: Open items (targets, thresholds); the backlog proposes these, and a flat 1 s error would make 15 to 25 s targets too easy compared with real counting.
- How to change it later: `game_settings.default_pass_targets` or /admin; `src/challenges/inner-clock/timeBank.test.ts`; `src/config/cheat.ts`; `challenge_types.scores_since`.
- Confirmed by human: pending (NEEDS_HUMAN, M6 calls)

### 2026-11-18 — Swift Sum rounds (T184-T186)
- Choice: (1) Five rounds against a 10-dot bank; round i draws 6+3i to 11+3i dots; the flash goes from 1800 to 1400 ms. (2) Default pass target 5, "survive all five". (3) The reveal ("Right on", "Off by N") shows 1.2 s, then each round has its own 3-2-1. (4) `lastInputMs` stays the last answer's time: answers are timed from the run's start, so it already covers every 3-2-1, flash and reveal. (5) Old-scale scores are left out through `scores_since` (as T183).
- Reason: Open items (targets, numbers); the backlog proposes (1), (2) and (5).
- How to change it later: `src/challenges/flash-count/flashLadder.ts` constants; `game_settings.default_pass_targets` or /admin.
- Confirmed by human: pending (NEEDS_HUMAN, M6 calls)

### 2026-11-18 — Echo Path as one growing path (T187-T191)
- Choice: (1) A 5 x 10 board; one path per attempt, 12 to 18 tiles from the bottom row to the top, never revisiting a tile, at most 8 sideways steps; a seed with no such walk in 20 tries falls back to a fixed zigzag. (2) Start at 4 tiles, one more per clear; 3 lives; a miss replays the same length; playback 300 to 400 ms a tile. (3) Score = longest path repeated + lives left / 3. (4) Default pass target 10, "a path of 10 tiles" (the board's height). (5) Keyboard: arrows move a ring (the first key only shows it), Space or Enter taps. (6) The `echo-path-robotic` rhythm check now reads only the gaps inside each echo: across a long run, the pause and playback before each echo hid a script's even taps. Thresholds unchanged. (7) Old-scale scores are left out through `scores_since` (as T183).
- Reason: Open items (board width, minimum length, timing, target); the backlog proposes (1), (2) and (4). (6) came from T191's scripted-run test failing.
- How to change it later: `src/challenges/echo-path/path.ts` and `engine.ts` constants; `game_settings.default_pass_targets` or /admin; `src/config/cheat.ts`.
- Confirmed by human: pending (NEEDS_HUMAN, M6 calls)

### 2026-11-18 — Fair Split as five rounds against a bank (T192-T196)
- Choice: (1) Five shapes a run from 13 kinds (9 curved, 4 angular), drawn 75% curved, no kind twice, each seeded so the same kind differs run to run. (2) A 6-point bank; a cut costs its distance from 50% in points (0.01 steps); 25 s a shape, and at the limit the screen cuts the line where it is (a cut past the limit, which only a made-up run sends, costs 50). (3) The pieces show 1.2 s, then a 3-2-1 before every shape, the first included; the clock runs from the game's start, so `lastInputMs` is the run's end. (4) The line starts straight down the middle; no live percentage while placing it; Cut or Enter commits, letting go never does; arrows slide it 0.25 units, [ and ] turn it 1 degree. (5) The 3-2-1s are drawn by the game's own frame loop, not the shared RoundCountdown, so screen and engine share one clock. (6) Default pass target stays 5, now "survive all five"; old-scale scores are left out through `scores_since` (as T183). (7) Cheat checks: 3 cuts within 0.05 points of half, or a surviving cut under 1.5 s after its shape appeared. (8) The balance test reads the backlog's "0.6 aim error" as a 0.6-unit standard deviation of the line's offset: about 90% of such players survive all five.
- Reason: Open items (shape mix, bank, timing, target, thresholds); the backlog proposes (1), (2), (4) and (6).
- How to change it later: `src/challenges/fair-split/shapes.ts`, `engine.ts` and `render.ts` constants; `game_settings.default_pass_targets` or /admin; `src/config/cheat.ts`.
- Confirmed by human: pending (NEEDS_HUMAN, M6 calls)

### 2026-11-18 — M6 calls shared by the four games (T197, T198)
- Choice: (1) "Targets 15 to 25 seconds" is read as each round's interval: round i (from 0) draws 15 + 2.5i to 17.4 + 2.5i s in 0.1 s steps. The clock shows for the first 2 s of every round, and a round with no tap ends at its target plus the 10 s bank. (2) A round whose cost equals what is left of the bank survives; only a cost above it ends the run (all four games). (3) `challenge_types.scores_since`: each reworked game's scores before the rework are on another scale, so they are left out of its pass-target percentile until new scores build up; the Tower has none. (4) The per-player variation the backlog asks for is the per-attempt seed: every attempt gets its own seed, so two players never share a Second Sense target list, a dot layout, a path or a shape set. The e2e test checks this for the day's three lineup games; each engine's own tests cover the rest. (5) Echo Path's path never revisits a tile, so each tile is tapped at most once per echo. (6) The Teetering Tower is unchanged in M6.
- Reason: Open items; the backlog proposes (1) to (4). (2) keeps "0 left" a survival, as players read a bank reaching zero.
- How to change it later: `src/challenges/inner-clock/timeBank.ts` (`TARGET_RANGES_MS`, `REVEAL_MS`, `BUDGET_MS`); each engine's bank check; `challenge_types.scores_since` in a migration; `src/challenges/echo-path/path.ts`.
- Confirmed by human: pending (NEEDS_HUMAN, M6 calls)

### 2026-11-18 — Where M6 departs from DESIGN.md (T198)
- Choice: the games table and its scoring text no longer describe four games; the backlog's M6 rules win. (1) Second Sense: "budget placeholder 3.0 s; the run ends when the budget runs out; survive N rounds; target length rises, clock fades sooner" became four fixed rounds against a 10 s bank, 15 to 25 s targets, a 2 s clock every round and a 3-2-1 every round. (2) Swift Sum: "a wrong count costs one of 3 lives; more dots, shorter flash" became five rounds against a 10-dot bank, with no lives and no tolerance. (3) Echo Path: "grid size; a mistake gives a new sequence of the same length" became one 5 x 10 path per player, growing a tile a round; a mistake replays the same length. (4) Fair Split: "within plus or minus 1 point counts; a cut outside costs one of 3 lives; a time limit per cut; concave shapes" became five rounds against a 6-point bank, curved and abstract shapes, a movable line with a Cut button and a 25 s limit.
- Reason: the owner's M6 rework (backlog M6) replaces these rules; agents never edit DESIGN.md.
- How to change it later: the owner updates DESIGN.md (NEEDS_HUMAN, "Please update DESIGN.md").
- Confirmed by human: pending (NEEDS_HUMAN, update DESIGN.md)

### 2026-11-18 — M7 play-test tweaks (T201-T213)
- Choice: (1) Second Sense: a 2 s bank (owner); four rounds whose targets rise 10.0-12.4, 12.5-14.9, 15.0-17.4, 17.5-19.9 s. The simulated player uses a 600 ms spread, not the backlog's 250 ms: at 250 ms nearly everyone survived, and the backlog said to tune the spread, not the 30-70% band. (2) Stopwatch use: no game change (owner); the existing `time-bank-implausible` check stays as it was. (3) Swift Sum: each round draws 10 to 30 dots uniformly from the seed, with no growth by round (owner). The bank stays 10 dots: the simulation gives about 41% survival, above the 15% floor that would have raised it. Swift Sum has no `levels` label to reword, so only the how-to and tagline changed. (4) Trail Trace: a 5 x 8 board (owner); paths of 8 to 12 tiles from the bottom row to the top. "Touch" means sharing an edge (owner), so the rule reads: a path tile shares an edge only with the tiles just before and after it. The backlog's T214 text says "eight neighbours"; that was replaced by the owner's edge-only reading. Over 1 000 seeds, 988 paths are distinct (bound 90%). The fallback is a fixed zigzag, not the backlog's straight climb, which breaks the two-in-a-row rule. (5) Clean Cut: every drawn shape gets a seeded smooth warp, kept only if `asymmetry()` measures at least `MIN_ASYMMETRY` = 0.04 (the least lopsided shape over seeds 0 to 999 measures 0.040) and it still fills 27% of the box; no kind was removed (13 kinds). An 8-point bank (owner): the simulated cutter survives all five shapes 98.7% of the time. (6) Pass targets: Second Sense 4, Swift Sum 5, Trail Trace 8 (was 10; the board's new height), Clean Cut 5. (7) Cheat thresholds: none changed; each game's honest fixture raised no flags. (8) Echo Path and Fair Split are shown as Trail Trace and Clean Cut; the stored keys, routes, folders and flag names stay. (9) Each game's `scores_since` was reset again to the day after its M7 migration ran.
- Reason: the owner's M7 list (backlog M7, approved Nov 18); the rest are the backlog's proposals, tuned as noted.
- How to change it later: `src/challenges/inner-clock/timeBank.ts`; `src/challenges/flash-count/flashLadder.ts`; `src/challenges/echo-path/path.ts`; `src/challenges/fair-split/shapes.ts` and `engine.ts`; `game_settings.default_pass_targets` or /admin; `src/config/cheat.ts`; `src/config/challenges.ts` for names.
- Confirmed by human: (1) bank, (2), (3) count rule, (4) board and touch rule, (5) bank and (8) by the owner; the rest pending (NEEDS_HUMAN, M7 calls)

### 2026-11-18 — Code names follow the stored keys; shared round loop (T199, T200)
- Choice: (1) Swift Sum and Second Sense code follows the keys `flash-count` and `inner-clock`, as Trail Trace and Clean Cut follow theirs: each engine is `engine.ts` (`flashCount`, `innerClock`), the run components are `FlashCountGame` and `InnerClockGame`, and the single-round ones are `FlashCountShowing` and `InnerClockTap`. Player-facing words ("time bank", "dot bank") are unchanged. (2) Only Swift Sum and Second Sense repeat the countdown, round and reveal loop, so it moved into `useRevealRounds`; Trail Trace and Clean Cut drive their phases from their own frame loops and keep them. (3) The three bank games' practice results share `bankResult`; Trail Trace counts lives and the longest path, so it keeps its own.
- Reason: names keyed to stored values do not go stale when a game is renamed again; the backlog asks to check first whether all four repeat the loop.
- How to change it later: `src/components/rounds/useRevealRounds.ts`, `src/components/practice/bankResult.ts`.
- Confirmed by human: not needed (no behaviour change)

### 2026-11-18 — Where M7 departs from DESIGN.md (T214)
- Choice: as T198, the backlog's M7 rules win over DESIGN.md's games table: Second Sense targets 10 to 20 s against a 2 s bank; Swift Sum a random 10 to 30 dots each round; Trail Trace paths of at most 12 tiles on a 5 x 8 board that never touch themselves; Clean Cut lopsided shapes only and an 8-point bank; the names Trail Trace and Clean Cut.
- Reason: agents never edit DESIGN.md.
- How to change it later: the owner updates DESIGN.md (NEEDS_HUMAN, "Please update DESIGN.md").
- Confirmed by human: pending (NEEDS_HUMAN, update DESIGN.md)
