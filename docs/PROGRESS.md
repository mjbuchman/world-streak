# Progress

Agents update this file after every task, newest entries first. A fresh session reads it to know where things stand.

## Current status

- Milestone: M9, one new game. Confusing Colors (`ink`) is the only one shipped (Arrow Flip and Bank Shot dropped); the owner started phase 2 on Nov 27.
- Active task: none. M9 is complete; stopped for the owner's M9 play-test.
- Blocked tasks: none
- Waiting on the human: the Confusing Colors please-confirm and DESIGN.md update; the M5 Daily Three please-confirm; updating DESIGN.md for M6 to M8; T45 AdSense; T52 Turnstile keys; deployment (docs/DEPLOYMENT.md, then T128); `.env.example` lines. See docs/NEEDS_HUMAN.md.
- Next: the M9 play-test. A full honest Confusing Colors run takes about 45 s (worked out from the engine timings: 3-2-1, then 30 words at about 1.4 s each).

## Log

Older entries (everything up to Nov 19, 2026) are in `docs/archive/PROGRESS-to-2026-11-19.md`. Search it only when you need history.

- T241–T244 (PR #210): Confusing Colors joins the daily pool of six (the untouched launch pool gains it; edited pools and created days are left alone), with practice, Daily Three, history and phone e2e, and the M9 docs. Full review, all approved first round. The word canvas got `touch-action: none` for the no-zoom check. Admin sign-ins and "two simultaneous starts" flake under local load.

- 2026-11-27 T239, T240 done, PR #209: Confusing Colors registered (migration: type, target 30; not yet in the pool), cheat checks `ink-too-fast` and `ink-robotic`. CI e2e "two simultaneous starts" failed once (race in the test, unrelated), passed on rerun.
- 2026-11-27 T258 done: owner play-test "pretty good"; Ink renamed Confusing Colors, 30 words, bank 3.2 s kept, mismatches 5-7-9 per 10, score 0 to 31. Simulated careful survival 87%.
- 2026-11-25 T257 done, PR #207: Bank Shot deleted (engine, geometry, game, practice page, tokens, hub entry); `/practice/bank-shot` is a 404. Shared bank helpers, `BankGauge` and `RoundProgress` stay (other games use them).
- 2026-11-25 T254–T256 done, PR #206: Ink is one run of 40 words (one 3-2-1, one 3.2 s bank, mismatches ramp 4 to 7 of 8, score 0 to 41, target 40) with a thin outline on all four inks; single-bar `BankGauge`. Unrelated local e2e flakes (admin sign-in, stale streak data); CI green.
- 2026-11-24 T251–T253 done, PR #203: Ink game (2 x 2 labelled ink buttons, keys 1 to 4), `/practice/ink` listed as New, Arrow Flip deleted. The e2e checks the board and buttons fit a 390 x 664 screen.
- 2026-11-24 T249–T250 done, PR #202: Ink engine (five rounds of eight colour words, a 4 s time bank set by the simulation), four inks apart in lightness with a light halo on the dark ones, keys 1 to 4 and the renderer.
- 2026-11-24 T247–T248 done, PR #201: Bank Shot bank 30 (owner's choice over the sim's ~8), a 3-unit free zone shown as a labelled band, glimpses down to 1 000 ms.
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
