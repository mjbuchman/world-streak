import { describe, expect, it } from "vitest";
import { dbInteger, dbNumber, numericSchema } from "./numeric";

describe("dbNumber", () => {
  it.each([
    [10, 10],
    [7.5, 7.5],
    [0, 0],
    [-1, -1],
    ["10", 10],
    ["0.60", 0.6],
    ["-2.5", -2.5],
  ])("reads %j as %j", (value, expected) => {
    expect(dbNumber(value, "pass_target")).toBe(expected);
  });

  it.each([null, undefined, "", "abc", "NaN", "Infinity", "1e3", "0x10", " 10", Number.NaN, Number.POSITIVE_INFINITY, {}, [], true])(
    "refuses %j, naming the field",
    (value) => {
      expect(() => dbNumber(value, "pass_target")).toThrow(/pass_target/);
    },
  );
});

describe("dbInteger", () => {
  it.each([
    [0, 0],
    [42, 42],
    [4294967295, 4294967295],
  ])("reads %j", (value, expected) => {
    expect(dbInteger(value, "seed")).toBe(expected);
  });

  it.each([1.5, "42", null, undefined, Number.NaN, -0.5])("refuses %j, naming the field", (value) => {
    expect(() => dbInteger(value, "seed")).toThrow(/seed/);
  });
});

describe("numericSchema", () => {
  it("is the zod schema behind dbNumber, for use inside larger schemas", () => {
    expect(numericSchema.parse("0.5")).toBe(0.5);
    expect(numericSchema.safeParse("x").success).toBe(false);
  });
});
