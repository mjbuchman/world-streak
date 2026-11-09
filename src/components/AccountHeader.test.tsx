import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims } }) }));
vi.mock("@/app/auth/actions", () => ({ signOutAction: async () => {} }));

import { AccountHeader } from "./AccountHeader";

async function renderHeader(): Promise<string> {
  return renderToStaticMarkup(await AccountHeader());
}

beforeEach(() => getClaims.mockReset());

describe("AccountHeader", () => {
  it("offers sign-in when there is no session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const html = await renderHeader();
    expect(html).toContain('href="/signin"');
    expect(html).toContain(">Sign in<");
    expect(html).not.toContain("Sign out");
  });

  it("shows the account's initial, the email and a sign-out button for a verified session", async () => {
    getClaims.mockResolvedValue({ data: { claims: { email: "player@example.com" } }, error: null });
    const html = await renderHeader();
    expect(html).toContain("player@example.com");
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>P<\/span>/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
    expect(html).not.toContain('href="/signin"');
  });

  it("treats a token that fails verification as signed out", async () => {
    getClaims.mockResolvedValue({ data: null, error: { message: "invalid JWT" } });
    const html = await renderHeader();
    expect(html).toContain(">Sign in<");
    expect(html).not.toContain("Sign out");
  });

  it("links the game name home, as a wordmark with the last word picked out", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const html = await renderHeader();
    const home = /<a ([^>]*)>/.exec(html)![1];
    expect(home).toContain('href="/"');
    expect(home).toContain('aria-label="World Streak"');
    expect(html).toMatch(/world<span class="[^"]*">streak<\/span>/);
  });
});
