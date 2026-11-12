// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareCard } from "./ShareCard";

const meter = {
  gameDate: "2026-11-12",
  status: "open",
  passRate: 0.63,
  attempts: 50,
  threshold: 0.6,
  closesAt: "2026-11-13T00:00:00.000Z",
  streak: { current: 3, best: 9 },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

let share: ReturnType<typeof vi.fn> | undefined;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => json(meter)));
  share = vi.fn(async () => undefined);
  writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "share", { configurable: true, get: () => share });
});

/** user-event puts its own clipboard on navigator, so the mock goes in after it is set up. */
function setUpUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => ({ writeText }) });
  return user;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const expectedText = [
  "World Streak · Nov 12, 2026",
  "I passed today's challenge.",
  "World streak: 3 days.",
  "The world is close to the line at 63%. We need you: play before the deadline!",
  "http://localhost:3000",
].join("\n");

describe("ShareCard", () => {
  it("shows the share text built from today's meter, and nothing about the score", async () => {
    render(<ShareCard passed siteUrl="http://localhost:3000" />);
    const card = await screen.findByRole("region", { name: "Share your day" });
    expect(card.querySelector("pre")?.textContent).toBe(expectedText);
    expect(fetch).toHaveBeenCalledWith("/api/meter");
  });

  it("shares with the device's share sheet when there is one", async () => {
    const user = setUpUser();
    render(<ShareCard passed siteUrl="http://localhost:3000" />);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledExactlyOnceWith({ text: expectedText });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the text and says so when the device cannot share", async () => {
    share = undefined;
    const user = setUpUser();
    render(<ShareCard passed={false} siteUrl="http://localhost:3000" />);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("I didn't make it today."));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Copied");
  });

  it("says when the copy failed", async () => {
    share = undefined;
    writeText.mockRejectedValue(new Error("denied"));
    const user = setUpUser();
    render(<ShareCard passed siteUrl="http://localhost:3000" />);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Could not copy. Select the text and copy it.");
  });

  it("stays quiet when the player closes the share sheet", async () => {
    share = vi.fn(async () => Promise.reject(new DOMException("cancelled", "AbortError")));
    const user = setUpUser();
    render(<ShareCard passed siteUrl="http://localhost:3000" />);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("links to this site's own address when no site URL is set", async () => {
    render(<ShareCard passed />);
    const card = await screen.findByRole("region", { name: "Share your day" });
    expect(card.querySelector("pre")?.textContent?.split("\n").at(-1)).toBe(window.location.origin);
  });

  it("still offers a card for today when the meter cannot be read, without the world's line", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "down" }, 500)));
    render(<ShareCard passed siteUrl="http://localhost:3000" now={new Date("2026-11-12T10:00:00Z")} />);
    const card = await screen.findByRole("region", { name: "Share your day" });
    expect(card.querySelector("pre")?.textContent).toBe(
      ["World Streak · Nov 12, 2026", "I passed today's challenge.", "http://localhost:3000"].join("\n"),
    );
  });
});
