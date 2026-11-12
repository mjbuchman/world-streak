import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getClaims: vi.fn(),
  landingPath: vi.fn(),
  todaysAttempt: vi.fn(),
  todaysChallenge: vi.fn(),
  playToday: vi.fn<(props: unknown) => void>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims: m.getClaims } }) }));
vi.mock("@/lib/profiles", () => ({ landingPath: m.landingPath }));
vi.mock("@/lib/attempts/today", () => ({ todaysAttempt: m.todaysAttempt, todaysChallenge: m.todaysChallenge }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@/components/AdSlot", () => ({ AdSlot: () => null }));
vi.mock("./PlayToday", () => ({
  PlayToday: (props: unknown) => {
    m.playToday(props);
    return <div data-play-today />;
  },
}));

import PlayPage from "./page";

const render = async () => renderToStaticMarkup(await PlayPage());

beforeEach(() => {
  vi.clearAllMocks();
  m.getClaims.mockResolvedValue({ data: { claims: { sub: "u1" } } });
  m.todaysChallenge.mockResolvedValue("stacking");
  m.landingPath.mockResolvedValue("/");
  m.todaysAttempt.mockResolvedValue({ kind: "ready" });
});

describe("PlayPage", () => {
  it("asks a signed-out visitor to sign in, or to practice, without looking up an attempt", async () => {
    m.getClaims.mockResolvedValueOnce({ data: null });
    const html = await render();
    expect(html).toContain("Sign in to play today&#x27;s scored attempt.");
    expect(html).toContain('href="/signin"');
    expect(html).toContain('href="/practice/stacking"');
    expect(m.landingPath).not.toHaveBeenCalled();
    expect(m.todaysAttempt).not.toHaveBeenCalled();
    expect(html).not.toContain("data-play-today");
  });

  it("sends a signed-in player without a profile to complete it, before any attempt lookup", async () => {
    m.landingPath.mockResolvedValueOnce("/complete-profile");
    await expect(PlayPage()).rejects.toThrow(/^NEXT_REDIRECT \/complete-profile$/);
    expect(m.landingPath).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(m.todaysAttempt).not.toHaveBeenCalled();
  });

  it("looks up today's attempt for the player and hands its status to PlayToday", async () => {
    const status = { kind: "submitted", score: 7, passed: false, passTarget: 10 };
    m.todaysAttempt.mockResolvedValueOnce(status);
    const html = await render();
    expect(m.todaysAttempt).toHaveBeenCalledWith(expect.anything(), "u1", expect.any(Date));
    expect(m.playToday).toHaveBeenCalledWith(expect.objectContaining({ challenge: "stacking", initial: status }));
    expect(html).toContain("data-play-today");
  });

  it("lets a failed attempt lookup reach the error page rather than hiding it", async () => {
    m.todaysAttempt.mockRejectedValueOnce(new Error("attempt lookup failed: timeout"));
    await expect(PlayPage()).rejects.toThrow("attempt lookup failed: timeout");
  });
});
