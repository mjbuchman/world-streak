import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = path.resolve(import.meta.dirname, "../..");

// T74 moved these to the Fresh Sport tokens; T75 moves the rest and deletes the legacy aliases.
const RESTYLED = [
  "app/page.module.css",
  "app/play/play.module.css",
  "app/practice/stacking/practice.module.css",
  "components/stacking/StackingGame.module.css",
  "components/ui/ui.module.css",
  "components/AccountHeader.module.css",
];

describe("restyled CSS modules", () => {
  it.each(RESTYLED)("%s uses only Fresh Sport tokens", (file) => {
    const css = readFileSync(path.join(src, file), "utf8");
    expect(css).not.toMatch(/--md-/);
  });
});
