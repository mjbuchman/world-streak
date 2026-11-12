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

### Meter load test: p95 above the local target (T48; blocks nothing)
- What is needed: decide whether the local p95 matters. On this machine, 200 connections for 30 s gave p95 403 ms (target under 200 ms), about 1,500 requests/s and no errors; the database is read once per 30 s, so the time is the single Node server. In production the CDN serves most requests.
- Where to put it: reply in chat; or rerun `npm run load:meter` on a faster machine (README, "Meter load test").
- Why: the task records the target; it was not met here.
- Agent's recommendation: accept it for launch (the CDN carries the load), and recheck on the deployed preview with the CDN in front.

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

### At the M4 play-test: Second Sense fade and pass target, Swift Sum countdown (T118, T119; blocks nothing)
- What is needed: try the clock's fade and the 7–13 s targets (T118) and the 3-2-1 countdown (T119). Also say whether the placeholder pass target "within 0.5 s" is too hard with longer targets (0.8 s is an option).
- Where to put it: reply in chat at the M4 play-test.
- Why: you asked for these after trying the M3 follow-ups (Nov 12); they are built during M4.
- Agent's recommendation: judge the 0.5 s after a few scored-style tries in practice.

### Please confirm: ads off until you switch them on (T44; blocks nothing)
- What is needed: OK that ads stay off by default (the soft launch on Vercel Hobby must be non-commercial) and come on with two environment values at the public launch on Vercel Pro (T45).
- Where to put it: reply in chat.
- Why: the design says both "AdSense from launch" and "no ads on Hobby". See docs/DECISIONS.md (T44).
- Agent's recommendation: keep them off until Pro.

### Please confirm: what the prize draw counts (T43; blocks nothing)
- What is needed: OK, or changes: one ticket per passed day in the cycle, including days after the goal was reached; the draw opens after the cycle's last day; flagged accounts are left out until an admin dismisses their flags.
- Where to put it: reply in chat.
- Why: the backlog asked for this judgment call to be recorded. See docs/DECISIONS.md (T43).
- Agent's recommendation: keep it; it matches what the rules page says.

### Please confirm: cheat check thresholds (T40; blocks nothing)
- What is needed: OK, or other numbers, for the placeholders in `src/config/cheat.ts`. The one change from the backlog: the Tower's "perfect run" is 12 rows without losing a cell (the 15-row Tower can never reach the backlog's 20).
- Where to put it: reply in chat.
- Why: thresholds with no data behind them yet. See docs/DECISIONS.md (T40).
- Agent's recommendation: keep them until real play data exists; a flag only puts entries on hold for review.

### Legal review of the draft official rules (blocks nothing; before public launch)
- What is needed: have the text at `/rules` (T38) reviewed by someone qualified for US sweepstakes and contest rules before launch. The sponsor's name, address and contact email are still placeholders (T39), so the page shows a "Draft" banner.
- Where to put it: reply in chat with changes; the wording lives in `src/lib/rules.ts`, the numbers in `src/config/`.
- Why: a prize game needs official rules that hold up; the agents drafted them from the design doc.
- Agent's recommendation: review once T39's sponsor details are in, so the reviewer sees the final page. Ask them in particular about the draw happening only after a cycle that reached the goal (otherwise the prize rolls over, and nobody wins that cycle).

### T37 blocked: how the local simulation may close days that have not ended (blocks T37)
- What is needed: pick one way for `npm run simulate:days -- --from 2027-01-01 --days 30` to close days in 2027, which `close_game_day` refuses today in two ways: a day before its deadline, and any day while an earlier day (today, and the rest of 2026) is still open.
  - A (recommended): split `close_game_day` into the deadline check plus `close_game_day_unchecked(d)`, service-role only (the service role can already change every table, so no new power). The script refuses any non-local URL and first closes every open day before `--from` with no attempts (broken). Your local "today" is then closed too, so play-testing needs `npm run db:reset` afterwards (the README will say so).
  - B: no database change. The simulation moves cycle 1 into the past on the local database (for example 2000-01-01), simulates there, and prints the goal date in that window. The real 2027 dates are not exercised.
  - C: drop T37; the pgTAP tests (T34) already cover a full cycle.
- Where to put it: reply in chat with A, B or C.
- Why: A touches the close path that guards the streak in production, so I did not choose it on my own.
- Agent's recommendation: A. It exercises the real close job on the real 2027 dates.

### Please confirm: the streak and the prize cycle (T34; blocks nothing)
- What is needed: OK, or changes: the streak resets to 0 on each cycle's first day (Jan 1, 2027 included); after a 30-day streak the cycle still runs to day 60 and passes keep earning entries; preseason days show in the streak but earn no entries.
- Where to put it: reply in chat.
- Why: the backlog asked for these judgment calls to be flagged. See docs/DECISIONS.md (T34).
- Agent's recommendation: keep all three.

### Please confirm: a hidden tab in Second Sense and Swift Sum (T110; blocks nothing)
- What is needed: OK, or pause instead: Second Sense's clock keeps running if the player switches tabs; Swift Sum shows the dots again in full when they come back.
- Where to put it: reply in chat.
- Why: the task asked for a decision. See docs/DECISIONS.md (T110).
- Agent's recommendation: keep it running; pausing would let a player stop the clock.

### Please confirm: the share card's "near the line" margin (blocks nothing)
- What is needed: OK or another number for when a share becomes a call for help: below the threshold plus 5 points (60% needed: under 65%). `NEAR_THRESHOLD_MARGIN` in `src/config/share.ts`.
- Where to put it: reply in chat.
- Why: the design gives no number. See docs/DECISIONS.md (T32).
- Agent's recommendation: 5 points.

### Please confirm: the daily rotation (blocks nothing)
- What is needed: OK, or a different order, for the rotation: Teetering Tower, Second Sense, Swift Sum, one each day in turn (T31). Locally, today (Nov 12) is now a Second Sense day.
- Where to put it: reply in chat.
- Why: the design leaves later challenges Open; this is the MVP's three. See docs/DECISIONS.md (T31).
- Agent's recommendation: keep the plain cycle.

### Please confirm: gauge details (blocks nothing)
- What is needed: OK or changes to three small calls in T104: the home page no longer shows the big title and pitch line (the chosen artboard has neither); the mint glow is a little softer than the mockup (contrast); a day that rounds to the line while below it says "Just below the line".
- Where to put it: reply in chat.
- Why: details the mockup did not settle. See docs/DECISIONS.md (T104).
- Agent's recommendation: keep all three; if new players need the pitch, put one short line under the meter.

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
