// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUNTDOWN_STEP_MS, FlashCountGame } from "./FlashCountGame";

const params = {
  dotCount: 2,
  flashMs: 1000,
  dots: [
    { x: 0.5, y: 0.5, r: 0.02 },
    { x: 0.2, y: 0.2, r: 0.02 },
  ],
};

let frames: FrameRequestCallback[];
let ctx: { arc: ReturnType<typeof vi.fn> } & Record<string, unknown>;

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  ctx = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillStyle: "" };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 300, height: 300 } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs the next animation frame at `now` ms (React reads the clock too, so the value holds). */
function frameAt(now: number) {
  vi.spyOn(performance, "now").mockReturnValue(now);
  const next = frames.shift();
  if (!next) throw new Error("No frame was requested");
  act(() => next(now));
}

const canvas = () => document.querySelector("canvas")!;

describe("FlashCountGame countdown (T119)", () => {
  const countdown = () => document.querySelector("[data-countdown]");

  it("counts 3, 2, 1 by elapsed time, then flashes the dots for the whole flash", () => {
    render(<FlashCountGame params={params} onFinish={vi.fn()} />);
    frameAt(1000);
    expect(canvas().dataset.showing).toBe("countdown");
    expect(countdown()?.textContent).toBe("3");
    expect(canvas().getAttribute("aria-label")).toBe("Get ready.");
    frameAt(1000 + COUNTDOWN_STEP_MS);
    expect(countdown()?.textContent).toBe("2");
    frameAt(1000 + 3 * COUNTDOWN_STEP_MS - 1);
    expect(countdown()?.textContent).toBe("1");
    // No dot is drawn before the countdown ends.
    expect(ctx.arc).not.toHaveBeenCalled();

    frameAt(1000 + 3 * COUNTDOWN_STEP_MS);
    expect(canvas().dataset.showing).toBe("dots");
    expect(countdown()).toBeNull();
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    // The flash is as long as ever, counted from the end of the countdown.
    frameAt(1000 + 3 * COUNTDOWN_STEP_MS + params.flashMs - 1);
    expect(canvas().dataset.showing).toBe("dots");
    frameAt(1000 + 3 * COUNTDOWN_STEP_MS + params.flashMs);
    expect(canvas().dataset.showing).toBe("clear");
  });

  it("gives the whole flash even when a slow frame lands past the end of the countdown", () => {
    render(<FlashCountGame params={params} onFinish={vi.fn()} />);
    frameAt(1000);
    // The dots first show 300 ms late; the flash counts from then.
    const first = 1000 + 3 * COUNTDOWN_STEP_MS + 300;
    frameAt(first);
    expect(canvas().dataset.showing).toBe("dots");
    frameAt(first + params.flashMs - 1);
    expect(canvas().dataset.showing).toBe("dots");
    frameAt(first + params.flashMs);
    expect(canvas().dataset.showing).toBe("clear");
  });

  it("starts the countdown again at 3 if the tab is hidden during it", () => {
    let hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    render(<FlashCountGame params={params} onFinish={vi.fn()} />);
    frameAt(1000);
    frameAt(1000 + COUNTDOWN_STEP_MS);
    expect(countdown()?.textContent).toBe("2");
    hidden = true;
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    hidden = false;
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    frameAt(9000);
    expect(countdown()?.textContent).toBe("3");
  });
});

describe("FlashCountGame", () => {
  it("draws nothing until the first frame after it is on screen", () => {
    render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
    expect(ctx.arc).not.toHaveBeenCalled();
    frameAt(1000);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(canvas().dataset.showing).toBe("dots");
  });

  it("clears the dots by elapsed time, not by frames, then asks for the count", () => {
    render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
    frameAt(1000);
    // Many frames, but under a second: still shown.
    for (const now of [1016, 1033, 1500, 1999]) frameAt(now);
    expect(canvas().dataset.showing).toBe("dots");
    expect(screen.queryByRole("textbox")).toBeNull();
    // A single late frame at 2,000 ms clears them however few frames ran.
    frameAt(2000);
    expect(canvas().dataset.showing).toBe("clear");
    expect(screen.getByRole("textbox", { name: "How many dots were there?" }).getAttribute("inputmode")).toBe("numeric");
    expect(frames).toHaveLength(0);
  });

  it("clears after one long frame too (a slow device still sees the dots for about flashMs)", () => {
    render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
    frameAt(1000);
    frameAt(2400);
    expect(canvas().dataset.showing).toBe("clear");
  });

  it("reports the entered count", async () => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<FlashCountGame params={params} countdownMs={0} onFinish={onFinish} />);
    frameAt(1000);
    frameAt(2000);
    const input = screen.getByRole("textbox", { name: "How many dots were there?" });
    expect(document.activeElement).toBe(input);
    await user.type(input, "20");
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({ count: 20 });
  });

  it("takes at most three digits", () => {
    render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
    frameAt(1000);
    frameAt(2000);
    expect(screen.getByRole("textbox").getAttribute("maxlength")).toBe("3");
  });

  it.each(["", "abc", "2.5", "-3", "1e3"])("refuses %j with a message, reporting nothing", async (typed) => {
    const onFinish = vi.fn();
    const user = userEvent.setup();
    render(<FlashCountGame params={params} countdownMs={0} onFinish={onFinish} />);
    frameAt(1000);
    frameAt(2000);
    if (typed) await user.type(screen.getByRole("textbox"), typed);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a whole number from 0 to 999.")).toBeTruthy();
  });

  it("stops its frames when it leaves the screen", () => {
    const { unmount } = render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  describe("when the tab is hidden", () => {
    let hidden: boolean;
    beforeEach(() => {
      hidden = false;
      vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    });
    const setHidden = (value: boolean) => {
      hidden = value;
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
    };

    it("shows the dots again in full when the tab returns, if it was hidden while they were shown", () => {
      render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
      frameAt(1000);
      frameAt(1900);
      setHidden(true);
      setHidden(false);
      // Long after the original flash ended: the dots come back for a whole flashMs.
      frameAt(5000);
      expect(canvas().dataset.showing).toBe("dots");
      frameAt(5999);
      expect(canvas().dataset.showing).toBe("dots");
      frameAt(6000);
      expect(canvas().dataset.showing).toBe("clear");
    });

    it("does not count a frame that runs while the tab is hidden as the start of the flash", () => {
      render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
      frameAt(1000);
      setHidden(true);
      frameAt(1100);
      expect(canvas().dataset.showing).toBe("dots");
      setHidden(false);
      frameAt(5000);
      frameAt(5999);
      expect(canvas().dataset.showing).toBe("dots");
      frameAt(6000);
      expect(canvas().dataset.showing).toBe("clear");
    });

    it("changes nothing once the dots have cleared", () => {
      render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
      frameAt(1000);
      frameAt(2000);
      setHidden(true);
      setHidden(false);
      expect(canvas().dataset.showing).toBe("clear");
      expect(screen.getByRole("textbox")).toBeTruthy();
      expect(frames).toHaveLength(0);
    });

    it("stops listening when it leaves the screen", () => {
      const remove = vi.spyOn(document, "removeEventListener");
      const { unmount } = render(<FlashCountGame params={params} countdownMs={0} onFinish={vi.fn()} />);
      unmount();
      expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    });
  });
});
