// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditState } from "@/lib/adminEdit";

const saveGameDayAction = vi.hoisted(() => vi.fn<(previous: EditState | null, form: FormData) => Promise<EditState>>());
vi.mock("@/app/admin/actions", () => ({ saveGameDayAction }));

import { GameDayEditRow } from "./GameDayEditRow";

afterEach(() => {
  cleanup();
  saveGameDayAction.mockReset();
});

const day = {
  gameDate: "2026-11-12",
  label: "Nov 12, 2026",
  challengeType: "stacking",
  challenge: "Teetering Tower",
  passTarget: 10,
  thresholdPercent: 60,
  started: false,
} as const;

const inTable = (row: React.ReactNode) => (
  <table>
    <tbody>{row}</tbody>
  </table>
);

function renderRow(started = false) {
  render(inTable(<GameDayEditRow day={{ ...day, started }} />));
  if (started) {
    return { threshold: screen.getByRole("spinbutton", { name: "Survival threshold in percent for Nov 12, 2026" }) };
  }
  return {
    target: screen.getByRole("spinbutton", { name: "Pass target for Nov 12, 2026" }),
    threshold: screen.getByRole("spinbutton", { name: "Survival threshold in percent for Nov 12, 2026" }),
  };
}

describe("GameDayEditRow", () => {
  it("sends the day and both values from their cells, and shows the result", async () => {
    saveGameDayAction.mockResolvedValue({ ok: true, message: "Saved Nov 12, 2026." });
    const user = userEvent.setup();
    const { threshold } = renderRow();
    await user.clear(threshold);
    await user.type(threshold, "55");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => expect(saveGameDayAction).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(saveGameDayAction.mock.calls[0][1])).toEqual({
      gameDate: "2026-11-12",
      challengeType: "stacking",
      passTarget: "10",
      thresholdPercent: "55",
    });
    expect((await screen.findByRole("status")).textContent).toBe("Saved Nov 12, 2026.");
  });

  it("offers every challenge for a day nobody has started, and sends the one picked", async () => {
    saveGameDayAction.mockResolvedValue({ ok: true, message: "Saved." });
    const user = userEvent.setup();
    renderRow();
    const select = screen.getByRole<HTMLSelectElement>("combobox", { name: "Challenge for Nov 12, 2026" });
    expect(select.value).toBe("stacking");
    expect([...select.options].map((option) => [option.value, option.text])).toEqual([
      ["stacking", "Teetering Tower"],
      ["inner-clock", "Second Sense"],
      ["flash-count", "Swift Sum"],
    ]);
    await user.selectOptions(select, "flash-count");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saveGameDayAction).toHaveBeenCalledTimes(1));
    expect(saveGameDayAction.mock.calls[0][1].get("challengeType")).toBe("flash-count");
  });

  it("shows the target the server now has after a save, not the one typed before (a new challenge's default)", () => {
    const { rerender } = render(inTable(<GameDayEditRow day={day} />));
    rerender(inTable(<GameDayEditRow day={{ ...day, challengeType: "flash-count", challenge: "Swift Sum", passTarget: 20 }} />));
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Pass target for Nov 12, 2026" }).value).toBe("20");
    expect(screen.getByRole<HTMLSelectElement>("combobox", { name: "Challenge for Nov 12, 2026" }).value).toBe("flash-count");
  });

  it("shows a started day's pass target read-only with the reason, and still saves its threshold", async () => {
    saveGameDayAction.mockResolvedValue({ ok: true, message: "Saved Nov 12, 2026." });
    const user = userEvent.setup();
    const { threshold } = renderRow(true);
    expect(screen.getAllByRole("spinbutton")).toEqual([threshold]);
    expect(screen.queryByRole("combobox")).toBeNull();
    const [challengeCell, targetCell] = screen.getAllByRole("cell");
    expect(challengeCell.textContent).toBe("Teetering Tower");
    expect(targetCell.textContent).toBe("10Locked: players have started this day.");

    await user.clear(threshold);
    await user.type(threshold, "50");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saveGameDayAction).toHaveBeenCalledTimes(1));
    // The unchanged target goes along, so the save's checks and the database see the same form.
    expect(Object.fromEntries(saveGameDayAction.mock.calls[0][1])).toEqual({
      gameDate: "2026-11-12",
      passTarget: "10",
      thresholdPercent: "50",
    });
  });

  it("shows a refusal from the server", async () => {
    saveGameDayAction.mockResolvedValue({ ok: false, message: "Survival threshold must be from 0% to 100%." });
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("status")).textContent).toBe("Survival threshold must be from 0% to 100%.");
  });
});
