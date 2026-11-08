import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  landingPath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims: m.getClaims } }) }));
vi.mock("@/lib/profiles", () => ({ landingPath: m.landingPath }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("./CompleteProfileForm", () => ({ CompleteProfileForm: () => <form /> }));

import CompleteProfilePage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  m.getClaims.mockResolvedValue({ data: { claims: { sub: "u1", email: "player@example.com" } } });
  m.landingPath.mockResolvedValue("/complete-profile");
});

describe("CompleteProfilePage", () => {
  it("asks a signed-in player without a profile for their details", async () => {
    const html = renderToStaticMarkup(await CompleteProfilePage());
    expect(html).toContain("Finish setting up your account");
    expect(html).toContain("Open to US residents aged 18 or over.");
    expect(html).toContain("<form>");
    expect(m.landingPath).toHaveBeenCalledWith(expect.anything(), "u1");
  });

  it("sends a visitor who is not signed in to sign in", async () => {
    m.getClaims.mockResolvedValueOnce({ data: null });
    await expect(CompleteProfilePage()).rejects.toThrow(/^NEXT_REDIRECT \/signin$/);
  });

  it("sends a player who already has a profile home", async () => {
    m.landingPath.mockResolvedValueOnce("/");
    await expect(CompleteProfilePage()).rejects.toThrow(/^NEXT_REDIRECT \/$/);
  });
});
