// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { HistoryDay } from "@/lib/streak/streak";
import { HistoryTable } from "./HistoryTable";

afterEach(cleanup);

const days: HistoryDay[] = [
  { gameDate: "2026-11-10", challengeType: "stacking", finalPassRate: 0.52, threshold: 0.6, outcome: "broken" },
  { gameDate: "2026-11-09", challengeType: "stacking", finalPassRate: null, threshold: 0.6, outcome: "broken" },
  { gameDate: "2026-11-08", challengeType: "stacking", finalPassRate: 0.81, threshold: 0.6, outcome: "survived" },
];

const cells = (row: HTMLElement) => [...(row as HTMLTableRowElement).cells].map((cell) => cell.textContent);

describe("HistoryTable", () => {
  it("lists each closed day with its challenge, pass rate, threshold and result, in the order given", () => {
    render(<HistoryTable history={{ days, page: 1, pageCount: 1 }} />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map(cells)).toEqual([
      ["Nov 10, 2026", "Teetering Tower", "52%", "60%", "Broke"],
      ["Nov 9, 2026", "Teetering Tower", "no attempts", "60%", "Broke"],
      ["Nov 8, 2026", "Teetering Tower", "81%", "60%", "Survived"],
    ]);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("links to newer and older pages in the middle of the history", () => {
    render(<HistoryTable history={{ days, page: 2, pageCount: 3 }} />);
    const pages = screen.getByRole("navigation", { name: "History pages" });
    expect(within(pages).getByRole("link", { name: "Newer days" }).getAttribute("href")).toBe("/history");
    expect(within(pages).getByRole("link", { name: "Older days" }).getAttribute("href")).toBe("/history?page=3");
    expect(pages.textContent).toMatch(/Page 2 of 3/);
  });

  it("has no newer link on the first page and no older link on the last", () => {
    render(<HistoryTable history={{ days, page: 1, pageCount: 2 }} />);
    expect(screen.queryByRole("link", { name: "Newer days" })).toBeNull();
    expect(screen.getByRole("link", { name: "Older days" }).getAttribute("href")).toBe("/history?page=2");
    cleanup();
    render(<HistoryTable history={{ days, page: 3, pageCount: 3 }} />);
    expect(screen.queryByRole("link", { name: "Older days" })).toBeNull();
    expect(screen.getByRole("link", { name: "Newer days" }).getAttribute("href")).toBe("/history?page=2");
  });

  it("says so when no day has closed yet", () => {
    render(<HistoryTable history={{ days: [], page: 1, pageCount: 1 }} />);
    expect(screen.getByText("No game day has closed yet.")).toBeTruthy();
  });
});
