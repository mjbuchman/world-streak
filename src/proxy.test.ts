import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const updateSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/session", () => ({ updateSession }));

import { config, proxy } from "./proxy";

describe("proxy", () => {
  it("refreshes the session for the request and returns that exact response", async () => {
    const request = new NextRequest("http://localhost:3000/");
    const refreshed = NextResponse.next();
    updateSession.mockResolvedValueOnce(refreshed);
    expect(await proxy(request)).toBe(refreshed);
    expect(updateSession).toHaveBeenCalledWith(request);
  });
});

describe("proxy matcher", () => {
  // Next.js anchors matcher patterns to the whole path.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/signin", "/signup", "/rules", "/api/health", "/api/attempts/start", "/api/meters", "/play/today"])("runs on %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each(["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/logo.png", "/art/tower.svg"])(
    "skips the static file %s",
    (path) => {
      expect(matcher.test(path)).toBe(false);
    },
  );

  // The meter is cached publicly; a session refresh there could put a player's cookie on a shared
  // response (and would cost an Auth round trip on every poll).
  it("skips the public meter", () => {
    expect(matcher.test("/api/meter")).toBe(false);
  });
});
