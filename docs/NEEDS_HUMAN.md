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

### Google OAuth client for sign-in (blocks T15, the last M1 task)
- What is needed: in Google Cloud Console (free), create an OAuth client of type "Web application" with the authorised redirect URI `http://127.0.0.1:54321/auth/v1/callback`. You get a client ID and a client secret.
- Where to put it: set them in the shell that starts local Supabase, then restart it. In PowerShell: `$env:SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID = "<client id>"`, `$env:SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET = "<secret>"`, then `npx supabase stop` and `npm run db:start`. (The Supabase CLI reads these from the shell; putting them in `.env.local` does not work.) Then sign in once with "Continue with Google" on `/signin` and tell the agent whether it reached `/complete-profile`.
- Why: Google sign-in is built and tested up to Google's door (T07), but a real login needs your own OAuth client; agents cannot create accounts.
- What was tried: everything else for Google sign-in, including an e2e test that checks the hand-off to Google with the configured client ID.
- Agent's recommendation: do it when convenient; nothing else in M1 or M2 depends on it. Production needs a second redirect URI for the hosted Supabase project at deployment time.

### Second play-test after M1b (blocks M2)
- What is needed: when the agent reports M1b done, play-test again (the Fresh Sport look, the new grid Teetering Tower, the sign-up fixes) and say whether M2 can start.
- Where to put it: reply in chat.
- Why: the M1 play-test asked for a big rework of the look and the Tower; M2 builds the streak and meter on top of it.
- Agent's recommendation: same steps as the M1 play-test; the agent will list them.
- Also judge at that play-test: the new Tower's speed (a decent player should reach about row 10) and two judgment calls: a row left untapped for 8 seconds drops off and ends the run (DECISIONS, T76); sign-up now keeps your passwords after an error, but sign-in still clears the password after a wrong one, as most sites do (DECISIONS, T75).

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

- **M1 play-test** (Nov 9, 2026): done. Feedback became milestone M1b in the backlog (Fresh Sport redesign, grid Teetering Tower, sign-up fixes).
- **Brand colour and typefaces** (Nov 9): replaced by the Fresh Sport direction (deep teal, mint, tangerine; Unbounded and Manrope). UI guidelines v2 approved.
- **`.env.local` for play-testing** (Nov 9): created by the human.
- **Stacking tuning, score and name** (Nov 9): the game was too easy; it becomes an arcade-style column-grid stacker (T76). The whole block count stays the score. Names: Teetering Tower, Second Sense, Swift Sum.
- **Placeholder pass target of 10** (Nov 9): keep for now; re-tuned with the new Tower (a decent player should reach row 10).
- **Leaving an attempt early** (Nov 9): it is a loss. No retry, and it counts as a failed attempt in the pass rate (T17).
- **Grace period after the deadline** (Nov 9): none; a late finish does not count.
