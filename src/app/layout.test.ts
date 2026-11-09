import { afterEach, describe, expect, it, vi } from "vitest";

// The header reads the Supabase session and is tested on its own.
vi.mock("@/components/AccountHeader", () => ({ AccountHeader: () => null }));

// next/font only works inside the Next.js compiler, so stand it in with a fixed class name.
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "font-variable" });
  return { Roboto_Flex: font, Bricolage_Grotesque: font };
});

afterEach(() => {
  vi.doUnmock("@/config/game");
  vi.resetModules();
});

describe("root layout metadata", () => {
  it("uses GAME_NAME as the page title", async () => {
    const { GAME_NAME } = await import("@/config/game");
    const { metadata } = await import("./layout");
    expect(GAME_NAME).toBe("World Streak");
    expect(metadata.title).toBe(GAME_NAME);
  });

  it("follows the constants when the name or pitch changes", async () => {
    vi.resetModules();
    vi.doMock("@/config/game", () => ({ GAME_NAME: "Renamed Game", GAME_PITCH: "A new pitch." }));
    const { metadata } = await import("./layout");
    expect(metadata.title).toBe("Renamed Game");
    expect(metadata.description).toBe("A new pitch.");
  });
});
