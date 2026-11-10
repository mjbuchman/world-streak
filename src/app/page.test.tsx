// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Home from "./page";

afterEach(cleanup);

describe("Home", () => {
  it("leads with the game name and its pitch", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: "World Streak" })).toBeTruthy();
    expect(screen.getByText(/if enough of the world passes, humanity's streak survives/)).toBeTruthy();
  });

  it("shows today's challenge as a card with Play and Practice first", () => {
    render(<Home />);
    const card = screen.getByRole("region", { name: "Teetering Tower" });
    expect(within(card).getByText("Today's challenge")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Play today's challenge" }).getAttribute("href")).toBe("/play");
    expect(within(card).getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/stacking");
  });
});
