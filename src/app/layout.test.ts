import { afterEach, describe, expect, it, vi } from "vitest";

// The header reads the Supabase session and is tested on its own.
vi.mock("@/components/AccountHeader", () => ({ AccountHeader: () => null }));

// next/font only works inside the Next.js compiler, so stand each font in with its own class
// name, recording the CSS variable it was asked for.
const fontCalls = vi.hoisted(() => [] as { family: string; variable: string }[]);
vi.mock("next/font/google", () => {
  const font = (family: string) => (options: { variable: string }) => {
    fontCalls.push({ family, variable: options.variable });
    return { variable: `${family}-class` };
  };
  return { Unbounded: font("unbounded"), Manrope: font("manrope") };
});

afterEach(() => {
  vi.doUnmock("@/config/game");
  vi.resetModules();
});

describe("root layout fonts", () => {
  it("loads Unbounded as the display face and Manrope as the body face, both on <html>", async () => {
    vi.resetModules();
    fontCalls.length = 0;
    const { default: RootLayout } = await import("./layout");
    expect(fontCalls).toEqual([
      { family: "unbounded", variable: "--fs-typeface-display" },
      { family: "manrope", variable: "--fs-typeface-body" },
    ]);
    const html = RootLayout({ children: null } as never) as { props: { className: string } };
    expect(html.props.className.split(" ").sort()).toEqual(["manrope-class", "unbounded-class"]);
  });
});

describe("root layout metadata", () => {
  it("uses GAME_NAME as the page title, and after each page's own part", async () => {
    const { GAME_NAME } = await import("@/config/game");
    const { metadata } = await import("./layout");
    expect(GAME_NAME).toBe("World Streak");
    expect(metadata.title).toEqual({ default: "World Streak", template: "%s | World Streak" });
  });

  it("follows the constants when the name or pitch changes", async () => {
    vi.resetModules();
    vi.doMock("@/config/game", () => ({ GAME_NAME: "Renamed Game", GAME_PITCH: "A new pitch." }));
    const { metadata } = await import("./layout");
    expect(metadata.title).toEqual({ default: "Renamed Game", template: "%s | Renamed Game" });
    expect(metadata.description).toBe("A new pitch.");
  });
});
