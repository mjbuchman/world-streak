// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MeterBody } from "@/lib/meter";
import { buildShareText } from "@/lib/share";
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

// The wording is share.test.ts's job (emojis may appear only under src/lib/share); this checks
// that the card builds it from the right inputs.
const expectedText = buildShareText({
  passed: true,
  gameDate: "2026-11-12",
  streak: 3,
  meter: meter as MeterBody,
  siteUrl: "http://localhost:3000",
});

/** The text the card hands to the share sheet. */
async function sharedText(props: { passed: boolean; siteUrl?: string; now?: Date }) {
  const user = setUpUser();
  render(<ShareCard {...props} />);
  await user.click(await screen.findByRole("button", { name: "Share" }));
  return (share!.mock.calls[0][0] as { text: string }).text;
}

describe("ShareCard", () => {
  it("is just a Share button: the text is not shown on the page", async () => {
    render(<ShareCard passed siteUrl="http://localhost:3000" />);
    const card = await screen.findByRole("region", { name: "Share your day" });
    expect(card.querySelector("pre")).toBeNull();
    expect(card.textContent).toBe("Share");
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
    expect(document.querySelector("pre")).toBeNull();
  });

  it("shows the text to copy by hand when the copy failed", async () => {
    share = undefined;
    writeText.mockRejectedValue(new Error("denied"));
    const user = setUpUser();
    render(<ShareCard passed siteUrl="http://localhost:3000" />);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Could not copy. Select the text below and copy it.");
    expect(document.querySelector("pre")?.textContent).toBe(expectedText);
  });

  it("copies instead when the share sheet fails for another reason", async () => {
    share = vi.fn(async () => Promise.reject(new DOMException("blocked", "NotAllowedError")));
    const user = setUpUser();
    render(<ShareCard passed siteUrl="http://localhost:3000" />);
    await user.click(await screen.findByRole("button", { name: "Share" }));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(expectedText);
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Copied");
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
    expect((await sharedText({ passed: true })).split("\n").at(-1)).toBe(window.location.origin);
  });

  it("still offers a card for today when the meter cannot be read, without the world's lines", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "down" }, 500)));
    expect(await sharedText({ passed: true, siteUrl: "http://localhost:3000", now: new Date("2026-11-12T10:00:00Z") })).toBe(
      buildShareText({ passed: true, gameDate: "2026-11-12", streak: null, meter: null, siteUrl: "http://localhost:3000" }),
    );
  });
});
