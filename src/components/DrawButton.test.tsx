// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditState } from "@/lib/adminEdit";

const drawCycleAction = vi.hoisted(() => vi.fn<(previous: EditState | null, form: FormData) => Promise<EditState>>());
vi.mock("@/app/admin/actions", () => ({ drawCycleAction }));

import { DrawButton } from "./DrawButton";

afterEach(() => {
  cleanup();
  drawCycleAction.mockReset();
});

describe("DrawButton", () => {
  it("draws the cycle and shows the result", async () => {
    drawCycleAction.mockResolvedValue({ ok: true, message: "Cycle 1 drawn." });
    const user = userEvent.setup();
    render(<DrawButton cycle={1} ready reason="" />);
    await user.click(screen.getByRole("button", { name: "Draw cycle 1" }));
    await vi.waitFor(() => expect(drawCycleAction).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(drawCycleAction.mock.calls[0][1])).toEqual({ cycle: "1" });
    expect((await screen.findByRole("status")).textContent).toBe("Cycle 1 drawn.");
  });

  it("is disabled, with the reason, until the cycle may be drawn", () => {
    render(<DrawButton cycle={2} ready={false} reason="Goal not reached yet." />);
    expect(screen.getByRole("button", { name: "Draw cycle 2" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Goal not reached yet.")).toBeTruthy();
  });
});
