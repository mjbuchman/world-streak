# Needs the human

Everything the agents cannot do on their own. Agents add items here and keep working on anything else. When you resolve an item, move it to "Resolved" with a one-line note (or just tell the agent and it will update this file).

## Open

<!-- Format:
### <short title> (blocks T09, T12)
- What is needed: exact values, settings, or decision
- Where to put it: e.g. .env.local key GOOGLE_CLIENT_ID, or reply in chat
- Why: one line
- Agent's recommendation: ...
-->

### Please confirm: Daily Three planning calls (M5; blocks nothing)
- What is needed: say if any of these readings of DESIGN.md should change. (1) Second Sense keeps its tap, not a hold. (2) The fraction of lives or budget left is measured when the run ends. (3) A wrong Flash Ladder count retries the same level with a new layout. (4) Fair Split has concave shapes but no holes, and each side of a cut is measured by total area. (5) The pass rate counts only decided days, unlike T17, which counts started attempts. (6) The game played after the day is decided is left out of the pass-target percentile. (7) The results page shows the verdict, each game's score and target, the meter and share; it has no percentiles. (8) The lineup comes from a hash of the date and never repeats the previous day's. (9) Echo Path has no per-tap time limit. (10) A Fair Split miss or timeout brings the same shape back, and a drag that is too short or misses the board is ignored (placeholders in DECISIONS.md, 2026-11-16). (11) A day nobody has touched rebuilds its lineup from the current pool, as coming days followed the settings before (DECISIONS.md, T150). (12) A player who loses game 1 and never returns is not counted in the pass rate (DECISIONS.md, T153; confirmed by the owner 2026-11-16). (13) Before anyone starts a day whose lineup the nightly job has not made yet, /play shows only game 1, with no list (DECISIONS.md, T156). (14) Three wins make a "Perfect day" on the results page and the share text, and nothing else (DECISIONS.md, T159). (15) The placeholder cheat-check thresholds for Second Sense, Echo Path and Fair Split (DECISIONS.md, T164).
- Where to put it: reply in chat.
- Why: the design leaves these open or unclear. The tasks are T139–T166 in the backlog.
- Agent's recommendation: build as listed. Check them at the M5 play-test.

### Please confirm: M6 gameplay calls (blocks nothing)
- What is needed: say if any of these should change (M7 replaced the Second Sense targets and bank, Swift Sum's counts, Echo Path's board and lengths, and Fair Split's bank; see the M7 entry above). Pass targets live in `game_settings.default_pass_targets` (editable in /admin); cheat thresholds in `src/config/cheat.ts`; everything else is a constant in the file named. (1) Second Sense (`src/challenges/inner-clock/timeBank.ts`): four rounds, a 10 s bank, targets 15-17.4 s rising 2.5 s a round, the clock shown 2 s, no tap ends a round at target + 10 s; target 4 "survive all four"; the cheat check flags 3+ rounds under 25 ms off. (2) Swift Sum (`src/challenges/flash-count/flashLadder.ts`): five rounds, a 10-dot bank, 6-11 dots rising by 3 a round (up to 18-23), a flash from 1800 to 1400 ms; target 5 "survive all five". (3) Echo Path (`src/challenges/echo-path/path.ts`, `engine.ts`): a 5 x 10 board, paths of 12 to 18 tiles that never revisit a tile, start at 4 tiles, 3 lives kept, 300-400 ms a tile; target 10 "a path of 10 tiles". (4) Fair Split (`src/challenges/fair-split/shapes.ts`, `engine.ts`, `render.ts`): five shapes, 75% curved, a 6-point bank, 25 s a shape (cut where the line is at the limit), the line starting straight down the middle, no live percentage; target 5 "survive all five"; cheat checks at 3 cuts within 0.05 of half or a surviving cut under 1.5 s. (5) All games: a cost equal to what is left of the bank survives; scores from before the rework are left out of the pass targets (`challenge_types.scores_since`); each attempt's own seed is the per-player variation. Details in DECISIONS.md (2026-11-18 entries).
- Where to put it: reply in chat.
- Why: the design leaves these open.
- Agent's recommendation: keep them; at the M6 play-test, check Echo Path's run length (9 to 15 rounds, about 2 to 3 minutes), Second Sense's (about 95 s), and whether each bank feels fair.

### Please confirm: M7 tuning calls (blocks nothing)
- What is needed: say if any of these should change (you set the banks, the 5 x 8 board, the touch rule and the 10-30 dot draw yourself). (1) Second Sense targets rise by round: 10-12.4, 12.5-14.9, 15-17.4, 17.5-19.9 s (`TARGET_RANGES_MS` in `src/challenges/inner-clock/timeBank.ts`). (2) Swift Sum keeps its 10-dot bank: about 41% of simulated players survive all five rounds (`flashLadder.ts`). (3) Trail Trace paths run 8 to 12 tiles, and the target is now 8, "a path of 8 tiles" (`path.ts`; /admin). (4) Clean Cut shapes must measure at least 0.04 lopsided (`MIN_ASYMMETRY` in `shapes.ts`). With the 8-point bank, about 99% of simulated careful cutters survive all five, so the target of 5 may be easy. (5) No cheat threshold changed. Details in DECISIONS.md, "M7 play-test tweaks".
- Where to put it: reply in chat.
- Why: these are agent proposals the backlog marked "owner to confirm".
- Agent's recommendation: keep them, and check at the play-test whether the 2 s bank is survivable, the 10-dot bank too tight for 30 dots, 8 rows too short, and the Clean Cut shapes clearly lopsided.

### Please update DESIGN.md for the M6 and M7 games (blocks nothing)
- What is needed: update the games table and its scoring text in `docs/DESIGN.md` (agents never edit it). Second Sense: four rounds against a 2 s bank, 10 to 20 s targets, a 2 s clock and a 3-2-1 every round (was a 3.0 s budget, run until it is gone, the clock fading sooner). Swift Sum: five rounds against a 10-dot bank, a random 10 to 30 dots each round, no lives or tolerance (was 3 lives, a life per wrong count, more dots each level). Trail Trace (was Echo Path): one path per player on a 5 x 8 board, at most 12 tiles, never sharing an edge with itself except tile to next tile, a tile longer each round, a mistake replays the same length (was a new sequence after a mistake). Clean Cut (was Fair Split): five lopsided shapes against an 8-point bank, a movable line with a Cut button, 25 s a shape (was within 1 point or lose one of 3 lives).
- Where to put it: `docs/DESIGN.md`, or tell the agent which wording to use.
- Why: the doc still describes the pre-M6 rules (DECISIONS.md, "Where M6 departs from DESIGN.md" and "Where M7 departs from DESIGN.md").
- Agent's recommendation: copy the M6 rules above into the games table.

### Asymmetric JWT keys at deployment (T58; blocks nothing)
- What is needed: locally, sign in again; if `npm run dev` then reports a bad key, replace the three lines in `.env.local` with what `npm run env:local` prints (local Supabase now signs its keys with the new ES256 key). At deployment, switch the project to an ECC (P-256) signing key (`docs/DEPLOYMENT.md` §4.4).
- Where to put it: the Supabase dashboard.
- Why: pages verify sessions locally instead of asking the Auth server each time. See DECISIONS (T58).
- Agent's recommendation: do it with the rest of `docs/DEPLOYMENT.md` §4.

### Create the Supabase cloud project (T50; blocks deployment)
- What is needed: a free-plan Supabase project with the migrations applied, pg_cron jobs checked and auth set up.
- Where to put it: follow `docs/DEPLOYMENT.md` sections 1–4; the keys go into Vercel (section 5), never the repository.
- Why: the agents never create accounts or touch production.
- Agent's recommendation: do it when you are ready to put a preview online; nothing local depends on it.

### Create the Vercel project (T50; blocks deployment)
- What is needed: a Vercel project linked to the repository with every variable in the table of `docs/DEPLOYMENT.md` section 5.
- Where to put it: Vercel → Settings → Environment Variables; then check `/api/health` on the deployment.
- Why: hosting is a human step.
- Agent's recommendation: start on Hobby; move to Pro before ads (section 8).

### Make the production owner account an admin (T50; blocks using /admin in production)
- What is needed: sign up on the deployed site, then run the SQL in `docs/DEPLOYMENT.md` section 6 with your email.
- Where to put it: Supabase SQL editor.
- Why: the local admin from `supabase/seed.sql` must never exist in production.
- Agent's recommendation: do it right after the first deploy.

### Add the ad settings to .env.example (T44; blocks nothing)
- What is needed: add these lines to `.env.example` (my permission settings deny me that file):
  `# Ads (T44). Off unless both are set; real values come with T45 and Vercel Pro.`
  `NEXT_PUBLIC_ADS_ENABLED=false`
  `NEXT_PUBLIC_ADSENSE_CLIENT=`
  `# Development only: grey boxes where the ads will go (never shown in production).`
  `NEXT_PUBLIC_ADS_PLACEHOLDER=false`
- Where to put it: `.env.example` (and `.env.local` set `NEXT_PUBLIC_ADS_PLACEHOLDER=true` if you want to see the slots locally).
- Why: the task asks for the names in `.env.example`; ads are off by default either way.
- Agent's recommendation: add them now.

### Add NEXT_PUBLIC_SITE_URL to .env.example (T32; blocks nothing)
- What is needed: add these two lines to `.env.example` (my permission settings deny me that file):
  `# The site's public address, used in shared result cards (T32). Production: the real domain.`
  `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
- Where to put it: `.env.example` (and later the Vercel project settings, with the real domain).
- Why: the share card links to the site. Until it is set, the card uses the page's own address, which is right locally.
- Agent's recommendation: add it now; set the real value at deployment (T50). Next.js builds `NEXT_PUBLIC_` values into the page, so set it before the production build.

### Legal review of the draft official rules (blocks nothing; before public launch)
- What is needed: have the text at `/rules` (T38) reviewed by someone qualified for US sweepstakes and contest rules before launch. There is no sponsor yet (T39 dropped Nov 12), so the sponsor's name, address and contact email stay placeholders and the page shows a "Draft" banner.
- Where to put it: reply in chat with changes; the wording lives in `src/lib/rules.ts`, the numbers in `src/config/`.
- Why: a prize game needs official rules that hold up; the agents drafted them from the design doc.
- Agent's recommendation: review once T39's sponsor details are in, so the reviewer sees the final page. Ask them in particular about the draw happening only after a cycle that reached the goal (otherwise the prize rolls over, and nobody wins that cycle).

### Accessibility pass (blocks nothing; before launch)
- What is needed: one session testing the app with a screen reader and keyboard only (and reduced motion on), all at once, once the main screens exist.
- Where to put it: reply in chat with anything that is hard to use.
- Why: you asked to batch accessibility testing for later (Nov 10, 2026); agents keep building it in meanwhile. Known question to check then: whether the live "Row N" counter is too chatty during fast play (T77 review).
- Agent's recommendation: do it after M2 or M3, when the meter and history exist too.

### Tower speed with more players (blocks nothing; before launch)
- What is needed: a few other people to play the Tower, to fine-tune its speed so a decent player reaches about row 10.
- Where to put it: reply in chat with how far people got.
- Why: you found it challenging but winnable as an above-average player (Nov 10, 2026) and kept the speed for now.
- Agent's recommendation: do it with a deployed preview, so testers need no setup.

### Revisit: location is self-declared, no IP check (blocks nothing; before launch)
- What is needed: after you research contest rules, say whether self-declared US residence is enough or a check is needed.
- Where to put it: reply in chat.
- Why: you said to leave it for now (Nov 9, 2026). Details in `docs/DECISIONS.md` (T03).
- Agent's recommendation: keep it self-declared; verify the winner's address before payout.

### Cloudflare Turnstile keys for sign-up protection (blocks the final wiring of T52; not needed until launch)
- What is needed: a free Cloudflare account and a Turnstile widget for the production domain (add `localhost` too for testing). Then the site key and secret key.
- Where to put it: `.env.local` and the Vercel project settings, as `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- Why: sign-up uses the admin API, so Supabase's built-in sign-up rate limit does not apply. A free CAPTCHA plus a per-IP limit stops bulk account creation in a prize game.
- Agent's recommendation: do it before the public launch. T52 works without the keys locally (it skips the CAPTCHA and logs a warning).

## Resolved

- **T180–T183 blocked** (Nov 18, 2026): PR #171 failed CI 3 times on a phone ghost click; the owner unblocked it with 3 more attempts.
- **M4 play-test** (Nov 12, 2026): Second Sense fade and targets good; Swift Sum countdown perfect, so every game gets it (T138). No sponsor yet: T39 dropped. `record_attempt_result_unchecked` stays (checked: only the service role can run it, pgTAP-tested). Turnstile's free plan has no usage charge.

- **Decisions after M4** (Nov 12, 2026): all eight please-confirms accepted as built (T44 ads off, T43 draw, T40 cheat thresholds, T34 streak and cycle, T110 hidden tab, T32 share margin, T31 rotation, T104 gauge); T37 goes ahead with option A; the meter's local p95 is accepted, to be rechecked on the preview; Second Sense keeps the 0.5 s pass target.

- **M3 follow-ups tried** (Nov 12, 2026): admin local tools, Swift Sum balance and the share emojis are good. New: Second Sense clock fades, targets 7–13 s (T118); Swift Sum 3-2-1 countdown (T119); both built during M4 and checked at its play-test. Go straight into M4.

- **M3 play-test** (Nov 12, 2026): Second Sense gets a visible timer that hides quickly, with higher targets (T113); Swift Sum gets fewer dots and more time (T114); share is just a button with an emoji text (T115); the admin page gets controls for the command-line tools (T116, T117).

- **CI could not install the Playwright browser** (Nov 11, 2026): the e2e job's apt step failed 4 times (runner could not resolve `azure.archive.ubuntu.com`), and a fifth re-run failed with no jobs. The human approved dropping `--with-deps` from `.github/workflows/ci.yml` (T102 branch).

- **M2 play-test** (Nov 11, 2026): no issues beyond the look of the meter and streak card (T104). Empty days break the streak (as built). Coming days follow the settings until edited or started, and the pass target locks once a day has started (T102). Do not hide the meter for now (T103). The refused/not-sent wording is approved. Redesign: A's gauge meter and play card, with a streak card made of A's header and C's bar chart (T104, T105).

- **Launch values in game_settings** (Nov 10, 2026): approved as built in T16 (60% threshold, 80th percentile, step 0, full weight from day one, 14 days / 50 scores, Tower target row 10).
- **Wording for an unfinished attempt on /play** (Nov 10, 2026): approved as proposed; T91 may proceed.
- **Docker Desktop and `.env.example`** (Nov 10, 2026): the human restarted Docker (local Supabase is back) and restored `.env.example` after the shutdown.

- **Google OAuth client** (Nov 10, 2026): set up locally; a real Google login reached profile completion and home (T15 done). The setup is in the README. Production needs a second redirect URI for the hosted Supabase project at deployment time (T50).

- **Second play-test after M1b** (Nov 10, 2026): done. Speed kept for now (more testers later); remove the idle drop (T87); sign-up and sign-in as built; the header hides during runs; result wording in rows (T85); results laid out like practice (T79); accessibility tested later in one batch. M2 may start after these follow-ups.

- **M1 play-test** (Nov 9, 2026): done. Feedback became milestone M1b in the backlog (Fresh Sport redesign, grid Teetering Tower, sign-up fixes).
- **Brand colour and typefaces** (Nov 9): replaced by the Fresh Sport direction (deep teal, mint, tangerine; Unbounded and Manrope). UI guidelines v2 approved.
- **`.env.local` for play-testing** (Nov 9): created by the human.
- **Stacking tuning, score and name** (Nov 9): the game was too easy; it becomes an arcade-style column-grid stacker (T76). The whole block count stays the score. Names: Teetering Tower, Second Sense, Swift Sum.
- **Placeholder pass target of 10** (Nov 9): keep for now; re-tuned with the new Tower (a decent player should reach row 10).
- **Leaving an attempt early** (Nov 9): it is a loss. No retry, and it counts as a failed attempt in the pass rate (T17).
- **Grace period after the deadline** (Nov 9): none; a late finish does not count.
