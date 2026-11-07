import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/app/auth/actions", () => ({ signOutAction: async () => {} }));

import { AccountHeader } from "./AccountHeader";

async function renderHeader(): Promise<string> {
  return renderToStaticMarkup(await AccountHeader());
}

beforeEach(() => getUser.mockReset());

describe("AccountHeader", () => {
  it("offers sign-in when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const html = await renderHeader();
    expect(html).toContain('href="/signin"');
    expect(html).toContain(">Sign in<");
    expect(html).not.toContain("Sign out");
  });

  it("shows the email and a sign-out button when signed in", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "player@example.com" } }, error: null });
    const html = await renderHeader();
    expect(html).toContain("player@example.com");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
    expect(html).not.toContain('href="/signin"');
  });

  it("treats an auth error as signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing!" } });
    expect(await renderHeader()).toContain(">Sign in<");
  });

  it("links the game name home", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await renderHeader()).toMatch(/<a[^>]*href="\/"[^>]*>World Streak<\/a>/);
  });
});
