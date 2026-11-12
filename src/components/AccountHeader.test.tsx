import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The header must not read the session on the server: that would make every page dynamic (T130).
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => {
    throw new Error("the header must not read cookies");
  },
}));
vi.mock("./AccountStatus", () => ({ AccountStatus: () => <span data-testid="account" /> }));

import { AccountHeader } from "./AccountHeader";

describe("AccountHeader", () => {
  it("links the game name home, as a wordmark with the last word picked out", () => {
    const html = renderToStaticMarkup(<AccountHeader />);
    const home = /<a ([^>]*)>/.exec(html)![1];
    expect(home).toContain('href="/"');
    expect(home).toContain('aria-label="World Streak"');
    expect(html).toMatch(/world<span class="[^"]*">streak<\/span>/);
  });

  it("leaves the account state to the browser island", () => {
    expect(renderToStaticMarkup(<AccountHeader />)).toContain('data-testid="account"');
  });
});
