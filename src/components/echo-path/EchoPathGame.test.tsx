// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EchoPathParams } from "@/challenges/echo-path/engine";
import { RUN_COUNTDOWN_MS } from "@/config/countdown";
import { BETWEEN_MS, EchoPathGame } from "./EchoPathGame";

// A 6-tile path straight up the middle column, from a start of 4: playbacks of 1200, 1500 and 1800 ms.
const PATH = [2, 7, 12, 17, 22, 27];
const params: EchoPathParams = { cols: 5, rows: 8, path: PATH, startLength: 4, stepMs: 300 };
/** Never on the path. */
const WRONG = 0;

let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const ctx = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: "", globalAlpha: 1 };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  // A 280 x 445 px 5 x 8 board at the page's top left: tiles of 50 px, 5 px apart.
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 280, height: 445 } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let clock = 0;
/** Runs the next animation frame at `now` ms (React reads the clock too, so the value holds). */
function frameAt(now: number) {
  clock = now;
  vi.spyOn(performance, "now").mockReturnValue(now);
  const next = frames.shift();
  if (!next) throw new Error("No frame was requested");
  act(() => next(now));
}

/** A tile's centre on the board, where row 0 is at the bottom. */
const centre = (tile: number) => ({ clientX: 30 + (tile % 5) * 55, clientY: 30 + (7 - Math.floor(tile / 5)) * 55 });

/** Taps a tile's centre at the current clock. */
function tapTile(tile: number) {
  vi.spyOn(performance, "now").mockReturnValue(clock);
  fireEvent.pointerDown(canvas(), { button: 0, ...centre(tile) });
}
const tapAll = (tiles: number[]) => tiles.forEach(tapTile);
const key = (name: string, repeat = false) => fireEvent.keyDown(canvas(), { key: name, repeat });

const canvas = () => document.querySelector("canvas")!;
const phase = () => canvas().dataset.phase;
const lives = () => screen.getByRole("img", { name: /lives left$/ }).getAttribute("aria-label");
const pathBar = () => screen.getByRole("img", { name: /^Tile \d+ of 6$/ });
const clearedCells = () => pathBar().querySelectorAll("[data-cleared]").length;

describe("EchoPathGame", () => {
  it("counts 3-2-1, plays the first 4 tiles back by elapsed time, and ignores taps until they have played", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame params={params} onFinish={onFinish} />);
    frameAt(1000);
    expect(phase()).toBe("countdown");
    frameAt(1000 + RUN_COUNTDOWN_MS);
    expect(phase()).toBe("watch");
    expect(canvas().getAttribute("aria-label")).toBe("Watch the tiles light up.");
    // A wrong tile during the playback costs nothing: it is ignored.
    tapTile(WRONG);
    expect(lives()).toBe("2 of 2 lives left");
    frameAt(1000 + RUN_COUNTDOWN_MS + 1199);
    expect(phase()).toBe("watch");
    frameAt(1000 + RUN_COUNTDOWN_MS + 1200);
    expect(phase()).toBe("repeat");
    expect(canvas().getAttribute("aria-label")).toBe("Tap the tiles in the same order.");
    expect(lives()).toBe("2 of 2 lives left");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("shows the lives as pips and the path as a bar of one cell a tile, labelled with the tile reached", () => {
    render(<EchoPathGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    expect(screen.getByRole("img", { name: "2 of 2 lives left" }).children).toHaveLength(2);
    expect(pathBar().getAttribute("aria-label")).toBe("Tile 4 of 6");
    expect(pathBar().children).toHaveLength(PATH.length);
    expect(clearedCells()).toBe(0);
    expect(screen.getByText("Tap the tiles, or move with the arrow keys and press Space or Enter.")).toBeTruthy();
  });

  it("adds one tile after each clear, replays the same path after a miss, and finishes at the top", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(0);
    frameAt(1200);
    tapAll(PATH.slice(0, 4));
    expect(pathBar().getAttribute("aria-label")).toBe("Tile 5 of 6");
    expect(clearedCells()).toBe(4);
    // The pause, then the 5-tile playback: a wrong tile in either costs nothing.
    frameAt(1200 + BETWEEN_MS - 1);
    expect(phase()).toBe("watch");
    tapTile(WRONG);
    frameAt(1200 + BETWEEN_MS + 1499);
    tapTile(WRONG);
    expect(lives()).toBe("2 of 2 lives left");
    frameAt(1200 + BETWEEN_MS + 1500);
    expect(phase()).toBe("repeat");
    // A wrong tile part way: a life goes, and the same 5 tiles play again.
    tapAll([...PATH.slice(0, 2), WRONG]);
    expect(lives()).toBe("1 of 2 lives left");
    expect(phase()).toBe("watch");
    expect(pathBar().getAttribute("aria-label")).toBe("Tile 5 of 6");
    frameAt(clock + BETWEEN_MS + 1500);
    tapAll(PATH.slice(0, 5));
    frameAt(clock + BETWEEN_MS + 1800);
    tapAll(PATH);
    // The whole path, to the top: the run ends with every tap.
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish.mock.calls[0][0].taps.map((tap: { tile: number }) => tap.tile)).toEqual([
      ...PATH.slice(0, 4),
      ...PATH.slice(0, 2),
      WRONG,
      ...PATH.slice(0, 5),
      ...PATH,
    ]);
    expect(phase()).toBe("done");
    expect(clearedCells()).toBe(6);
    expect(pathBar().getAttribute("aria-label")).toBe("Tile 6 of 6");
  });

  it("takes the arrow keys to move a ring (up climbs the board) and Space or Enter to tap it", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(0);
    frameAt(1200);
    expect(canvas().tabIndex).toBe(0);
    // The first key only shows the ring, on the bottom row's middle tile (2): it taps nothing.
    key("Enter");
    expect(lives()).toBe("2 of 2 lives left");
    key(" ");
    key("ArrowUp");
    key("Enter");
    key("ArrowUp");
    key(" ");
    // A held key does not tap again, and other keys do nothing.
    key(" ", true);
    key("a");
    key("1");
    expect(lives()).toBe("2 of 2 lives left");
    key("ArrowUp");
    key("Enter");
    expect(clearedCells()).toBe(4);
    frameAt(1200 + BETWEEN_MS + 1500);
    // Left and right move along the row and stop at the edge; down stops at the bottom row.
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowLeft");
    key("ArrowLeft");
    key("ArrowLeft");
    key(" ");
    // Tile 0, the bottom left corner: a wrong first tile.
    expect(lives()).toBe("1 of 2 lives left");
    expect(onFinish.mock.calls).toHaveLength(0);
  });

  it("stops the ring at the top and right edges", () => {
    render(<EchoPathGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    frameAt(0);
    frameAt(1200);
    key("ArrowUp");
    for (let i = 0; i < 10; i++) key("ArrowUp");
    for (let i = 0; i < 4; i++) key("ArrowRight");
    key("Enter");
    // Tile 39, the top right corner of the 5 x 8 board: wrong, so a life goes.
    expect(lives()).toBe("1 of 2 lives left");
  });

  it("gives an 11-tile path a bar of 11 cells, labelled with the tile reached (T208)", () => {
    const eleven = { ...params, path: [0, 1, 6, 12, 17, 18, 23, 27, 32, 33, 38], startLength: 7 };
    render(<EchoPathGame countdownMs={0} params={eleven} onFinish={vi.fn()} />);
    expect(screen.getByRole("img", { name: "Tile 7 of 11" }).children).toHaveLength(11);
  });

  it("reports every tap, timed from the first frame, when the run ends", () => {
    const onFinish = vi.fn();
    render(<EchoPathGame countdownMs={0} params={params} onFinish={onFinish} />);
    frameAt(500);
    frameAt(1700);
    tapTile(WRONG);
    // The miss pauses and replays: wait out the pause and the 4-tile playback.
    frameAt(1700 + BETWEEN_MS + 1200);
    expect(onFinish).not.toHaveBeenCalled();
    tapTile(1);
    expect(onFinish).toHaveBeenCalledExactlyOnceWith({
      taps: [
        { tile: WRONG, atMs: 1200 },
        { tile: 1, atMs: 1200 + BETWEEN_MS + 1200 },
      ],
    });
    expect(phase()).toBe("done");
    expect(lives()).toBe("0 of 2 lives left");
    // No tap counts after the end.
    tapTile(PATH[0]);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("ignores taps in the gaps between tiles and with other buttons", () => {
    render(<EchoPathGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    frameAt(0);
    frameAt(1200);
    // A right-click on a wrong tile costs nothing; one on the right tile does not count as a step.
    fireEvent.pointerDown(canvas(), { button: 2, ...centre(WRONG) });
    fireEvent.pointerDown(canvas(), { button: 2, ...centre(PATH[0]) });
    // The gap between tiles 2 and 3 on the bottom row.
    fireEvent.pointerDown(canvas(), { button: 0, clientX: 167, clientY: centre(PATH[0]).clientY });
    expect(lives()).toBe("2 of 2 lives left");
    // So the path still needs all four taps: starting at its second tile is a miss.
    tapTile(PATH[1]);
    expect(lives()).toBe("1 of 2 lives left");
  });

  it("stops its frame loop when it leaves the screen", () => {
    const { unmount } = render(<EchoPathGame countdownMs={0} params={params} onFinish={vi.fn()} />);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
