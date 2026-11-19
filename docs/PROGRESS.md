# Progress

Agents update this file after every task, newest entries first. A fresh session reads it to know where things stand.

## Current status

- Milestone: M8 M7 play-test tweaks (T217–T227), approved Nov 19 (PR #186). T45, T52 and T128 still wait on the owner.
- Active task: T215–T216 (test upkeep). Next: the maintainer check, then the M8 play-test.
- Blocked tasks: none
- Waiting on the human: the M6, M7 and M8 please-confirms; updating DESIGN.md for M6 to M8; T45 AdSense; T52 Turnstile keys; deployment (docs/DEPLOYMENT.md, then T128); `.env.example` lines. See docs/NEEDS_HUMAN.md.
- Next: run M8-a to M8-d without play-test stops, then one M8 play-test summary.

## Log

Older entries (everything up to Nov 19, 2026) are in `docs/archive/PROGRESS-to-2026-11-19.md`. Search it only when you need history.

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
