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

const day = { gameDate: "2026-11-12", label: "Nov 12, 2026", challenge: "Teetering Tower", passTarget: 10, thresholdPercent: 60 };

function renderRow() {
  render(
    <table>
      <tbody>
        <GameDayEditRow day={day} />
      </tbody>
    </table>,
  );
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
      passTarget: "10",
      thresholdPercent: "55",
    });
    expect((await screen.findByRole("status")).textContent).toBe("Saved Nov 12, 2026.");
  });

  it("shows a refusal from the server", async () => {
    saveGameDayAction.mockResolvedValue({ ok: false, message: "Survival threshold must be from 0% to 100%." });
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("status")).textContent).toBe("Survival threshold must be from 0% to 100%.");
  });
});
