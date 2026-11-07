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

### Please confirm: brand color and typefaces (blocks nothing)
- What is needed: confirm or replace the placeholder brand seed color `#B5532A` (warm terracotta) and the typefaces (Roboto Flex for body text, Bricolage Grotesque for the display text). Any free Google Font works.
- Where to put it: reply in chat. The agent updates `docs/UI_GUIDELINES.md` and the token stylesheet.
- Why: you didn't pick a brand color when approving the UI guidelines. The whole color scheme is generated from this one value, so it's a one-line change later.
- Agent's recommendation: keep the placeholders until the M1 play-test, then judge them on the real screens.

### Create .env.local before play-testing (blocks nothing now; needed for the M1 play-test)
- What is needed: run `npm run db:start`, then `cp .env.example .env.local`, then fill in the three values from `npx supabase status` (exact steps in README "Running the app").
- Where to put it: `.env.local` in the repository root (ignored by git).
- Why: the agent's permissions forbid it from reading or writing `.env*` files, so it runs tests by passing the local keys through the environment instead. `npm run dev` needs the file.
- Agent's recommendation: do it once at the M1 play-test; these are local-only keys.

### Please confirm: location is self-declared, no IP check (blocks nothing)
- What is needed: confirm that players simply state their country of residence at sign-up (US only), with no IP-based location check in the MVP.
- Where to put it: reply in chat.
- Why: the design doc requires location eligibility at sign-up but doesn't say how. Details in `docs/DECISIONS.md` (T03).
- Agent's recommendation: keep it self-declared; verify the winner's address before payout.

### Cloudflare Turnstile keys for sign-up protection (blocks the final wiring of T52; not needed until launch)
- What is needed: a free Cloudflare account and a Turnstile widget for the production domain (add `localhost` too for testing). Then the site key and secret key.
- Where to put it: `.env.local` and the Vercel project settings, as `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- Why: sign-up uses the admin API, so Supabase's built-in sign-up rate limit does not apply. A free CAPTCHA plus a per-IP limit stops bulk account creation in a prize game.
- Agent's recommendation: do it before the public launch. T52 works without the keys locally (it skips the CAPTCHA and logs a warning).

## Resolved

_Nothing yet._
