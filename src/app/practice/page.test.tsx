// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PracticeHub from "./page";

afterEach(cleanup);

describe("/practice", () => {
  it("lists every challenge with one line each, linking to each practice page", () => {
    render(<PracticeHub />);
    const items = within(screen.getByRole("list", { name: "Challenges" })).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    const entries = items.map((item) => {
      const link = within(item).getByRole("link");
      return [link.textContent, link.getAttribute("href"), within(item).getByRole("paragraph").textContent];
    });
    expect(entries).toEqual([
      ["Teetering Tower", "/practice/stacking", "Stack the sliding rows as high as you can."],
      ["Second Sense", "/practice/inner-clock", "Four rounds: tap when each target time has passed. Targets of 10 to 20 seconds; every miss drains your 4-second time bank."],
      ["Swift Sum", "/practice/flash-count", "Five rounds of 10 to 25 dots, a new count every round: say how many. Every dot you miss drains your 10-dot bank."],
      ["Trail Trace", "/practice/echo-path", "A path of up to 12 tiles climbs the board. Tap it back, one tile longer each time, all the way to the top, with one extra life."],
      ["Clean Cut", "/practice/fair-split", "Five irregular blobs and polygons: place one straight line to cut each in half. Every point off 50% drains your 8-point bank."],
      ["Confusing Colors", "/practice/ink", "30 colour words in a row: tap the colour of the ink, not the word. Slow and wrong answers drain your time bank."],
    ]);
  });

  it("marks the games still on trial as New, and only those (T245, T252, T257, T258)", () => {
    render(<PracticeHub />);
    const badges = screen.getAllByText("New");
    expect(badges.map((badge) => badge.closest("li")?.textContent)).toEqual([expect.stringMatching(/^Confusing Colors/)]);
  });

  it("says practice never counts, under a page title with a way back home", () => {
    render(<PracticeHub />);
    expect(screen.getByRole("heading", { level: 1, name: "Practice" })).toBeTruthy();
    expect(screen.getByText(/Practice never counts/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
  });
});
