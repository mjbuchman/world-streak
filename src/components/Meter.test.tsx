// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Meter } from "./Meter";

// The setting is 0 (shown until the deadline, T103); the hidden-window tests switch hours on.
const config = vi.hoisted(() => ({ hideHours: 0 }));
vi.mock("@/config/meter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/meter")>()),
  get METER_HIDE_HOURS() {
    return config.hideHours;
  },
}));

const closesAt = "2026-11-09T00:00:00.000Z";
const open = (over: Record<string, unknown> = {}) => ({
  gameDate: "2026-11-08",
  status: "open",
  passRate: 0.72,
  attempts: 1234,
  threshold: 0.6,
  closesAt,
  streak: { current: 4, best: 9 },
  ...over,
});
const hidden = { gameDate: "2026-11-08", status: "hidden", threshold: 0.6, closesAt, streak: { current: 4, best: 9 } };

let fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>;
let visibility: DocumentVisibilityState = "visible";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** The meter's reading as screen readers get it. */
const reading = () => screen.getByRole("meter").getAttribute("aria-valuetext");

/** Advances fake time and lets the resulting fetches and renders settle. */
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const flush = () => advance(0);

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => void document.dispatchEvent(new Event("visibilitychange")));
}

beforeEach(() => {
  config.hideHours = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-08T18:00:00Z"));
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  fetchSpy = vi.fn<typeof fetch>(async () => json(open()));
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Meter", () => {
  it("shows the pass rate as a half-circle gauge with a tick at the threshold, the gap to the line and the counts", async () => {
    const { container } = render(<Meter />);
    await flush();

    const meter = screen.getByRole("meter", { name: "Today's pass rate" });
    expect(meter.getAttribute("aria-valuenow")).toBe("72");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
    expect(meter.getAttribute("aria-valuetext")).toBe("72% passing · 60% needed · 1,234 attempts");
    expect(screen.getByText("72%")).toBeTruthy();
    expect(screen.getByText("passing right now")).toBeTruthy();
    expect(screen.getByText("12 points above the line")).toBeTruthy();
    expect(screen.getByText("60% needed")).toBeTruthy();
    expect(screen.getByText("1,234 attempts")).toBeTruthy();
    expect(screen.getByText("Today, the whole world")).toBeTruthy();
    expect(container.querySelector("[data-gauge-fill]")?.getAttribute("stroke-dasharray")).toBe("72 100");
    expect(container.querySelector("[data-gauge-tick]")?.getAttribute("transform")).toBe("rotate(108 150 150)");
    expect(screen.getByRole("region", { name: "Today's meter" }).dataset.state).toBe("above");
    // The countdown lives in the page header now (Countdown).
    expect(screen.queryByRole("timer")).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith("/api/meter");
  });

  it.each([
    [0.5, 0.6, "10 points below the line", "below"],
    [0.61, 0.6, "1 point above the line", "above"],
    [0.59, 0.6, "1 point below the line", "below"],
    [0.6, 0.6, "Right on the line", "above"],
    // Compared as shown: 60.4% rounds to the 60% on screen, so it is on the line.
    [0.604, 0.6, "Right on the line", "above"],
    // Also 60% on screen, but the day would break: never "on the line" while below it.
    [0.596, 0.6, "Just below the line", "below"],
  ])("at %d passing with %d needed, says \"%s\" in the %s colours", async (passRate, threshold, verdict, state) => {
    fetchSpy.mockResolvedValue(json(open({ passRate, threshold })));
    render(<Meter />);
    await flush();
    expect(screen.getByText(verdict)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Today's meter" }).dataset.state).toBe(state);
  });

  it("keeps showing the live meter right up to the deadline with the setting at 0", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:59:57Z"));
    render(<Meter />);
    await flush();
    await advance(2_000);
    expect(screen.getByRole("meter")).toBeTruthy();
    expect(screen.queryByText(/hidden/)).toBeNull();
  });

  it("with the setting at 0, shows no hidden message at the deadline while the next day loads", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:59:59Z"));
    fetchSpy.mockResolvedValueOnce(json(open()));
    fetchSpy.mockImplementationOnce(() => new Promise(() => undefined));
    render(<Meter />);
    await flush();
    await advance(1_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("meter")).toBeTruthy();
    expect(screen.queryByText(/hidden/)).toBeNull();
  });

  it("shows the hidden message, with the hours from config, when the endpoint says hidden", async () => {
    config.hideHours = 3;
    fetchSpy.mockResolvedValue(json(hidden));
    render(<Meter />);
    await flush();
    expect(screen.getByText("The meter is hidden for the final 3 hours. The result is revealed at the deadline.")).toBeTruthy();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.queryByText(/passing/)).toBeNull();
  });

  it("hides by its own clock at the window, even before a reply says so", async () => {
    // A cached open reading may still arrive just after 21:00; the meter must not show it.
    config.hideHours = 3;
    vi.setSystemTime(new Date("2026-11-08T20:59:59Z"));
    render(<Meter />);
    await flush();
    expect(screen.getByRole("meter")).toBeTruthy();
    await advance(1_000);
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.getByText(/The meter is hidden for the final 3 hours/)).toBeTruthy();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("says no attempts yet, with the threshold, before anyone has played", async () => {
    fetchSpy.mockResolvedValue(json(open({ passRate: null, attempts: 0 })));
    const { container } = render(<Meter />);
    await flush();
    expect(screen.getByText("No attempts yet")).toBeTruthy();
    expect(screen.getByText("60% needed")).toBeTruthy();
    expect(screen.queryByText(/the line/)).toBeNull();
    expect(screen.queryByText(/attempts?$/)).toBeNull();
    // Screen readers get the same words, threshold included.
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toBe("No attempts yet · 60% needed");
    expect(container.querySelector("[data-gauge-fill]")?.getAttribute("stroke-dasharray")).toBe("0 100");
    expect(screen.getByRole("region", { name: "Today's meter" }).dataset.state).toBe("none");
  });

  it("shows no threshold tick, needed line or verdict before today's game day exists", async () => {
    fetchSpy.mockResolvedValue(json(open({ passRate: 0.7, attempts: 3, threshold: null })));
    const { container } = render(<Meter />);
    await flush();
    expect(screen.getByText("70%")).toBeTruthy();
    expect(container.querySelector("[data-gauge-tick]")).toBeNull();
    expect(screen.queryByText(/needed|the line/)).toBeNull();
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toBe("70% passing · 3 attempts");
    expect(screen.getByRole("region", { name: "Today's meter" }).dataset.state).toBe("none");
  });

  it("says 1 attempt, not 1 attempts", async () => {
    fetchSpy.mockResolvedValue(json(open({ passRate: 1, attempts: 1 })));
    render(<Meter />);
    await flush();
    expect(screen.getByText("1 attempt")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toBe("100% passing · 60% needed · 1 attempt");
  });

  it("animates the arc with the slow motion token, which reduced motion sets to 0 (tokens.css)", () => {
    const css = readFileSync(path.join(import.meta.dirname, "Meter.module.css"), "utf8");
    expect(css).toMatch(/stroke-dasharray var\(--fs-duration-slow\) var\(--fs-ease-out\)/);
  });

  it("moves the arc to each new reading", async () => {
    const { container } = render(<Meter />);
    await flush();
    fetchSpy.mockResolvedValue(json(open({ passRate: 0.41 })));
    await advance(60_000);
    expect(container.querySelector("[data-gauge-fill]")?.getAttribute("stroke-dasharray")).toBe("41 100");
  });

  it("polls every 60 s only while the tab is visible, and fetches at once when it comes back", async () => {
    render(<Meter />);
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await advance(60_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    setVisibility("hidden");
    await advance(180_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    setVisibility("visible");
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    await advance(60_000);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("waits for the tab to become visible before its first fetch", async () => {
    visibility = "hidden";
    render(<Meter />);
    await advance(120_000);
    expect(fetchSpy).not.toHaveBeenCalled();
    setVisibility("visible");
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("shows the latest reading after each poll", async () => {
    render(<Meter />);
    await flush();
    fetchSpy.mockResolvedValue(json(open({ passRate: 0.5, attempts: 2000 })));
    await advance(60_000);
    expect(reading()).toBe("50% passing · 60% needed · 2,000 attempts");
  });

  it("says the meter is unavailable when the first fetch fails, and keeps the last reading after that", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("offline"));
    render(<Meter />);
    await flush();
    expect(screen.getByText("The meter is unavailable right now.")).toBeTruthy();

    await advance(60_000);
    expect(reading()).toBe("72% passing · 60% needed · 1,234 attempts");
    fetchSpy.mockResolvedValueOnce(json({ error: "server-error" }, 500));
    await advance(60_000);
    expect(reading()).toBe("72% passing · 60% needed · 1,234 attempts");
  });

  it("stops polling when it unmounts, and ignores the tab coming back afterwards", async () => {
    const { unmount } = render(<Meter />);
    await flush();
    unmount();
    await advance(180_000);
    setVisibility("hidden");
    setVisibility("visible");
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("says the meter is unavailable when the first reply is an error or malformed", async () => {
    fetchSpy.mockResolvedValueOnce(json({ error: "server-error" }, 500));
    render(<Meter />);
    await flush();
    expect(screen.getByText("The meter is unavailable right now.")).toBeTruthy();
    cleanup();

    const malformedReplies = [
      { status: "open" },
      { status: "closed", closesAt, threshold: 0.6 },
      open({ closesAt: "soon" }),
      open({ attempts: "many" }),
      open({ attempts: -1 }),
      open({ attempts: 1.5 }),
      open({ threshold: "x" }),
      open({ passRate: "x" }),
      null,
    ];
    for (const malformed of malformedReplies) {
      fetchSpy.mockResolvedValueOnce(json(malformed));
      render(<Meter />);
      await flush();
      expect(screen.getByText("The meter is unavailable right now.")).toBeTruthy();
      expect(screen.queryByText(/NaN/)).toBeNull();
      cleanup();
    }
  });

  it("never lets a slow older reply overwrite a newer one", async () => {
    let answerFirst: (response: Response) => void = () => undefined;
    fetchSpy.mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)));
    fetchSpy.mockResolvedValueOnce(json(open({ passRate: 0.5, attempts: 2000 })));
    render(<Meter />);
    await flush();
    // The tab is hidden and shown again before the first reply arrives: a second request goes out.
    setVisibility("hidden");
    setVisibility("visible");
    await flush();
    expect(reading()).toBe("50% passing · 60% needed · 2,000 attempts");

    await act(async () => answerFirst(json(open())));
    expect(reading()).toBe("50% passing · 60% needed · 2,000 attempts");
  });

  it("asks for the next day's reading at the deadline", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:59:59Z"));
    fetchSpy.mockResolvedValueOnce(json(open()));
    fetchSpy.mockResolvedValueOnce(json(open({ gameDate: "2026-11-09", closesAt: "2026-11-10T00:00:00.000Z", passRate: null, attempts: 0 })));
    render(<Meter />);
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await advance(1_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(reading()).toBe("No attempts yet · 60% needed");
  });

  it("reloads once at the deadline while a cached reply still says the past deadline, then polls as usual", async () => {
    // Just after midnight, a CDN may keep answering yesterday's hidden reading for up to a minute.
    vi.setSystemTime(new Date("2026-11-09T00:00:05Z"));
    fetchSpy.mockResolvedValue(json(hidden));
    render(<Meter />);
    await flush();
    // The first load plus exactly one deadline reload, however many seconds tick by.
    await advance(5_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await advance(50_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    await advance(5_000);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("leaves the deadline reload to the tab coming back when the tab is hidden", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:59:59Z"));
    fetchSpy.mockResolvedValue(json(hidden));
    render(<Meter />);
    await flush();
    setVisibility("hidden");
    await advance(10_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("Meter hidden window from config", () => {
  it("names the hours from METER_HIDE_HOURS and hides at that point", async () => {
    config.hideHours = 2;
    // 21:30 is inside a 3-hour window but outside a 2-hour one.
    vi.setSystemTime(new Date("2026-11-08T21:30:00Z"));
    render(<Meter />);
    await flush();
    expect(screen.getByRole("meter")).toBeTruthy();

    fetchSpy.mockResolvedValue(json(hidden));
    await advance(60_000);
    expect(screen.getByText("The meter is hidden for the final 2 hours. The result is revealed at the deadline.")).toBeTruthy();
  });

  it("with the setting at 0, a stale hidden reply names no hours", async () => {
    fetchSpy.mockResolvedValue(json(hidden));
    render(<Meter />);
    await flush();
    expect(screen.getByText("The meter is hidden until the deadline, when the result is revealed.")).toBeTruthy();
  });

  it("says the final hour, not the final 1 hours", async () => {
    config.hideHours = 1;
    fetchSpy.mockResolvedValue(json(hidden));
    render(<Meter />);
    await flush();
    expect(screen.getByText("The meter is hidden for the final hour. The result is revealed at the deadline.")).toBeTruthy();
  });
});
