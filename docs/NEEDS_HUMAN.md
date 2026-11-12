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
