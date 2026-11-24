import { describe, expect, it } from "vitest";
import { BUTTONS, MIN_SWIPE_PX, keyDirection, swipeDirection } from "./input";

describe("swipeDirection (T237)", () => {
  it("reads each quadrant, y growing downward", () => {
    expect(swipeDirection(40, 5)).toBe("right");
    expect(swipeDirection(-40, 5)).toBe("left");
    expect(swipeDirection(5, -40)).toBe("up");
    expect(swipeDirection(5, 40)).toBe("down");
  });

  it("resolves every exact diagonal to its horizontal side, and one past it to the vertical", () => {
    expect([swipeDirection(30, 30), swipeDirection(-30, 30), swipeDirection(30, -30), swipeDirection(-30, -30)]).toEqual(["right", "left", "right", "left"]);
    expect([swipeDirection(30, 30.01), swipeDirection(-30, -30.01)]).toEqual(["down", "up"]);
  });

  it("ignores a swipe shorter than 24 px", () => {
    expect(MIN_SWIPE_PX).toBe(24);
    expect(swipeDirection(23, 0)).toBeNull();
    expect(swipeDirection(24, 0)).toBe("right");
    expect(swipeDirection(0, -23.9)).toBeNull();
    expect(swipeDirection(0, -24)).toBe("up");
    expect(swipeDirection(0, 0)).toBeNull();
    expect(swipeDirection(10, 0, 8)).toBe("right");
  });
});

describe("keyDirection (T237)", () => {
  it("maps the four arrow keys and nothing else", () => {
    expect(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].map(keyDirection)).toEqual(["left", "right", "up", "down"]);
    expect(keyDirection("a")).toBeNull();
    expect(keyDirection("Enter")).toBeNull();
  });

  it("names a button for each direction, once", () => {
    expect(BUTTONS.map((b) => b.dir).sort()).toEqual(["down", "left", "right", "up"]);
    expect(BUTTONS.map((b) => b.name)).toEqual(["Left", "Up", "Down", "Right"]);
  });
});
