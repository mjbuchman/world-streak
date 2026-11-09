import { describe, expect, it } from "vitest";
import { blocks } from "./blocks";

describe("blocks", () => {
  it("says block for one and blocks otherwise", () => {
    expect(blocks(0)).toBe("0 blocks");
    expect(blocks(1)).toBe("1 block");
    expect(blocks(12)).toBe("12 blocks");
  });
});
