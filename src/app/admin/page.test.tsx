// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminDay } from "@/lib/admin";

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
vi.mock("@/app/admin/actions", () => ({ saveGameDayAction: vi.fn() }));

import AdminPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
      { gameDate: "2026-11-11", challengeType: "stacking", passTarget: 3.5, threshold: 0.55, closed: true, started: true },
      { gameDate: "2026-11-12", challengeType: "stacking", passTarget: 10, threshold: 0.6, closed: false, started: false },
      { gameDate: "2026-11-13", challengeType: "stacking", passTarget: 8, threshold: 0.6, closed: false, started: true },
    ]);
    render(await AdminPage());
    expect(readAdminDays).toHaveBeenCalledWith(serviceClient, expect.any(Date));
    const [closed, open, started] = within(screen.getByRole("region", { name: "Coming game days" })).getAllByRole("row").slice(1);
    expect(within(started).getAllByRole("spinbutton").map((input) => input.getAttribute("aria-label"))).toEqual([
      "Survival threshold in percent for Nov 13, 2026",
    ]);
    expect(within(started).getByText("Locked: players have started this day.")).toBeTruthy();
    expect([...(closed as HTMLTableRowElement).cells].map((cell) => cell.textContent)).toEqual([
      "Nov 11, 2026",
      "Teetering Tower",
      "3.5",
      "55%",
      "Closed",
    ]);
    expect(within(closed).queryByRole("spinbutton")).toBeNull();
    expect(within(open).getByRole<HTMLInputElement>("spinbutton", { name: "Pass target for Nov 12, 2026" }).value).toBe("10");
    expect(within(open).getByRole<HTMLInputElement>("spinbutton", { name: "Survival threshold in percent for Nov 12, 2026" }).value).toBe("60");
  });
});
