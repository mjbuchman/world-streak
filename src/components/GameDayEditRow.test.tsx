// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminGame } from "@/lib/admin";
import type { EditState } from "@/lib/adminEdit";

const saveGameDayAction = vi.hoisted(() => vi.fn<(previous: EditState | null, form: FormData) => Promise<EditState>>());
vi.mock("@/app/admin/actions", () => ({ saveGameDayAction }));

import { GameDayEditRow, type EditableDay } from "./GameDayEditRow";

afterEach(() => {
  cleanup();
  saveGameDayAction.mockReset();
});

const games = (started: [boolean, boolean, boolean] = [false, false, false]): AdminGame[] => [
  { position: 1, challengeType: "stacking", passTarget: 10, started: started[0] },
  { position: 2, challengeType: "inner-clock", passTarget: 0.5, started: started[1] },
  { position: 3, challengeType: "flash-count", passTarget: 15, started: started[2] },
];

const day: EditableDay = { gameDate: "2026-11-12", label: "Nov 12, 2026", games: games(), thresholdPercent: 60, started: false };

const inTable = (row: React.ReactNode) => (
  <table>
    <tbody>{row}</tbody>
  </table>
);

const picker = (n: number) => screen.getByRole<HTMLSelectElement>("combobox", { name: `Game ${n} for Nov 12, 2026` });
const target = (n: number) => screen.getByRole<HTMLInputElement>("spinbutton", { name: `Pass target for game ${n} on Nov 12, 2026` });
const threshold = () => screen.getByRole("spinbutton", { name: "Survival threshold in percent for Nov 12, 2026" });
const sent = () => Object.fromEntries(saveGameDayAction.mock.calls[0][1]);

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Save" }));
  await vi.waitFor(() => expect(saveGameDayAction).toHaveBeenCalledTimes(1));
}

describe("GameDayEditRow", () => {
  it("sends the day, its three games with their targets and the threshold, and shows the result", async () => {
    saveGameDayAction.mockResolvedValue({ ok: true, message: "Saved Nov 12, 2026." });
    const user = userEvent.setup();
    render(inTable(<GameDayEditRow day={day} />));
    await user.clear(threshold());
    await user.type(threshold(), "55");
    await save(user);
    expect(sent()).toEqual({
      gameDate: "2026-11-12",
      game1: "stacking",
      game2: "inner-clock",
      game3: "flash-count",
      target1: "10",
      target2: "0.5",
      target3: "15",
      thresholdPercent: "55",
    });
    expect((await screen.findByRole("status")).textContent).toBe("Saved Nov 12, 2026.");
  });

  it("offers every game in each slot of a day nobody has started, and sends a new order", async () => {
    saveGameDayAction.mockResolvedValue({ ok: true, message: "Saved." });
    const user = userEvent.setup();
    render(inTable(<GameDayEditRow day={day} />));
    expect([picker(1).value, picker(2).value, picker(3).value]).toEqual(["stacking", "inner-clock", "flash-count"]);
    expect([...picker(2).options].map((option) => [option.value, option.text])).toEqual([
      ["stacking", "Teetering Tower"],
      ["inner-clock", "Second Sense"],
      ["flash-count", "Swift Sum"],
      ["echo-path", "Echo Path"],
      ["fair-split", "Fair Split"],
    ]);
    await user.selectOptions(picker(1), "inner-clock");
    await user.selectOptions(picker(2), "stacking");
    await user.clear(target(3));
    await user.type(target(3), "20");
    await save(user);
    expect(sent()).toMatchObject({ game1: "inner-clock", game2: "stacking", game3: "flash-count", target3: "20" });
  });

  it("shows the lineup the server now has after a save, not the one picked before (a new game's default target)", () => {
    const { rerender } = render(inTable(<GameDayEditRow day={day} />));
    const changed = games().map((game) => (game.position === 2 ? { ...game, challengeType: "echo-path" as const, passTarget: 6 } : game));
    rerender(inTable(<GameDayEditRow day={{ ...day, games: changed }} />));
    expect(picker(2).value).toBe("echo-path");
    expect(target(2).value).toBe("6");
  });

  it("locks a started day's games and a started game's target, and still sends them unchanged", async () => {
    saveGameDayAction.mockResolvedValue({ ok: true, message: "Saved Nov 12, 2026." });
    const user = userEvent.setup();
    render(inTable(<GameDayEditRow day={{ ...day, started: true, games: games([true, true, false]) }} />));
    expect(screen.queryByRole("combobox")).toBeNull();
    // Only the unstarted game's target and the threshold stay editable.
    expect(screen.getAllByRole("spinbutton")).toEqual([target(3), threshold()]);
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual([
      "Teetering TowerTarget 10Locked: players have started this game.",
      "Second SenseTarget 0.5Locked: players have started this game.",
      "Swift Sum",
    ]);

    await user.clear(threshold());
    await user.type(threshold(), "50");
    await save(user);
    // The unchanged values go along, so the save's checks and the database see the whole lineup.
    expect(sent()).toEqual({
      gameDate: "2026-11-12",
      game1: "stacking",
      game2: "inner-clock",
      game3: "flash-count",
      target1: "10",
      target2: "0.5",
      target3: "15",
      thresholdPercent: "50",
    });
  });

  it("shows a refusal from the server", async () => {
    saveGameDayAction.mockResolvedValue({ ok: false, message: "Pick three different games." });
    const user = userEvent.setup();
    render(inTable(<GameDayEditRow day={day} />));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("status")).textContent).toBe("Pick three different games.");
  });
});
