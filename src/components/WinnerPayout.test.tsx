// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditState } from "@/lib/adminEdit";

const markPaidAction = vi.hoisted(() => vi.fn<(previous: EditState | null, form: FormData) => Promise<EditState>>());
vi.mock("@/app/admin/actions", () => ({ markPaidAction }));

import { WinnerPayout } from "./WinnerPayout";

afterEach(() => {
  cleanup();
  markPaidAction.mockReset();
});

const winner = { cycle: 1, email: "w@example.com", verified: false, deadline: "Apr 15, 2027", paidOn: null };

describe("WinnerPayout", () => {
  it("shows the winner, that the email still needs verifying, and the payout deadline", () => {
    render(<WinnerPayout winner={winner} />);
    expect(screen.getByText("w@example.com · Email not verified: verify before paying")).toBeTruthy();
    expect(screen.getByText("Pay by Apr 15, 2027.")).toBeTruthy();
  });

  it("marks the prize paid", async () => {
    markPaidAction.mockResolvedValue({ ok: true, message: "Cycle 1 marked paid." });
    const user = userEvent.setup();
    render(<WinnerPayout winner={winner} />);
    await user.click(screen.getByRole("button", { name: "Mark cycle 1 paid" }));
    await vi.waitFor(() => expect(markPaidAction).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries(markPaidAction.mock.calls[0][1])).toEqual({ cycle: "1" });
    expect((await screen.findByRole("status")).textContent).toBe("Cycle 1 marked paid.");
  });

  it("once paid, says when and offers no button", () => {
    render(<WinnerPayout winner={{ ...winner, verified: true, paidOn: "Mar 20, 2027" }} />);
    expect(screen.getByText("w@example.com · Email verified")).toBeTruthy();
    expect(screen.getByText("Paid on Mar 20, 2027.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
