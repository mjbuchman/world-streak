import { describe, expect, it, vi } from "vitest";
import {
  CLEARED_MS,
  LIT_SHARE,
  MISS_FLASH_MS,
  TILE_GAP,
  TRAIL_MAX,
  TRAIL_STEPS,
  boardLayout,
  clearedTrail,
  drawEchoPath,
  hitTile,
  litTileAt,
  missStrength,
  playbackMs,
  trailAt,
  type BoardLayout,
  type EchoPathFrame,
} from "./render";

function fakeContext() {
  return { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: "", globalAlpha: 1, styles: [] as string[], alphas: [] as number[] };
}

const colors = { board: "board", tile: "tile", lit: "lit", trail: "trail", pressed: "pressed", miss: "miss", start: "start", finish: "finish", focus: "focus" };
// 5.6 x 8.9 tiles' worth (tiles plus gaps): a 56 x 89 canvas has tiles of exactly 10 px and gaps of 1 px.
const frame = (over: Partial<EchoPathFrame> = {}): EchoPathFrame => ({
  cols: 5,
  rows: 8,
  width: 56,
  height: 89,
  devicePixelRatio: 2,
  lit: null,
  trail: [],
  pressed: null,
  focus: null,
  miss: 0,
  colors,
  ...over,
});

/** Records the fill colour and opacity of every fillRect, in order. */
function draw(over: Partial<EchoPathFrame> = {}) {
  const ctx = fakeContext();
  ctx.fillRect.mockImplementation(() => {
    ctx.styles.push(ctx.fillStyle);
    ctx.alphas.push(ctx.globalAlpha);
  });
  drawEchoPath(ctx as unknown as CanvasRenderingContext2D, frame(over));
  return ctx;
}

/** Every tile's rectangle, to check that none overlap and all sit on the canvas. */
function tileRects(layout: BoardLayout) {
  const pitch = layout.tileSize + layout.gap;
  return Array.from({ length: layout.cols * layout.rows }, (_, tile) => ({
    x: layout.left + layout.gap + (tile % layout.cols) * pitch,
    y: layout.top + layout.gap + (layout.rows - 1 - Math.floor(tile / layout.cols)) * pitch,
  }));
}

describe("boardLayout", () => {
  it.each([
    [390, 480],
    [1280, 720],
  ])("fits the 5 x 8 board into %i x %i, centred, with tiles that do not overlap (T208)", (width, height) => {
    const layout = boardLayout(width, height, 5, 8);
    expect(layout.gap).toBeCloseTo(layout.tileSize * TILE_GAP);
    const boardHeight = 8 * layout.tileSize + 9 * layout.gap;
    const boardWidth = 5 * layout.tileSize + 6 * layout.gap;
    // The height limits a tall board in both: it fills it top to bottom.
    expect(boardHeight).toBeCloseTo(height);
    expect(boardWidth).toBeLessThanOrEqual(width);
    expect(layout.left).toBeCloseTo((width - boardWidth) / 2);
    const rects = tileRects(layout);
    for (const a of rects) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y + layout.tileSize).toBeLessThanOrEqual(height + 1e-9);
      const overlapping = rects.filter((b) => b !== a && Math.abs(a.x - b.x) < layout.tileSize && Math.abs(a.y - b.y) < layout.tileSize);
      expect(overlapping).toEqual([]);
    }
  });

  it("gives tiles of 54 px at 390 x 480 and 81 px at 1 280 x 720", () => {
    expect(boardLayout(390, 480, 5, 8).tileSize).toBeCloseTo(480 / 8.9);
    expect(boardLayout(1280, 720, 5, 8).tileSize).toBeCloseTo(720 / 8.9);
  });

  it("gives tiles of at least 44 x 44 CSS px on a 390 px phone, where the board is 250 px wide", () => {
    // The stage is at most 250 px wide (less on narrower pages), and the canvas keeps the board's shape.
    expect(boardLayout(250, 250 * (8.9 / 5.6), 5, 8).tileSize).toBeGreaterThanOrEqual(44);
  });

  it("is limited by the width on a wide, short board", () => {
    const layout = boardLayout(56, 500, 5, 8);
    expect(layout.tileSize).toBeCloseTo(10);
    expect(layout.left).toBeCloseTo(0);
  });
});

describe("hitTile", () => {
  const layout = boardLayout(56, 89, 5, 8);

  it("numbers tiles from the bottom row up, edges included", () => {
    expect([layout.left, layout.top, layout.tileSize]).toEqual([expect.closeTo(0, 9), expect.closeTo(0, 9), expect.closeTo(10, 9)]);
    // The bottom-left tile (0) starts 1 px in from the left and the bottom.
    expect(hitTile(layout, 1, 78)).toBe(0);
    expect(hitTile(layout, 10.9, 87.9)).toBe(0);
    expect(hitTile(layout, 12, 78)).toBe(1);
    // The top-right tile is the last one.
    expect(hitTile(layout, 45, 1)).toBe(39);
    expect(hitTile(layout, 54.9, 10.9)).toBe(39);
  });

  it("gives null in the gaps and off the board", () => {
    expect(hitTile(layout, 11.5, 78)).toBeNull();
    expect(hitTile(layout, 5, 77.5)).toBeNull();
    expect(hitTile(layout, 0.5, 78)).toBeNull();
    expect(hitTile(layout, -1, 50)).toBeNull();
    expect(hitTile(layout, 55.5, 50)).toBeNull();
    expect(hitTile(layout, 30, 88.5)).toBeNull();
    expect(hitTile(layout, 30, 200)).toBeNull();
  });
});

describe("litTileAt", () => {
  const sequence = [2, 7, 12, 13, 18, 23];

  it("lights each step's tile for LIT_SHARE of the step, from elapsed time only", () => {
    expect(LIT_SHARE).toBe(0.75);
    expect(litTileAt(sequence, 400, 0)).toBe(2);
    expect(litTileAt(sequence, 400, 299)).toBe(2);
    expect(litTileAt(sequence, 400, 300)).toBeNull();
    expect(litTileAt(sequence, 400, 400)).toBe(7);
    expect(litTileAt(sequence, 400, 2100)).toBe(23);
    expect(litTileAt(sequence, 400, 2300)).toBeNull();
  });

  it("lights nothing before the start or after the last step", () => {
    expect(litTileAt(sequence, 400, -1)).toBeNull();
    expect(litTileAt(sequence, 400, playbackMs(6, 400))).toBeNull();
    expect(playbackMs(6, 400)).toBe(2400);
  });
});

describe("trailAt", () => {
  const sequence = [2, 7, 12, 13, 18, 23];

  it("fades each shown tile from TRAIL_MAX over TRAIL_STEPS steps behind the playback", () => {
    expect([TRAIL_MAX, TRAIL_STEPS]).toEqual([0.6, 4]);
    expect(trailAt(sequence, 400, 0, false)).toEqual([]);
    expect(trailAt(sequence, 400, 399, false)).toEqual([]);
    // Step 1 starts: tile 2's step just ended, so it is at full trail strength.
    expect(trailAt(sequence, 400, 400, false)).toEqual([{ tile: 2, strength: 0.6 }]);
    // Step 3 halfway: tile 2 ended 2.5 steps ago, 7 ended 1.5 steps ago, 12 half a step ago.
    const mid = trailAt(sequence, 400, 1400, false);
    expect(mid.map((t) => t.tile)).toEqual([2, 7, 12]);
    expect(mid.map((t) => t.strength)).toEqual([0.6 * (1 - 2.5 / 4), 0.6 * (1 - 1.5 / 4), 0.6 * (1 - 0.5 / 4)].map((s) => expect.closeTo(s, 9)));
    // Step 5: tile 2 ended 4 steps ago and has faded out.
    expect(trailAt(sequence, 400, 2000, false).map((t) => t.tile)).toEqual([7, 12, 13, 18]);
  });

  it("keeps every shown tile at TRAIL_MAX under reduced motion, and shows nothing outside the playback", () => {
    expect(trailAt(sequence, 400, 2000, true)).toEqual([2, 7, 12, 13, 18].map((tile) => ({ tile, strength: 0.6 })));
    expect(trailAt(sequence, 400, -1, false)).toEqual([]);
    expect(trailAt(sequence, 400, 2400, true)).toEqual([]);
  });
});

describe("clearedTrail", () => {
  it("shows the cleared path briefly, fading, or whole under reduced motion", () => {
    expect(CLEARED_MS).toBe(500);
    expect(clearedTrail([2, 7], null, false)).toEqual([]);
    expect(clearedTrail([2, 7], 0, false)).toEqual([{ tile: 2, strength: 1 }, { tile: 7, strength: 1 }]);
    expect(clearedTrail([2, 7], 250, false)).toEqual([{ tile: 2, strength: 0.5 }, { tile: 7, strength: 0.5 }]);
    expect(clearedTrail([2, 7], 499, true)).toEqual([{ tile: 2, strength: 1 }, { tile: 7, strength: 1 }]);
    expect(clearedTrail([2, 7], CLEARED_MS, true)).toEqual([]);
    expect(clearedTrail([2, 7], -1, false)).toEqual([]);
  });
});

describe("missStrength", () => {
  it("fades the miss tint out over MISS_FLASH_MS", () => {
    expect(missStrength(null, false)).toBe(0);
    expect(missStrength(0, false)).toBe(1);
    expect(missStrength(MISS_FLASH_MS / 2, false)).toBe(0.5);
    expect(missStrength(MISS_FLASH_MS, false)).toBe(0);
    expect(missStrength(-1, false)).toBe(0);
  });

  it("holds it whole, without the fade, under reduced motion", () => {
    expect(missStrength(0, true)).toBe(1);
    expect(missStrength(MISS_FLASH_MS - 1, true)).toBe(1);
    expect(missStrength(MISS_FLASH_MS, true)).toBe(0);
  });
});

describe("drawEchoPath", () => {
  it("draws the board, the goal and start marks, then every tile, for the device's pixel ratio", () => {
    const ctx = draw();
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 56, 89);
    expect(ctx.styles).toEqual(["board", "finish", "start", ...Array<string>(40).fill("tile")]);
    const [board, finish, start, bottomLeft] = ctx.fillRect.mock.calls;
    expect(board.map((n) => Number(n.toFixed(6)))).toEqual([0, 0, 56, 89]);
    // The goal mark sits in the gap above the top row, the start mark in the gap below the bottom row.
    expect(finish[1]).toBeGreaterThan(0);
    expect(finish[1] + finish[3]).toBeLessThan(1);
    expect(start[1]).toBeGreaterThan(88);
    expect(start[1] + start[3]).toBeLessThan(89);
    expect(bottomLeft.map((n) => Number(n.toFixed(6)))).toEqual([1, 78, 10, 10]);
  });

  it("shows the lit tile and the pressed tile in their colours, the lit one first", () => {
    const tiles = (ctx: ReturnType<typeof draw>) => ctx.styles.slice(3);
    expect(tiles(draw({ lit: 4, pressed: 2 })).slice(0, 5)).toEqual(["tile", "tile", "pressed", "tile", "lit"]);
    expect(tiles(draw({ lit: 2, pressed: 2 }))[2]).toBe("lit");
  });

  it("lays the trail over its tiles at their strength, never over the lit or pressed tile", () => {
    const ctx = draw({ lit: 7, pressed: 3, trail: [{ tile: 2, strength: 0.3 }, { tile: 7, strength: 0.6 }, { tile: 3, strength: 0.6 }] });
    const tiles = ctx.styles.slice(3);
    expect(tiles.slice(0, 5)).toEqual(["tile", "tile", "tile", "trail", "pressed"]);
    expect(ctx.alphas[3 + 3]).toBe(0.3);
    expect(tiles.filter((style) => style === "trail")).toHaveLength(1);
    expect(ctx.globalAlpha).toBe(1);
  });

  it("rings the keyboard's tile in the gap around it, under the tile", () => {
    const ctx = draw({ focus: 1 });
    expect(ctx.styles.slice(3, 6)).toEqual(["tile", "focus", "tile"]);
    expect(ctx.fillRect.mock.calls[4].map((n) => Number(n.toFixed(6)))).toEqual([11.5, 77.5, 11, 11]);
    expect(draw().styles).not.toContain("focus");
  });

  it("tints the board for a miss at its strength, then restores full opacity", () => {
    const ctx = draw({ miss: 0.5 });
    expect(ctx.styles.slice(0, 2)).toEqual(["board", "miss"]);
    expect(ctx.alphas[1]).toBe(0.5);
    expect(ctx.globalAlpha).toBe(1);
    expect(draw().styles).not.toContain("miss");
  });
});
