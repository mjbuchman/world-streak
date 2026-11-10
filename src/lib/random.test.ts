import { afterEach, describe, expect, it, vi } from "vitest";
import { secureRandomSeed } from "./random";

afterEach(() => vi.restoreAllMocks());

describe("secureRandomSeed", () => {
  it("takes one unsigned 32-bit value from the platform's secure random source", () => {
    const getRandomValues = vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: Uint32Array) => {
      array[0] = 4_294_967_295;
      return array;
    }) as typeof crypto.getRandomValues);
    expect(secureRandomSeed()).toBe(4_294_967_295);
    expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint32Array));
  });

  it("gives whole numbers in the unsigned 32-bit range", () => {
    for (let i = 0; i < 100; i++) {
      const seed = secureRandomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(4_294_967_295);
    }
  });
});
