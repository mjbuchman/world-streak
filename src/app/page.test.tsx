// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChallengeType } from "@/challenges/shared/types";

// The meter, the prize and the streak panel have their own tests; here they are stand-ins.
vi.mock("@/components/WorldStreak", () => ({ WorldStreak: () => <section aria-label="World streak" /> }));
vi.mock("@/components/PrizeCycle", () => ({ PrizeCycle: () => <section aria-label="Prize" /> }));
vi.mock("@/components/Meter", () => ({ Meter: () => <section aria-label="Today's meter" /> }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
const todaysChallenge = vi.hoisted(() => vi.fn<() => Promise<ChallengeType>>());
vi.mock("@/lib/attempts/today", () => ({ todaysChallenge, DEFAULT_CHALLENGE: "stacking" }));

import Home from "./page";

beforeEach(() => {
  todaysChallenge.mockResolvedValue("stacking");
});

afterEach(cleanup);

describe("Home", () => {
  it("has the game name as its heading and the countdown in its header, before the meter", async () => {
    const { container } = render(await Home());
    expect(screen.getByRole("heading", { level: 1, name: "World Streak" })).toBeTruthy();
    const header = container.querySelector("main > header");
    expect(header?.querySelector('[role="timer"]')).toBeTruthy();
    expect(header?.nextElementSibling?.getAttribute("aria-label")).toBe("Today's meter");
  });

  it("puts the meter first, then today's challenge, the prize and the world streak", async () => {
    render(await Home());
    const order = screen.getAllByRole("region").map((region) => region.getAttribute("aria-label") ?? region.textContent);
    expect(order).toEqual(["Today's meter", expect.stringContaining("Teetering Tower"), "Prize", "World streak"]);
  });

  it("shows today's challenge as a card with Play and Practice first", async () => {
    render(await Home());
    const card = screen.getByRole("region", { name: "Teetering Tower" });
    expect(within(card).getByText("Your part today")).toBeTruthy();
    expect(within(card).getByText("Stack the sliding rows as high as you can. One scored try a day.")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Play today's challenge" }).getAttribute("href")).toBe("/play");
    expect(within(card).getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/stacking");
  });

  it("shows the default challenge, not an error page, when today's cannot be read", async () => {
    todaysChallenge.mockRejectedValue(new Error("down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    render(await Home());
    expect(screen.getByRole("region", { name: "Teetering Tower" })).toBeTruthy();
    expect(logged).toHaveBeenCalledWith(new Error("down"));
    logged.mockRestore();
  });

  it("follows today's challenge, and links to every practice game (T108)", async () => {
    todaysChallenge.mockResolvedValue("inner-clock");
    render(await Home());
    const card = screen.getByRole("region", { name: "Second Sense" });
    expect(within(card).getByText(/^Tap when you think the target time has passed/)).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Practice first" }).getAttribute("href")).toBe("/practice/inner-clock");
    expect(within(card).getByRole("link", { name: "Practice any challenge" }).getAttribute("href")).toBe("/practice");
  });
});
