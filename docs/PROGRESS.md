# Progress

Agents update this file after every task, newest entries first. A fresh session reads it to know where things stand.

## Current status

- Milestone: M9 New games (Bank Shot, Arrow Flip) approved Nov 24. Phase 1 is a practice-only MVP (batches M9-a to M9-c), then stop for the owner's play-test before phase 2 (M9-d, M9-e).
- Active task: none. Phase 1 is done; waiting for the owner's M9 MVP play-test.
- Blocked tasks: none
- Waiting on the human: the M5 Daily Three please-confirm; updating DESIGN.md for M6 to M8; T45 AdSense; T52 Turnstile keys; deployment (docs/DEPLOYMENT.md, then T128); `.env.example` lines. See docs/NEEDS_HUMAN.md.
- Next: M9 re-planned after the owner's play-test (Bank Shot retune T247–T248; Arrow Flip replaced by the Stroop game Ink, T249–T253; batches M9-f, M9-g, M9-h, then a practice play-test stop, then M9-d, M9-e). The re-plan awaits the owner's approval; once approved, merge branch `docs/m9-replan` through a docs PR and start M9-f.

## Log

Older entries (everything up to Nov 19, 2026) are in `docs/archive/PROGRESS-to-2026-11-19.md`. Search it only when you need history.

- 2026-11-24 T236–T238, T246 done, PR #198: Arrow Flip engine (five rounds of six prompts, a 2.2 s time bank set by a simulated careful player, not the plan's 6 s), swipe/button/key input, renderer, game and an unregistered practice page listed as New. Owner to confirm the numbers in T244.
- 2026-11-24 T232–T233, T245 done, PR #197: Bank Shot renderer, game (glimpse, marker, Lock in, reveal) and an unregistered practice page, listed on the hub as New.
- 2026-11-24 T230–T231 done, PR #196: Bank Shot geometry (closed-form wall bounces, a 1 ms stepped trace past the spinning bumper) and the five-round engine. The bank is 14 units, not the plan's 30, set by a simulated careful player; owner to confirm in T244.
- 2026-11-20 T228–T229 done: a shared phone check that each game's main control is wholly on screen; Swift Sum's board now also shrinks with the screen's height on phones, so Submit sits at least 16 px clear of the bottom (it was 10 to 36 px off screen). Owner accepted the M8 play-test.
- 2026-11-19 T215–T216 done, PR #192: exact scale-reset checks and one re-target test in pgTAP; the local warm-up opens every admin page, so the admin e2e passes from a cold server. Also fixed T226's Swift Sum ten-run test (an answer of 1 did not always bust the bank). Maintainer check after M8 added T228 and T229.
- 2026-11-19 T226–T227 done, PR #191: practice e2e checks for the M8 changes (25-dot cap over ten runs, new shapes each run, counter bars, no big score); M8 decisions recorded.
- 2026-11-19 T224–T225 done, PR #190: numbered round counter joined by bars; the bank games show rounds got through and pass or fail, no score. CI's first run hit a registry rate limit; the re-run passed.
- 2026-11-19 T221–T223 done, PR #189: Clean Cut draws irregular blobs (70%) and polygons with MIN_ASYMMETRY 0.08, plus its scale reset; cutter survival 98.3%.
- 2026-11-19 T217–T220 done, PR #188: Second Sense 4 s bank, Swift Sum 10 to 25 dots, Trail Trace 2 lives, and their scale reset.
- 2026-11-19 docs: M8 planned (PR #186); BACKLOG, PROGRESS and DECISIONS trimmed to active content, full copies in `docs/archive/`.
- 2026-11-18 T199–T200 done, PR #184: Swift Sum and Second Sense code names follow their keys; their round loop is one hook (`useRevealRounds`) and the bank games share `bankResult`. M7 maintainer check added T215 and T216.
- 2026-11-18 T213–T214 done, PR #183: e2e checks for Swift Sum's 10–30 counts, Trail Trace's self-avoiding paths, the Clean Cut bank and a centred 3-2-1 on phones; M7 decisions and please-confirms recorded. M7 complete.
- 2026-11-18 T210–T212 done, PR #182: Clean Cut shapes all lopsided (`MIN_ASYMMETRY` 0.04), an 8-point bank (98.7% simulated survival), and its scale reset.
- 2026-11-18 T207–T209 done, PR #181: Trail Trace on a 5 x 8 board, paths of 8 to 12 tiles that never share an edge with themselves (target 8), and its scale reset.
- 2026-11-18 T205–T206 done, PR #180: Swift Sum draws a fresh 10 to 30 dots every round (bank stays 10; simulated survival 41%), and its scale reset.

- 2026-11-18 T201–T204 done, PR #179: Echo Path and Fair Split shown as Trail Trace and Clean Cut; Second Sense targets of 10 to 20 s against a 2 s bank (simulated spread 600 ms), a centred 3-2-1, and its scale reset.
