// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminDay } from "@/lib/admin";
import { addDays, gameDateAt } from "@/lib/gameDay";

const isAdmin = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
const readAdminDays = vi.hoisted(() => vi.fn<() => Promise<AdminDay[]>>());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const sessionClient = vi.hoisted(() => ({ kind: "session" }));
const serviceClient = vi.hoisted(() => ({ kind: "service" }));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => sessionClient) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => serviceClient) }));
vi.mock("@/lib/admin", () => ({ isAdmin, readAdminDays }));
vi.mock("@/app/admin/actions", () => ({ saveGameDayAction: vi.fn(), localToolAction: vi.fn() }));
const localToolsEnabled = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/lib/localTools", () => ({ localToolsEnabled, MAX_SEED_PLAYERS: 500 }));

import AdminPage from "./page";

/** A lineup whose first game has `target` and, when `firstStarted`, an attempt. */
const lineup = (target: number, firstStarted: boolean): AdminDay["games"] => [
  { position: 1, challengeType: "stacking", passTarget: target, started: firstStarted },
  { position: 2, challengeType: "inner-clock", passTarget: 4, started: false },
  { position: 3, challengeType: "flash-count", passTarget: 5, started: false },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localToolsEnabled.mockReturnValue(false);
});

describe("/admin", () => {
  it("is not found for anyone who is not an admin, before any game day is read or created", async () => {
    isAdmin.mockResolvedValue(false);
    await expect(AdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(isAdmin).toHaveBeenCalledWith(sessionClient);
    expect(readAdminDays).not.toHaveBeenCalled();
  });

  it("lists the coming days for an admin, read with the service role: open ones editable, closed ones not", { timeout: 10_000 }, async () => {
    isAdmin.mockResolvedValue(true);
    readAdminDays.mockResolvedValue([
      { gameDate: "2026-11-11", games: lineup(3.5, true), threshold: 0.55, closed: true, started: true },
      { gameDate: "2026-11-12", games: lineup(10, false), threshold: 0.6, closed: false, started: false },
      { gameDate: "2026-11-13", games: lineup(8, true), threshold: 0.6, closed: false, started: true },
    ]);
    render(await AdminPage());
    expect(readAdminDays).toHaveBeenCalledWith(serviceClient, expect.any(Date));
    const [closed, open, started] = within(screen.getByRole("region", { name: "Coming game days" })).getAllByRole("row").slice(1);
    expect(within(started).getAllByRole("spinbutton").map((input) => input.getAttribute("aria-label"))).toEqual([
      "Pass target for game 2 on Nov 13, 2026",
      "Pass target for game 3 on Nov 13, 2026",
      "Survival threshold in percent for Nov 13, 2026",
    ]);
    expect(within(started).getByText("Locked: players have started this game.")).toBeTruthy();
    expect([...(closed as HTMLTableRowElement).cells].map((cell) => cell.textContent)).toEqual([
      "Nov 11, 2026",
      "Teetering Tower, target 3.5Second Sense, target 4Swift Sum, target 5",
      "55%",
      "Closed",
    ]);
    expect(within(closed).queryByRole("spinbutton")).toBeNull();
    expect(within(open).getByRole<HTMLInputElement>("spinbutton", { name: "Pass target for game 1 on Nov 12, 2026" }).value).toBe("10");
    expect(within(open).getByRole<HTMLInputElement>("spinbutton", { name: "Survival threshold in percent for Nov 12, 2026" }).value).toBe("60");
  });

  it("has no local tools unless the app runs with the local Supabase", async () => {
    isAdmin.mockResolvedValue(true);
    readAdminDays.mockResolvedValue([]);
    render(await AdminPage());
    expect(screen.queryByRole("region", { name: "Local tools" })).toBeNull();
  });

  it("offers the local tools with the local Supabase, for the open days and every challenge", async () => {
    isAdmin.mockResolvedValue(true);
    localToolsEnabled.mockReturnValue(true);
    readAdminDays.mockResolvedValue([
      { gameDate: "2026-11-11", games: lineup(3, true), threshold: 0.6, closed: true, started: true },
      { gameDate: "2026-11-12", games: lineup(0.5, true), threshold: 0.6, closed: false, started: true },
    ]);
    render(await AdminPage());
    const tools = screen.getByRole("region", { name: "Local tools" });
    const setLineup = within(tools).getByRole("form", { name: "Set a day's lineup" });
    const select = (name: string) => within(setLineup).getByRole<HTMLSelectElement>("combobox", { name });
    expect([...select("Day").querySelectorAll("option")].map((option) => option.textContent)).toEqual(["Nov 12, 2026"]);
    expect([...select("Game 1").querySelectorAll("option")].map((option) => [option.value, option.textContent])).toEqual([
      ["stacking", "Teetering Tower"],
      ["inner-clock", "Second Sense"],
      ["flash-count", "Swift Sum"],
      ["echo-path", "Echo Path"],
      ["fair-split", "Fair Split"],
    ]);
    // Three different games to start with, so the form is valid as it stands.
    expect(["Game 1", "Game 2", "Game 3"].map((name) => select(name).value)).toEqual(["stacking", "inner-clock", "flash-count"]);
    for (const name of ["Set lineup", "Clear my day", "Reset day", "Restore the pool", "Seed players", "Close day", "Remove fake players"]) {
      expect(within(tools).getByRole("button", { name })).toBeTruthy();
    }
    const seed = within(tools).getByRole("form", { name: "Seed fake players" });
    expect(within(seed).getByRole<HTMLInputElement>("spinbutton", { name: "Players" }).max).toBe("500");
    // Closing is for a day past its deadline: yesterday by default.
    const close = within(tools).getByRole("form", { name: "Close a day" });
    expect(within(close).getByLabelText<HTMLInputElement>("Day").value).toBe(addDays(gameDateAt(new Date()), -1));
  });
});
