// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import PlayError from "./error";

afterEach(() => {
  cleanup();
  refresh.mockReset();
});

describe("/play error page", () => {
  it("says calmly that the challenge could not be loaded", () => {
    render(<PlayError error={new Error("db down")} reset={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toBe("Today's challenge could not be loaded. Your attempt is safe. Please try again.");
    // Never the error's own text, which may hold server details.
    expect(document.body.textContent).not.toContain("db down");
  });

  it("reloads the page's server data and re-renders it", async () => {
    const reset = vi.fn();
    render(<PlayError error={new Error("db down")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
