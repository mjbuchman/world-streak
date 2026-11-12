// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getSession: vi.fn(), signOutAction: vi.fn(), pathname: "/" }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ auth: { getSession: m.getSession } }) }));
vi.mock("@/app/auth/actions", () => ({ signOutAction: m.signOutAction }));
vi.mock("next/navigation", () => ({ usePathname: () => m.pathname }));

import { AccountStatus } from "./AccountStatus";

const session = (email: string) => ({ data: { session: { user: { email } } }, error: null });
const noSession = { data: { session: null }, error: null };

beforeEach(() => {
  m.pathname = "/";
  m.getSession.mockReset();
  m.signOutAction.mockReset();
});
afterEach(cleanup);

describe("AccountStatus", () => {
  it("shows neither state until the session is known, so the header never flashes the wrong one", () => {
    m.getSession.mockReturnValue(new Promise(() => {}));
    render(<AccountStatus />);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("offers sign-in when there is no session", async () => {
    m.getSession.mockResolvedValue(noSession);
    render(<AccountStatus />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveProperty("pathname", "/signin");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("shows the initial, the email and a sign-out button for a session", async () => {
    m.getSession.mockResolvedValue(session("player@example.com"));
    const { container } = render(<AccountStatus />);
    expect(await screen.findByRole("button", { name: "Sign out" })).toHaveProperty("type", "submit");
    expect(container.textContent).toContain("player@example.com");
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("P");
  });

  it("treats a failed session read as signed out", async () => {
    m.getSession.mockRejectedValue(new Error("no Supabase"));
    render(<AccountStatus />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
  });

  it("reads the session again after a navigation, so a sign-in shows without a reload", async () => {
    m.getSession.mockResolvedValueOnce(noSession).mockResolvedValueOnce(session("player@example.com"));
    const { rerender } = render(<AccountStatus />);
    await screen.findByRole("link", { name: "Sign in" });
    m.pathname = "/play";
    rerender(<AccountStatus />);
    expect(await screen.findByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(m.getSession).toHaveBeenCalledTimes(2);
  });

  it("signs out through the server action and shows sign-in at once, even when already home", async () => {
    m.getSession.mockResolvedValue(session("player@example.com"));
    m.signOutAction.mockResolvedValue(undefined);
    render(<AccountStatus />);
    const signOut = await screen.findByRole("button", { name: "Sign out" });
    await userEvent.setup().click(signOut);
    await vi.waitFor(() => expect(m.signOutAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
  });
});
