// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditState } from "@/lib/adminEdit";

const reviewFlagAction = vi.hoisted(() => vi.fn<(previous: EditState | null, form: FormData) => Promise<EditState>>());
vi.mock("@/app/admin/actions", () => ({ reviewFlagAction }));

import { FlagReviewRow } from "./FlagReviewRow";

afterEach(() => {
  cleanup();
  reviewFlagAction.mockReset();
});

const flag = { id: 7, email: "p@example.com", reason: "timing-mismatch", flagged: "Nov 12, 2026, 10:00 AM", day: "Nov 12, 2026", score: "12" };

function renderRow() {
  render(
    <table>
      <tbody>
        <FlagReviewRow flag={flag} />
      </tbody>
    </table>,
  );
}

describe("FlagReviewRow", () => {
  it("shows the flag's player, reason, time, day and score", () => {
    renderRow();
    expect(screen.getByRole("rowheader").textContent).toBe("p@example.com");
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent).slice(0, 4)).toEqual([
      "timing-mismatch",
      "Nov 12, 2026, 10:00 AM",
      "Nov 12, 2026",
      "12",
    ]);
  });

  it.each([
    ["Dismiss", "dismissed", "Flag dismissed."],
    ["Confirm", "confirmed", "Flag confirmed: the account stays out of the draw."],
  ])("%s sends the flag and the decision, and shows the result", async (button, decision, message) => {
    reviewFlagAction.mockResolvedValue({ ok: true, message });
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: `${button} timing-mismatch for p@example.com` }));
    await vi.waitFor(() => expect(reviewFlagAction).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(reviewFlagAction.mock.calls[0][1])).toEqual({ flagId: "7", decision });
    expect((await screen.findByRole("status")).textContent).toBe(message);
  });
});
