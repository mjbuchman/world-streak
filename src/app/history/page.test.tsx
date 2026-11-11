// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HistoryPage as History } from "@/lib/streak/streak";

const readHistory = vi.hoisted(() => vi.fn<(db: unknown, page: number) => Promise<History | null>>());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/streak/streak", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/streak/streak")>()),
  readHistory,
}));

import HistoryPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const oneDay: History = {
  days: [{ gameDate: "2026-11-10", challengeType: "stacking", finalPassRate: 0.52, threshold: 0.6, outcome: "broken" }],
  page: 1,
  pageCount: 1,
};
const visit = (search: Record<string, string | string[] | undefined>) => HistoryPage({ searchParams: Promise.resolve(search) });

describe("/history", () => {
  it("shows the requested page of closed days", async () => {
    readHistory.mockResolvedValue({ ...oneDay, page: 2, pageCount: 2 });
    render(await visit({ page: "2" }));
    expect(readHistory).toHaveBeenCalledWith(expect.anything(), 2);
    expect(screen.getByRole("heading", { name: "Every day" })).toBeTruthy();
    expect(screen.getByText("Nov 10, 2026")).toBeTruthy();
  });

  it("reads a missing or bad page number as the first page", async () => {
    readHistory.mockResolvedValue(oneDay);
    await visit({});
    await visit({ page: "-1" });
    expect(readHistory.mock.calls.map(([, page]) => page)).toEqual([1, 1]);
  });

  it.each([
    ["past the last page", { ...oneDay, pageCount: 1 }],
    ["starting past the last day", null],
  ])("is not found for a page %s", async (_name, history) => {
    readHistory.mockResolvedValue(history);
    await expect(visit({ page: "5" })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});
