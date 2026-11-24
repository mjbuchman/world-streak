import { describe, expect, it } from "vitest";
import { BUTTON_ORDER, keyColour } from "./input";

describe("Ink keys (T250)", () => {
  it("maps 1 to 4 to the buttons in order", () => {
    expect(BUTTON_ORDER).toEqual(["red", "blue", "yellow", "black"]);
    expect(["1", "2", "3", "4"].map(keyColour)).toEqual(["red", "blue", "yellow", "black"]);
  });

  it.each(["0", "5", "r", "Enter", " ", "11", ""])("ignores %j", (key) => {
    expect(keyColour(key)).toBeNull();
  });
});
