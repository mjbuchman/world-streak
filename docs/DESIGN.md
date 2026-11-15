# World Streak: Game Design Doc

Nov 5, 2026 · @Michael

World Streak is a free daily browser game where the whole world shares one streak. Each day every player gets one attempt at a short skill challenge; if enough of the world passes, humanity's streak survives another day, and if not, it resets to zero for everyone. Reaching a 30-day streak within a 60-day cycle awards a cash prize to one player. The working title "World Streak" is a placeholder.

**How to use this doc:** decisions marked *Decided* are settled; items marked *Open* still need a call. An AI agent helping with development should treat Decided items as requirements and ask before resolving Open ones.

## Design principles

The game must be explainable in one sentence: *play today's three games; win two to pass; if enough of the world passes, humanity's streak survives.*

1. **Simplicity over depth.** Each game is won or lost, and the day is passed or failed. No extra choices, currencies or roles. Depth comes from fun, well-tuned games.
2. **One shared fate.** Every player's result feeds a single world streak.
3. **Chaos is allowed, never rewarded.** Players can deliberately fail. The game never labels players or rewards sabotage, and a deliberate failure looks identical to an honest one.
4. **Honest players have the upper hand.** The survival threshold sits well below the normal pass rate, so breaking the streak takes a large share of players failing.
5. **Skill, not knowledge.** Challenges test performance, not answers, and each player's instance is randomized so nothing can be shared.

## Core daily loop

Each game day, every player gets one scored run of three games; the streak survives if the day's pass rate meets the survival threshold.

1. **Play.** The player plays today's three games once each, in the order the day sets. Practice is available for every game but never counts.
2. **Win two of three.** Each game is won if its score meets that game's pass target for the day. Winning two of the three passes the day. Once the day is decided (two wins or two losses), the result is locked; the remaining game is still offered.
3. **Watch.** A live meter shows the world's pass rate against the survival threshold, so players can check in through the day.
4. **Deadline.** At a single global deadline the day closes: *survived* (streak +1) or *broken* (streak resets to 0 for everyone).
5. **Share.** The result card shows the player's own outcome and the world's status without spoilers, and becomes a call for help when the world is close to the line.

**Definitions (Decided unless marked)**

| Term | Definition |
| --- | --- |
| Pass rate | Passed days ÷ completed days for the game day, among counted accounts |
| Survival threshold | Minimum pass rate for the streak to survive; set well below the normal pass rate (example: 60% when about 80% normally pass) |
| Completed day | A player's day once its result is decided (two wins or two losses). Leaving a game early is a loss for that game |
| Lineup | The three games for the game day; the same for everyone |
| World streak | Consecutive game days survived in the current run |
| Game day | Closes at one global deadline for everyone (*Open:* exact time, suggested midnight UTC) |

**Last-minute sniping (Open, recommendation below)**

If deliberate failures cluster right before the deadline, honest players cannot respond. Recommended fix: hide the live meter for the final few hours, then reveal the result at the deadline. Alternatives: show the meter on a delay, or use rolling per-time-zone days.

## Daily challenges

Each day is a lineup of three games drawn from a pool; the pool starts with five.

**Rules for every game (Decided)**

- One scored run per player per game, about 45–90 seconds, built as an escalating run that ends when the player fails (or the climb ends).
- Same lineup, game rules and difficulty for everyone that day, but each player's instance is randomized from a per-player seed, so no answer or pattern can be shared.
- Scored on a continuous scale (rounds cleared, with what is left of the error budget or lives as the fraction) so pass targets can be set precisely.
- Each game has its own pass target, set from real score data as a percentile (for example, the score 80% of recent players reached), and rising as the streak grows.
- Works well on mobile and is fun to watch in short video clips.

**Lineup rule (Decided)**

- The daily seed picks three different games from the pool and their order.
- Never repeat the previous day's exact lineup. The admin can override a future day's lineup.
- While the pool has only five games, every lineup is allowed; skill-category balancing comes when the pool grows.

**The pool (Decided)**

| Game | How it plays | Win condition / score | Difficulty levers |
| --- | --- | --- | --- |
| Teetering Tower | Unchanged: a column-grid stacker; tap to drop each row | Reach the target row; score = rows | Speed, ramp |
| Second Sense: Time Bank | Rounds of the current hold-for-the-target game. Each round's error is subtracted from an error budget (placeholder 3.0 s); the run ends when the budget runs out | Survive N rounds; score = rounds survived + budget left as a fraction | Target length rises, clock fades sooner. No other round types |
| Swift Sum: Flash Ladder | Rounds of the current count-the-dots game, each harder; a wrong count (outside tolerance) costs one of 3 lives | Clear N rounds; score = rounds cleared + lives left as a fraction | More dots, shorter flash. No colour or other variants |
| Echo Path | Tiles on a grid light up in a sequence; repeat it. Each cleared round adds one step; a mistake costs one of 3 lives and gives a new sequence of the same length | Reach length N; score = longest sequence cleared + lives left as a fraction | Grid size, sequence speed |
| Fair Split | An odd shape appears; drag one straight cut across it to split it as close to 50/50 as possible. A cut counts if both pieces are within ±1 percentage point of 50% (49/51 or better); a cut outside that costs one of 3 lives. Each cut has a time limit | Survive N shapes; score = shapes cut + lives left as a fraction | Shape oddness (concave, holes later), time limit |

Placeholder values (budgets, lives, tolerances, time limits, N) live in config and are tuned at play-tests.

**Later candidates (Open)**

Light Trail, Odd One Out, Sort Rush, Orbit Shot, Fill Line, True Angle, Color Recall and Steady Hand tracing. Add skill-category balancing to the lineup rule once the pool is big enough.

**Watch-outs**

- Stacking scores compound early mistakes; check the pass target does not fail good players at random.
- Device and screen lag affect timing games; the lineup mixes them with memory and estimation.
- Some lineups will be harder than others; per-game adaptive targets keep the day's pass rate steady.

## Streak cycle and prize

If the world holds a 30-day streak at any point in a 60-day cycle, one player wins the prize; if not, the prize rolls over.

**Cycle rules (Decided)**

- A cycle lasts 60 days. The first cycle starts January 1, 2027.
- Goal: reach a 30-day world streak at any point within the cycle. A collapse resets the streak, and the world can try again while time remains.
- Tune difficulty so the world has slightly better than even odds of reaching the goal in the first cycle.

**Prize (Decided)**

- Prize = $200
- The current prize is shown live on the site.
- One winner is drawn at random from all entries. Each day a player passes earns one entry.
- If no 30-day streak happens in the cycle, the prize rolls into the next cycle.
- Paid within 45 days of the cycle ending.

**Official rules (required)**

The site needs an official rules page: free entry with no purchase or payment of any kind; the prize formula, floor and cap stated; age and location eligibility enforced at sign-up.

## Integrity

Individual saboteurs are part of the game; fake accounts and scripts are not, so protection happens quietly in the background.

- **Accounts:** sign in with Google or email and password (Apple deferred). Email addresses are not verified in the MVP, so the prize winner must verify their email before payout; one account per person. A scored attempt requires an account (practice does not).
- **Server-side results:** the server issues each attempt's seed and validates the submitted result; the client never decides pass or fail on its own.
- **Cheat checks:** flag statistically implausible scores and input patterns typical of scripts. Cheating to pass only helps the streak survive, so the main purpose is protecting prize entries; flagged accounts lose entries.
- **Rate limits:** one scored attempt per account per game day, enforced on the server.

## Ads

- Google AdSense from launch.

## Technical guidance

A mobile-first Next.js app in TypeScript, with Supabase for the database and auth; the server computes every official score.

**Tech stack (Decided)**

| Layer | Choice |
| --- | --- |
| Language | TypeScript everywhere (client, server and shared game code) |
| App framework | Next.js (App Router); challenges are client components, API endpoints are route handlers |
| Rendering | Plain HTML canvas (2D); no game engine, to keep bundles small and loads fast on phones |
| Database | Supabase Postgres |
| Auth | Supabase Auth with Google sign-in, plus email and password with email confirmation turned off for the MVP (Supabase's built-in email service sends only 2 emails per hour). Add a custom email provider, which needs an owned domain, at public launch. Sign in with Apple is deferred: it requires a paid Apple Developer Program membership |
| Scheduled jobs | Supabase scheduled jobs (pg\_cron) |
| Hosting | Vercel |
| Testing | Vitest for unit tests, Playwright for end-to-end tests |

**Challenge engine (Decided)**

- Each challenge is a self-contained, deterministic TypeScript module: `(seed, inputs) → score`.
- The browser runs the module to render and play the challenge; the server re-runs the same module on the submitted inputs (for example tap timestamps or the entered count) to compute the official score. The client never reports its own score.
- Simulation is driven by elapsed time, never by frame count, so results are identical across 60Hz and 120Hz screens.
- Every challenge module has unit tests covering known seeds, inputs and expected scores.
- A run's inputs cover all its rounds, and the server replays the whole run.
- One scored attempt per account per game per game day, enforced by a unique constraint. The day's result is derived from the player's attempts.

**Live meter (Decided)**

- Keep running counters of attempts and passes per game day, updated with each attempt, rather than counting rows on request.
- Serve the meter from one cached endpoint refreshed every 30–60 seconds. Clients poll about once a minute, and only while the tab is visible. No per-viewer live connections, so traffic spikes stay cheap.

**Daily close job (Decided)**

- Runs at the deadline as a database scheduled job: computes the final pass rate, updates the world streak, records the day's result and prepares the next day's challenge.
- Keyed by the UTC game date and idempotent, so running it twice is harmless.

**Hosting costs**

- **Development and soft launch:** Vercel's free Hobby plan, with no ads and the free `*.vercel.app` address. Hobby is non-commercial only, and exceeding a Hobby limit can disable that feature for 30 days, so keep meter polling light and upgrade immediately if traffic spikes.
- **Public launch:** Vercel Pro (about $20/month) from the day ads go live. Pro allows commercial use, includes 1TB of bandwidth and $20 of usage credits, and bills overages instead of shutting features off. Set a spending limit in Vercel's billing settings.
- **Domain:** buy a custom domain at public launch; it is also required for the custom email provider.
- **Supabase:** the free plan is enough for the MVP; upgrade to Pro (about $25/month) only if traffic requires it.

**Core data model (suggested)**

| Entity | Key fields |
| --- | --- |
| User | id, auth provider, created date, weight, flagged |
| GameDay | date, lineup (three games in order), pass target per game, survival threshold, final pass rate, outcome |
| Attempt | user, game day, game, seed, raw input or summary, score, passed, timestamps |
| WorldStreak | cycle, current length, best length, start date, end date |
| Cycle | number, start, end, prize floor, revenue share, cap, rollover in, winner, paid date |
| Entry | user, cycle, game day (one per passed day) |

**Attempt flow**

1. Client requests today's attempt; server checks eligibility and returns a per-player seed.
2. Client runs the challenge from the seed and submits inputs or a timing summary.
3. Server replays the challenge module on the seed and submitted inputs to compute the official score, records pass or fail, and adds an entry if passed.

**MVP scope (for the soft launch)**

- Sign-in, the five-game pool, the daily three with win-two-of-three, practice for every game.
- Live pass-rate meter, daily close job, world streak display and history list.
- Spoiler-free share card that becomes a call for help when the world is near the threshold.
- Ad slots outside the challenge, and a draft official rules page.
- Admin controls to set pass targets and the survival threshold manually.

## Open questions

- [ ] Final game name
- [ ] Exact global deadline time (suggested midnight UTC)
- [ ] How to handle last-minute sniping (recommended: hide the meter for the final hours)
- [ ] Survival threshold and pass-target percentile for launch
- [ ] How pass targets and threshold rise as the streak grows
- [ ] How much new accounts count, and after how many days they count fully
- [ ] Which games join the pool after the first five
- [ ] Incentive to play the remaining game once the day is decided (for example a "perfect day" on the result and share card)
- [ ] Results page after the run (percentile, score distribution, history); planned separately
