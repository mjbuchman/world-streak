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
