# UI guidelines

Version 2, approved by the human owner on 2026-11-09 (replaces the Material 3 version of 2026-11-07). Every task that touches the user interface follows these rules, and the spec reviewer checks them.

The goal: **clean, modern and visually exciting.** First impressions and the urge to come back tomorrow matter, so the look is a feature, not an afterthought. The chosen direction is **Fresh Sport** (mockup: https://claude.ai/artifact/3Lpden7TLXog2zTMaeUQZ8, artboard C): deep teal, mint and tangerine, a wide geometric display face, scoreboard energy.

## The look: Fresh Sport

1. **Dark teal is the brand.** The ground is a deep teal with a soft vertical gradient; content sits on translucent white surfaces. There is one theme (dark) for the MVP.
2. **Two accents with clear jobs.** Mint is the brand and "good" colour: the streak number, passing, placed blocks, links. Tangerine is the action colour: the main button on each screen, the moving block. Never use them interchangeably.
3. **Gradients and glow are welcome where they serve the game:** the background, the main action button, game pieces, the meter, the result reveal. Keep them soft and in the palette. Never purple-to-blue or purple-to-pink, and no rainbow washes.
4. **Game-themed decoration is allowed:** falling-block confetti on a result, a radial glow behind a big number. No generic blobs, mesh gradients, dot grids or stock illustrations.
5. **Typography carries the personality.** Unbounded (600 and 800) for display: the streak number, challenge names, verdicts, scores. Manrope for everything else. Big numbers are big.
6. **Shapes:** pill buttons; large rounded surfaces (22 to 26 px); game cells 8 px. Depth comes from translucency, gradients and soft coloured shadows, not grey drop shadows.
7. **Motion is part of the feel.** Use it for screen transitions, button press feedback, loading (spinners on every button that waits), the meter filling, blocks landing and falling, and the pass or fail reveal. Short and snappy (about 150 to 400 ms, ease-out); respect `prefers-reduced-motion` with instant or fade-only versions.
8. **Every screen has a way back:** a round back button top-left on any screen below home, except during a running game.
9. **Accessible as designed:** text contrast at least 4.5:1 (3:1 for text 24 px and up) against its actual background; touch targets at least 48 px; colours that must be told apart also differ in lightness; real buttons and links with visible keyboard focus.

## Still avoided

10. **No emojis anywhere** except the share text (`src/lib/share/`). An automated test enforces this.
11. **No landing-page template.** No centered hero with two buttons, no row of three features with icons in tinted circles. Today's challenge and the world's streak are the home page.
12. **No default library look.** No Tailwind, shadcn or MUI, and no Inter-on-slate-grey palette.
13. **No icon next to every label,** no "New" or "Beta" pill badges, no sparkle or rocket icons. Icons are simple stroked SVGs at one weight, used where they help someone scan or act.
14. **No rows of identical stat tiles** (big number over tiny grey label, four across). The streak and the meter are designed elements.

## Words

15. **No em dashes in UI text.** Use commas, full stops or colons. An automated test enforces this in source files.
16. **No marketing words:** seamless, effortless, unleash, elevate, supercharge, journey, dive in, game-changer, "Ready to...?", "Join thousands...".
17. **Sentence case** for headings and buttons.
18. **Short, specific and a little energetic.** "61% passed. 60% needed." and "You helped keep the streak alive." Celebrate a pass and be kind about a fail, but no "Awesome!!", "Woohoo" or stacked exclamation marks, and no catchy slogans in threes.
19. **No invented social proof.** Show only real numbers from the database.
20. **No filler footer** and no links to pages that do not exist.
21. **No pop-up confirmations** for things the screen already shows.

## Implementation

- Plain CSS Modules plus one global token stylesheet (`src/app/tokens.css`) defining the colours, gradients, shadows, radii, type scale, spacing (8 px grid) and motion durations as CSS variables. Components use the tokens and never hard-code colours.
- **Palette** (from the mockup): ground `#02191B` to `#063C3F`; surface `rgba(255,255,255,.06)`; mint `#34F5B5` (gradient `#5BFFC8` to `#1FCB91`); tangerine `#FF7A1A` (gradient `#FFB050` to `#FF7A1A`, text on it `#1A0E02`); text `#F2FBF8`; muted text `#A3C4BD`.
- **Typefaces:** Unbounded (display) and Manrope (body), both free on Google Fonts, loaded with `next/font`.
- Shared components for the repeated pieces: button (primary, secondary, with a loading state), back button, spinner, surface card, page shell.
