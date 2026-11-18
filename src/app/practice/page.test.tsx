// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PracticeHub from "./page";

afterEach(cleanup);

describe("/practice", () => {
  it("lists every challenge with one line each, linking to each practice page", () => {
    render(<PracticeHub />);
    const items = within(screen.getByRole("list", { name: "Challenges" })).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    const entries = items.map((item) => {
      const link = within(item).getByRole("link");
      return [link.textContent, link.getAttribute("href"), within(item).getByRole("paragraph").textContent];
    });
    expect(entries).toEqual([
      ["Teetering Tower", "/practice/stacking", "Stack the sliding rows as high as you can."],
      ["Second Sense", "/practice/inner-clock", "Four rounds: tap when each target time has passed. Every miss drains your 10-second time bank."],
      ["Swift Sum", "/practice/flash-count", "Five rounds: dots flash, say how many. Every dot you miss drains your 10-dot bank."],
      ["Echo Path", "/practice/echo-path", "A path of tiles climbs the board. Tap it back, one tile longer each time, all the way to the top."],
      ["Fair Split", "/practice/fair-split", "Cut each odd shape in half with one straight line, before time runs out."],
    ]);
  });

  it("says practice never counts, under a page title with a way back home", () => {
    render(<PracticeHub />);
    expect(screen.getByRole("heading", { level: 1, name: "Practice" })).toBeTruthy();
    expect(screen.getByText(/Practice never counts/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
  });
});
