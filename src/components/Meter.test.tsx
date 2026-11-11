// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Meter } from "./Meter";

const closesAt = "2026-11-09T00:00:00.000Z";
const open = (over: Record<string, unknown> = {}) => ({
  gameDate: "2026-11-08",
  status: "open",
  passRate: 0.72,
  attempts: 1234,
  threshold: 0.6,
  closesAt,
  streak: null,
  ...over,
});
const hidden = { gameDate: "2026-11-08", status: "hidden", threshold: 0.6, closesAt };

let fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>;
let visibility: DocumentVisibilityState = "visible";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Advances fake time and lets the resulting fetches and renders settle. */
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const flush = () => advance(0);

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => void document.dispatchEvent(new Event("visibilitychange")));
}

beforeEach(() => {
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
  it("shows the pass rate as a bar with a marker at the threshold, a label and a countdown", async () => {
    const { container } = render(<Meter />);
    await flush();

    const meter = screen.getByRole("meter", { name: "Today's pass rate" });
    expect(meter.getAttribute("aria-valuenow")).toBe("72");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
    expect(screen.getByText("72% passing · 60% needed · 1,234 attempts")).toBeTruthy();
    expect((container.querySelector("[data-meter-fill]") as HTMLElement).style.width).toBe("72%");
    expect((container.querySelector("[data-meter-marker]") as HTMLElement).style.left).toBe("60%");
    expect(screen.getByRole("timer").textContent).toBe("Closes in 6:00:00");
    expect(fetchSpy).toHaveBeenCalledWith("/api/meter");
  });

  it("counts down every second", async () => {
    render(<Meter />);
    await flush();
    await advance(1_000);
    expect(screen.getByRole("timer").textContent).toBe("Closes in 5:59:59");
  });

  it("shows the hidden message, with the hours from config, when the endpoint says hidden", async () => {
    fetchSpy.mockResolvedValue(json(hidden));
    render(<Meter />);
    await flush();
    expect(screen.getByText("The meter is hidden for the final 3 hours. The result is revealed at the deadline.")).toBeTruthy();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.queryByText(/passing/)).toBeNull();
    expect(screen.getByRole("timer").textContent).toBe("Closes in 6:00:00");
  });

  it("hides by its own clock at the window, even before a reply says so", async () => {
    // A cached open reading may still arrive just after 21:00; the meter must not show it.
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
    expect(screen.getByText("No attempts yet · 60% needed")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuetext")).toBe("No attempts yet");
    expect((container.querySelector("[data-meter-fill]") as HTMLElement).style.width).toBe("0%");
  });

  it("shows no threshold marker before today's game day exists", async () => {
    fetchSpy.mockResolvedValue(json(open({ passRate: null, attempts: 0, threshold: null })));
    const { container } = render(<Meter />);
    await flush();
    expect(screen.getByText("No attempts yet")).toBeTruthy();
    expect(container.querySelector("[data-meter-marker]")).toBeNull();
  });

  it("says 1 attempt, not 1 attempts", async () => {
    fetchSpy.mockResolvedValue(json(open({ passRate: 1, attempts: 1 })));
    render(<Meter />);
    await flush();
    expect(screen.getByText("100% passing · 60% needed · 1 attempt")).toBeTruthy();
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
    expect(screen.getByText("50% passing · 60% needed · 2,000 attempts")).toBeTruthy();
  });

  it("says the meter is unavailable when the first fetch fails, and keeps the last reading after that", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("offline"));
    render(<Meter />);
    await flush();
    expect(screen.getByText("The meter is unavailable right now.")).toBeTruthy();

    await advance(60_000);
    expect(screen.getByText("72% passing · 60% needed · 1,234 attempts")).toBeTruthy();
    fetchSpy.mockResolvedValueOnce(json({ error: "server-error" }, 500));
    await advance(60_000);
    expect(screen.getByText("72% passing · 60% needed · 1,234 attempts")).toBeTruthy();
  });

  it("stops polling when it unmounts", async () => {
    const { unmount } = render(<Meter />);
    await flush();
    unmount();
    await advance(180_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
