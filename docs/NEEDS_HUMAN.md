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

### Please confirm: coming days follow the settings until edited or started (blocks nothing)
- What is needed: a yes, or "keep a day's values fixed once created".
- Where to put it: reply in chat.
- Why: opening `/admin` creates the next 7 days early. As built (T99), a day you have not edited and nobody has started keeps following the settings, the streak and recent scores, and is refreshed at the close before it. Saving a day on `/admin`, or the first player starting it, freezes its values. Details in `docs/DECISIONS.md` (T25, with the T99 update).
- Agent's recommendation: keep it as built.
- Also: as built, you can still change today's pass target after players have started, and later results are then judged by the new target. Should the pass target lock once anyone has started the day? (The threshold stays editable either way, as the backlog asks.) Recommendation: lock it. It is a small follow-up task.

### Please confirm: a day nobody played breaks the streak (blocks nothing)
- What is needed: a yes, or "it survives" / "it is skipped".
- Where to put it: reply in chat.
- Why: with no attempts there is no pass rate. As built (T21), such a day closes as broken and resets the streak to 0. Details in `docs/DECISIONS.md` (T21).
- Agent's recommendation: keep it broken; once the game has players, an empty day is unlikely.

### Please confirm: wording when a result is refused or not sent (blocks nothing)
- What is needed: a yes, or new text. On `/play`, a result the server refused (the day closed first, or the timing could not be checked) now shows the heading "Counted as not passed" with "...so it counted as not passed."; a result that never reached the server shows "Result not sent" with "Your result could not be sent. Reload the page to see whether it counted."
- Where to put it: reply in chat.
- Why: from T17 a started attempt counts, so the old "Not counted" was wrong. Details in `docs/DECISIONS.md` (T17).
- Agent's recommendation: keep the text above.

### Please confirm: hide the meter for the final 3 hours (blocks nothing)
- What is needed: a yes, or a different number of hours. From 9 pm UTC (3 hours before the midnight UTC deadline), the meter stops showing the pass rate and attempt count; it shows only the threshold and a countdown until the result is revealed.
- Where to put it: reply in chat. It is one constant, `METER_HIDE_HOURS` in `src/config/meter.ts`.
- Why: the design leaves "last-minute sniping" Open and recommends hiding the meter for the final hours, so a group cannot time a late wave of attempts to tip the day.
- Agent's recommendation: keep 3 hours.

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
