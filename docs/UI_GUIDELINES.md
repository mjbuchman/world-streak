# UI guidelines

Approved by the human owner on 2026-11-07. Every task that touches the user interface follows these rules, and the spec reviewer checks them. The goal is a clean, modern app that follows Material Design 3 and does not look like a generic AI-generated template.

## Look

1. **No emojis anywhere** except the share text (`src/lib/share/`). That covers icons, headings, buttons, toasts and empty states. An automated test enforces this.
2. **No purple-to-blue or purple-to-pink gradients.** No gradient text, gradient buttons or gradient borders. Colors stay flat.
3. **No glass effects, glows or neon shadows.** No frosted or blurred cards, no glowing buttons.
4. **No decorative backgrounds.** No blurry color blobs, dot grids, mesh gradients or animated noise.
5. **Cards only where something is a card.** Don't wrap everything in a rounded box with a soft shadow, and don't nest cards. Use plain surfaces, spacing and dividers.
6. **Don't fully round every corner.** Use the Material 3 shape scale (small, medium, large) where each fits.
7. **No landing-page template.** No big centered headline with two buttons, and no row of three features with icons in tinted circles. Today's challenge is the home page.
8. **No icon next to every label.** Use icons only where they help someone scan or act. Use Material Symbols at one consistent weight.
9. **No rows of identical stat tiles** (a big number over a tiny grey label, four across). The streak and the meter are designed elements, not dashboard filler.
10. **No "New" or "Beta" pill badges, and no sparkle or rocket icons.**
11. **No default library look.** No Tailwind, shadcn or MUI, no slate-grey and indigo palette, no Inter. Use Material 3 color roles generated from one brand seed color, which is not purple or indigo.
12. **No fade-in-on-scroll and no hover-lift on everything.** Use motion only where it means something, such as the pass or fail reveal or the meter moving. Use Material 3 easing and durations, and respect `prefers-reduced-motion`.
13. **Don't default to dark mode with purple accents.** Support light and dark from the same color roles, following the system setting.

## Words

14. **No em dashes in UI text.** Use commas, full stops or colons. An automated test enforces this in source files.
15. **No marketing words:** seamless, effortless, unleash, elevate, supercharge, journey, dive in, game-changer, "Ready to...?", "Join thousands...".
16. **Sentence case for headings and buttons**, following Material. No Title Case.
17. **No catchy slogans in threes** ("Play. Pass. Persist.") and no "It's not X, it's Y."
18. **Calm wording.** No "Awesome!", "Woohoo" or stacked exclamation marks. A pass or fail is stated plainly.
19. **No invented social proof.** No testimonials, no "10,000+ players" and no fake counts. Show only real numbers from the database.
20. **No filler footer.** No social links that go nowhere, no generic "All rights reserved" boilerplate, and no links to pages that don't exist.
21. **No pop-up confirmations for things the screen already shows.**

## What to do instead

22. **Use Material 3 properly.** Follow the type scale and an 8dp spacing grid. Show depth with tonal surface colors rather than drop shadows. Use state layers for hover, focus and press. Make touch targets at least 48dp.
23. **One distinct personality.** Express it through the brand color, one display typeface for the streak number and headings, and the challenge visuals. Everything else stays plain.
24. **Short, specific wording.** "61% passed. 60% needed." beats "The world is doing great!"

## Implementation

- Plain CSS Modules plus one global token stylesheet that defines the Material 3 color roles (light and dark), shape scale, type scale and spacing as CSS variables. Components use the tokens and never hard-code colors.
- **Brand seed color (placeholder, pending human confirmation):** `#B5532A`, a warm terracotta. Generate the tonal palettes and color roles from it with Material's color utilities (at build time or as a one-off script; there is no runtime dependency).
- **Typefaces (placeholder, pending human confirmation):** Roboto Flex for body and UI text, Bricolage Grotesque for display (the streak number and headings). Both are free on Google Fonts, loaded with `next/font`.
- Icons: Material Symbols (Rounded), only where needed.
