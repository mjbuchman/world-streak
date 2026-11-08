# Decisions made by agents

Judgment calls on items `docs/DESIGN.md` marks as Open. Each one is also flagged in `docs/NEEDS_HUMAN.md` for confirmation. If the human overrules a decision, record that here too.

<!-- Format:
### YYYY-MM-DD — <item> (T05)
- Choice: ...
- Reason: ... (cite the design doc's recommendation if there was one)
- How to change it later: e.g. edit GAME_DEADLINE_UTC in src/lib/config.ts or the admin page
- Confirmed by human: pending | yes | changed to ...
-->

### 2026-11-07 — Prize amount (pre-planning)
- Choice: flat $200 per cycle; if there's no 30-day streak, the prize rolls into the next cycle ($400 after one rollover, and so on). The design doc's "prize formula, floor and cap" wording and the Cycle "revenue share" and "cap" fields are left out of the schema and the rules page.
- Reason: the human's answer; those fields are leftovers that may come back later.
- How to change it later: prize amount config constant (set in the prize task).
- Confirmed by human: yes

### 2026-11-07 — Eligibility (pre-planning)
- Choice: US residents aged 18 and over, enforced at sign-up.
- Reason: the human's answer.
- How to change it later: minimum age and allowed region config settings (set in the sign-up task).
- Confirmed by human: yes

### 2026-11-07 — Milestone count (pre-planning)
- Choice: 4 milestones instead of the planner's suggested 6.
- Reason: the human wants fewer play-test interruptions.
- Confirmed by human: yes

### 2026-11-07 — Open design items use the doc's suggestions (pre-planning)
- Choice: deadline at midnight UTC; live meter hidden for the final 3 hours; survival threshold 60%; pass target at the 80th percentile, admin-editable; new accounts count fully from day one through a configurable weight; working name "World Streak" in one config constant; pass-target rise with the streak is a setting with a flat placeholder; challenges after the first three are not in the MVP.
- Reason: the human said to take the design doc's suggestions for now.
- How to change it later: each is a config constant or admin setting; the implementing task records where.
- Confirmed by human: yes (for now)

### 2026-11-07 — UI guidelines and styling approach (pre-build)
- Choice: follow `docs/UI_GUIDELINES.md`: Material 3, styled with plain CSS Modules and CSS-variable tokens; no Tailwind, shadcn or MUI; no emojis except in the share text; no em dashes in UI text.
- Reason: the human wants a clean Material look without the usual signs of an AI-built app; the human approved the list and the styling approach.
- How to change it later: edit `docs/UI_GUIDELINES.md` (human approval needed).
- Confirmed by human: yes. The brand color and typefaces are placeholders, pending confirmation in NEEDS_HUMAN.

### 2026-11-07 — Public health endpoint (T02)
- Choice: `GET /api/health` needs no sign-in, an exception to CLAUDE.md's "every route handler checks authentication".
- Reason: it is a liveness probe for monitoring and the T02 e2e test; it takes no input and reveals only whether the database answers (via `public.health_check()`, which reads no data).
- How to change it later: add an auth check in `src/app/api/health/route.ts`, or delete the route.
- Confirmed by human: not needed (no Open design item); recorded for visibility.

### 2026-11-07 — Final game name (T03)
- Choice: working name "World Streak", defined once as `GAME_NAME`.
- Reason: the design doc lists the final name as Open; the human said to keep the working name for now.
- How to change it later: edit `GAME_NAME` in `src/config/game.ts`; the page title and home heading follow it.
- Confirmed by human: yes (for now)

### 2026-11-07 — Which "today" the age check uses (T05)
- Choice: the calendar date in Pacific/Honolulu (`ELIGIBILITY_TIME_ZONE` in `src/config/eligibility.ts`). Hawaii is the westernmost US state time zone, so its calendar date is the earliest in the US.
- Reason: using the UTC date would accept someone during the US evening before their 18th birthday. The earliest US date can never be ahead of any US resident's local date, so it never admits anyone early; at worst it makes someone in the eastern US wait a few extra hours on their birthday.
- How to change it later: edit `ELIGIBILITY_TIME_ZONE`.
- Confirmed by human: not needed (follows from the human's 18+ rule); recorded for visibility.

### 2026-11-07 — Sign-up says when an email is already registered (T05)
- Choice: signing up with a registered email shows "An account with this email already exists. Try signing in."
- Reason: clearer for real players than a vague message. The trade-off is that anyone can check whether an email has an account. That is acceptable for a game account holding no sensitive data, and abuse of the sign-up form is handled by T52.
- How to change it later: edit the email-taken message in `src/lib/signup.ts`.
- Confirmed by human: not needed; recorded for visibility.

### 2026-11-07 — Location check is self-declared (T03)
- Choice: eligibility uses the date of birth and country of residence the player enters at sign-up. No IP geolocation check in the MVP.
- Reason: judgment call by the planner (the design doc says "age and location eligibility enforced at sign-up" without a method). IP checks need a paid or third-party service, block VPN users and travellers unfairly, and the prize winner's identity and address are verified before payout anyway.
- How to change it later: add a check alongside `checkEligibility` in `src/lib/eligibility.ts`; the rules live in `src/config/eligibility.ts`.
- Confirmed by human: pending (see NEEDS_HUMAN)

### 2026-11-08 — Public Google sign-in callback (T07)
- Choice: `GET /auth/callback` needs no sign-in, an exception to CLAUDE.md's "every route handler checks authentication".
- Reason: it is where Google sign-in returns, before any session exists. Its only input is the one-time code, which Supabase validates against the PKCE verifier cookie; a missing or rejected code redirects to `/signin?error=oauth`.
- How to change it later: nothing to change unless sign-in moves elsewhere; the handler is `src/app/auth/callback/route.ts`.
- Confirmed by human: not needed (no Open design item); recorded for visibility.

### 2026-11-08 — Stacking speed ranges (T09)
- Choice: start speed 0.10-0.12 units/ms, ramp 0.002-0.003 units/ms per block, hard cap 60 s (`PARAM_RANGES` in `src/challenges/stacking/engine.ts`).
- Reason: the design says speed rises with height "to cap runs near one minute". A simulated player who lines up each block and taps within ±30 ms lasts a median of about 41-60 s across the ranges, while a ±80 ms player ends well before the minute. The first try (0.18-0.24, 0.004-0.008) ended good runs in 15-30 s. `src/challenges/stacking/tuning.test.ts` pins this.
- How to change it later: edit `PARAM_RANGES`, update the tuning test bounds and `engine.golden.json` (scores for issued seeds change), and record the new values here.
- Confirmed by human: pending; judge it at the M1 play-test.

### 2026-11-08 — Stacking score is a whole block count (T09)
- Choice: the score is the number of blocks placed, an integer.
- Reason: the Decided challenge table says the measure is "Blocks stacked". The design also asks for a "continuous scale" elsewhere, which an integer count only approximates; the backlog flags this as ambiguous.
- How to change it later: add a tie-breaking fraction (for example the remaining width of the top block divided by 200) to `simulate`'s score, and regenerate the golden fixture.
- Confirmed by human: pending (see NEEDS_HUMAN).
