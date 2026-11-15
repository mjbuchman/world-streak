import { describe, expect, it, vi } from "vitest";
import {
  LIT_SHARE,
  MISS_FLASH_MS,
  TILE_GAP,
  boardLayout,
  drawEchoPath,
  hitTile,
  litTileAt,
  missStrength,
  playbackMs,
  type EchoPathFrame,
} from "./render";

function fakeContext() {
  return { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: "", globalAlpha: 1, styles: [] as string[] };
}

const colors = { board: "board", tile: "tile", lit: "lit", pressed: "pressed", miss: "miss" };
const frame = (over: Partial<EchoPathFrame> = {}): EchoPathFrame => ({
  cols: 3,
  rows: 3,
  width: 300,
  height: 300,
  devicePixelRatio: 2,
  lit: null,
  pressed: null,
  miss: 0,
  colors,
  ...over,
});

/** Records the fill colour of every fillRect, in order. */
function draw(over: Partial<EchoPathFrame> = {}) {
  const ctx = fakeContext();
  ctx.fillRect.mockImplementation(() => void ctx.styles.push(ctx.fillStyle));
  drawEchoPath(ctx as unknown as CanvasRenderingContext2D, frame(over));
  return ctx;
}

describe("litTileAt", () => {
  const sequence = [4, 0, 8];

  it("lights each step's tile for LIT_SHARE of the step, from elapsed time only", () => {
    expect(LIT_SHARE).toBe(0.75);
    expect(litTileAt(sequence, 400, 0)).toBe(4);
    expect(litTileAt(sequence, 400, 299)).toBe(4);
    expect(litTileAt(sequence, 400, 300)).toBeNull();
    expect(litTileAt(sequence, 400, 400)).toBe(0);
    expect(litTileAt(sequence, 400, 1000)).toBe(8);
    expect(litTileAt(sequence, 400, 1100)).toBeNull();
  });

  it("lights nothing before the start or after the last step", () => {
    expect(litTileAt(sequence, 400, -1)).toBeNull();
    expect(litTileAt(sequence, 400, playbackMs(3, 400))).toBeNull();
    expect(playbackMs(3, 400)).toBe(1200);
  });
});

describe("boardLayout and hitTile", () => {
  const layout = boardLayout(300, 300, 3, 3);

  it("lays the tiles out with equal gaps inside a centred square", () => {
    expect(TILE_GAP).toBe(0.04);
    expect(layout).toEqual({ left: 0, top: 0, gap: 12, tileSize: 84, cols: 3, rows: 3 });
    expect(boardLayout(400, 300, 3, 3).left).toBe(50);
  });

  it("maps points to tiles, edges included, and the gaps and outside to null", () => {
    expect(hitTile(layout, 12, 12)).toBe(0);
    expect(hitTile(layout, 95.9, 95.9)).toBe(0);
    expect(hitTile(layout, 96, 50)).toBeNull();
    expect(hitTile(layout, 108, 12)).toBe(1);
    expect(hitTile(layout, 150, 150)).toBe(4);
    expect(hitTile(layout, 287.9, 287.9)).toBe(8);
    expect(hitTile(layout, 288, 288)).toBeNull();
    expect(hitTile(layout, 5, 50)).toBeNull();
    expect(hitTile(layout, -1, 50)).toBeNull();
    expect(hitTile(layout, 299, 299)).toBeNull();
  });

  it("gives tiles of at least 44 x 44 CSS px on a 390 px phone", () => {
    // The board fills the page width less the 16 px gutters.
    expect(boardLayout(390 - 32, 600, 3, 3).tileSize).toBeGreaterThanOrEqual(44);
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
  it("draws the board and every tile for the device's pixel ratio", () => {
    const ctx = draw();
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 300, 300);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 300, 300);
    expect(ctx.fillRect).toHaveBeenNthCalledWith(2, 12, 12, 84, 84);
    expect(ctx.fillRect).toHaveBeenLastCalledWith(204, 204, 84, 84);
    expect(ctx.styles).toEqual(["board", ...Array<string>(9).fill("tile")]);
  });

  it("shows the lit tile and the pressed tile in their colours, the lit one first", () => {
    expect(draw({ lit: 4, pressed: 2 }).styles).toEqual(["board", "tile", "tile", "pressed", "tile", "lit", "tile", "tile", "tile", "tile"]);
    expect(draw({ lit: 2, pressed: 2 }).styles[3]).toBe("lit");
  });

  it("tints the board for a miss at its strength, then restores full opacity", () => {
    const ctx = draw({ miss: 0.5 });
    expect(ctx.styles.slice(0, 2)).toEqual(["board", "miss"]);
    expect(ctx.globalAlpha).toBe(1);
    expect(draw().styles).not.toContain("miss");
  });
});
