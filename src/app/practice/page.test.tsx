// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PracticeHub from "./page";

afterEach(cleanup);

describe("/practice", () => {
  it("lists the three challenges with one line each, linking to each practice page", () => {
    render(<PracticeHub />);
    const items = within(screen.getByRole("list", { name: "Challenges" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    const entries = items.map((item) => {
      const link = within(item).getByRole("link");
      return [link.textContent, link.getAttribute("href"), within(item).getByRole("paragraph").textContent];
    });
    expect(entries).toEqual([
      ["Teetering Tower", "/practice/stacking", "Stack the sliding rows as high as you can."],
      ["Second Sense", "/practice/inner-clock", "Tap when you think the target time has passed. The clock hides after a second."],
      ["Swift Sum", "/practice/flash-count", "Dots flash for a second. Say how many there were."],
    ]);
  });

  it("says practice never counts, under a page title with a way back home", () => {
    render(<PracticeHub />);
    expect(screen.getByRole("heading", { level: 1, name: "Practice" })).toBeTruthy();
    expect(screen.getByText(/Practice never counts/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/");
  });
});
