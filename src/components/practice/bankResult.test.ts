import { describe, expect, it } from "vitest";
import { bankResult } from "./bankResult";

const rounds = (n: number) => `${n} ${n === 1 ? "round" : "rounds"}`;
const dots = (n: number) => `${n} ${n === 1 ? "dot" : "dots"}`;

describe("bankResult (T200, T225)", () => {
  const base = { total: 5, everyLabel: "Every round survived", scoreLabel: rounds, bankLabel: "10-dot bank", format: dots };

  it("names a full run and the bank left, with no score", () => {
    expect(bankResult({ ...base, survived: 5, left: 3 })).toEqual({
      heading: "Every round survived",
      detail: "3 dots of your 10-dot bank left.",
    });
  });

  it("names how far a failed run got", () => {
    expect(bankResult({ ...base, survived: 1, left: 0 })).toEqual({
      heading: "1 round survived",
      detail: "0 dots of your 10-dot bank left.",
    });
  });
});
