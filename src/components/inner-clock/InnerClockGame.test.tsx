// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InnerClockGame, targetLabel } from "./InnerClockGame";

const params = { targetMs: 5000, timeoutMs: 15_000 };

// The game starts its clock in the first frame after it is on screen; tests run that frame.
let frame: FrameRequestCallback | null;
const clock = () => vi.spyOn(performance, "now");

beforeEach(() => {
  frame = null;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tapArea = () => screen.getByRole("button", { name: /Tap when you think 5 seconds have passed/ });
const showStart = () => act(() => frame!(0));

describe("InnerClockGame", () => {
  it("reports the tap in ms from the moment the start was on screen", () => {
    const onFinish = vi.fn();
    render(<InnerClockGame params={params} onFinish={onFinish} />);
    // React reads the clock too, so each value holds until the next step rather than once.
    clock().mockReturnValue(1000);
    showStart();
    clock().mockReturnValue(6320);
    fireEvent.pointerDown(tapArea());
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ tapMs: 5320 });
  });

  it("takes Space as a tap too, once, and ignores a held key's repeats", () => {
    const onFinish = vi.fn();
    render(<InnerClockGame params={params} onFinish={onFinish} />);
    clock().mockReturnValue(1000);
    showStart();
    clock().mockReturnValue(4000);
    fireEvent.keyDown(tapArea(), { key: " ", repeat: true });
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.keyDown(tapArea(), { key: " " });
    fireEvent.pointerDown(tapArea());
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ tapMs: 3000 });
  });

  it("ignores other keys", () => {
    const onFinish = vi.fn();
    render(<InnerClockGame params={params} onFinish={onFinish} />);
    showStart();
    fireEvent.keyDown(tapArea(), { key: "a" });
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.keyDown(tapArea(), { key: "Enter" });
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("reports no tap at the timeout, counted from the start on screen", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const onFinish = vi.fn();
    render(<InnerClockGame params={params} onFinish={onFinish} />);
    await act(async () => void (await vi.advanceTimersByTimeAsync(20_000)));
    expect(onFinish).not.toHaveBeenCalled();
    showStart();
    await act(async () => void (await vi.advanceTimersByTimeAsync(14_999)));
    expect(onFinish).not.toHaveBeenCalled();
    await act(async () => void (await vi.advanceTimersByTimeAsync(1)));
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ tapMs: null });
    // A tap after the timeout is too late to count.
    fireEvent.pointerDown(tapArea());
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("ignores a right-click", () => {
    const onFinish = vi.fn();
    render(<InnerClockGame params={params} onFinish={onFinish} />);
    showStart();
    fireEvent.pointerDown(tapArea(), { button: 2 });
    expect(onFinish).not.toHaveBeenCalled();
    fireEvent.pointerDown(tapArea(), { button: 0 });
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("ignores a tap before the start is on screen", () => {
    const onFinish = vi.fn();
    render(<InnerClockGame params={params} onFinish={onFinish} />);
    fireEvent.pointerDown(tapArea());
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("shows a running clock from the start for the first second, then hides it", () => {
    render(<InnerClockGame params={params} onFinish={vi.fn()} />);
    const shownClock = () => document.querySelector("[data-clock]");
    // Before the start frame, the clock waits at zero.
    expect(shownClock()?.textContent).toBe("0.0");
    clock().mockReturnValue(1000);
    showStart();
    expect(shownClock()?.textContent).toBe("0.0");
    clock().mockReturnValue(1540);
    act(() => frame!(0));
    expect(shownClock()?.textContent).toBe("0.5");
    clock().mockReturnValue(1999);
    act(() => frame!(0));
    expect(shownClock()?.textContent).toBe("0.9");
    expect(shownClock()?.getAttribute("data-clock")).toBe("shown");
    clock().mockReturnValue(2000);
    act(() => frame!(0));
    expect(shownClock()?.getAttribute("data-clock")).toBe("hidden");
    expect(shownClock()?.textContent).toBe("");
  });

  it("shows the instruction and nothing that tells the time once the clock has hidden", () => {
    render(<InnerClockGame params={params} onFinish={vi.fn()} />);
    clock().mockReturnValue(1000);
    showStart();
    clock().mockReturnValue(2000);
    act(() => frame!(0));
    expect(tapArea()).toBeTruthy();
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+(\.\d+)?\s*s\b|\d:\d\d|\d\.\d/);
  });

  it("keeps the shown clock out of the tap area's name, so it is announced once, not every frame", () => {
    render(<InnerClockGame params={params} onFinish={vi.fn()} />);
    expect(screen.getByRole("button").getAttribute("aria-hidden")).toBeNull();
    expect(document.querySelector("[data-clock]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("puts focus on the tap area, so Space works at once", () => {
    render(<InnerClockGame params={params} onFinish={vi.fn()} />);
    expect(document.activeElement).toBe(tapArea());
  });

  it("stops its clock when it leaves the screen", () => {
    const { unmount } = render(<InnerClockGame params={params} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});

describe("targetLabel", () => {
  it.each([
    [5000, "5 seconds"],
    [3400, "3.4 seconds"],
    [1000, "1 second"],
  ])("says %i ms as %s", (ms, label) => {
    expect(targetLabel(ms)).toBe(label);
  });
});
