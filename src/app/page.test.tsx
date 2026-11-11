// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The meter and the streak panel have their own tests; here they are stand-ins.
vi.mock("@/components/WorldStreak", () => ({ WorldStreak: () => <section aria-label="World streak" /> }));
vi.mock("@/components/Meter", () => ({ Meter: () => <section aria-label="Today's meter" /> }));

import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("has the game name as its heading and the countdown in its header, before the meter", () => {
    const { container } = render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "World Streak" })).toBeTruthy();
    const header = container.querySelector("main > header");
    expect(header?.querySelector('[role="timer"]')).toBeTruthy();
    expect(header?.nextElementSibling?.getAttribute("aria-label")).toBe("Today's meter");
  });

  it("puts the meter first, then today's challenge, then the world streak", () => {
    render(<Home />);
    const order = screen.getAllByRole("region").map((region) => region.getAttribute("aria-label") ?? region.textContent);
    expect(order).toEqual(["Today's meter", expect.stringContaining("Teetering Tower"), "World streak"]);
  });

  it("shows today's challenge as a card with Play and Practice first", () => {
    render(<Home />);
    const card = screen.getByRole("region", { name: "Teetering Tower" });
    expect(within(card).getByText("Your part today")).toBeTruthy();
    expect(within(card).getByText("Stack as high as you can. One scored try a day.")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Play today's challenge" }).getAttribute("href")).toBe("/play");
    expect(within(card).getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/stacking");
  });
});
