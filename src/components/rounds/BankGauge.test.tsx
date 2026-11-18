// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BankGauge, bankLayout } from "./BankGauge";

afterEach(cleanup);

const seconds = (value: number) => `${value} s`;

describe("bankLayout", () => {
  it("is all fill before any round", () => {
    expect(bankLayout(10, [])).toEqual({ left: 10, busted: false, fillPct: 100, segments: [] });
  });

  it("puts one round's cost at the right end of the fill", () => {
    const layout = bankLayout(10, [2.4]);
    expect(layout.left).toBe(7.6);
    expect(layout.fillPct).toBeCloseTo(76);
    expect(layout.segments).toHaveLength(1);
    expect(layout.segments[0]!.startPct).toBeCloseTo(76);
    expect(layout.segments[0]!.widthPct).toBeCloseTo(24);
  });

  it("stacks the costs from the right, the latest against the fill", () => {
    const { left, fillPct, segments } = bankLayout(10, [2.4, 1.5]);
    expect(left).toBe(6.1);
    expect(fillPct).toBeCloseTo(61);
    expect(segments.map((s) => [s.round, s.cost])).toEqual([
      [1, 2.4],
      [2, 1.5],
    ]);
    expect(segments[0]!.startPct).toBeCloseTo(76);
    expect(segments[1]!.startPct).toBeCloseTo(61);
    expect(segments[1]!.widthPct).toBeCloseTo(15);
  });

  it("empties the fill on a bust and never gives a negative width", () => {
    const { left, busted, fillPct, segments } = bankLayout(10, [6, 5, 3]);
    expect([left, busted, fillPct]).toEqual([0, true, 0]);
    expect(segments.map((s) => s.widthPct)).toEqual([60, 40, 0]);
    expect(segments.every((s) => s.startPct >= 0)).toBe(true);
  });

  it("refuses a bank with no positive total, rather than drawing NaN widths", () => {
    expect(() => bankLayout(0, [])).toThrow(RangeError);
  });

  it("is not a bust when the costs use the bank exactly", () => {
    expect(bankLayout(10, [4, 6])).toMatchObject({ left: 0, busted: false });
  });
});

describe("BankGauge", () => {
  it("shows what is left as a meter, the latest cost and a line under the bar, through the formatter", () => {
    const { container } = render(<BankGauge total={10} spent={[2.4, 1.5]} format={seconds} label="Time bank" />);
    const meter = screen.getByRole("meter", { name: "Time bank" });
    expect(meter.getAttribute("aria-valuenow")).toBe("6.1");
    expect(meter.getAttribute("aria-valuemax")).toBe("10");
    expect(meter.getAttribute("aria-valuetext")).toBe("6.1 s left of 10 s");
    expect(screen.getByText("6.1 s left of 10 s")).toBeTruthy();
    expect(screen.getByText("-1.5 s")).toBeTruthy();
    expect(screen.getByText("Round 2 cost 1.5 s").getAttribute("aria-live")).toBe("polite");
    expect((container.querySelector("[data-bank-fill]") as HTMLElement).style.width).toBe("61%");
    expect((container.querySelector("[data-bank-cost='2']") as HTMLElement).dataset.latest).toBe("");
    expect((container.querySelector("[data-bank-cost='1']") as HTMLElement).dataset.latest).toBeUndefined();
  });

  it("says the bank is used up when a round busts it", () => {
    const { container } = render(<BankGauge total={10} spent={[6, 5]} format={seconds} label="Time bank" />);
    expect(screen.getByText("Bank used up")).toBeTruthy();
    expect(screen.getByRole("meter").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText("Round 2 cost 5 s. Bank used up")).toBeTruthy();
    expect((container.querySelector("[data-bank-fill]") as HTMLElement).style.width).toBe("0%");
  });

  it("stays legible with Second Sense's 2 s bank (T203)", () => {
    const tenths = (v: number) => `${v.toFixed(1)} s`;
    const { container } = render(<BankGauge total={2} spent={[0.4, 1.2]} format={tenths} label="Time bank" />);
    expect(screen.getByText("0.4 s left of 2.0 s")).toBeTruthy();
    expect(screen.getByText("Round 2 cost 1.2 s")).toBeTruthy();
    expect((container.querySelector("[data-bank-fill]") as HTMLElement).style.width).toBe("20%");
  });

  it("has no cost caption before the first round", () => {
    render(<BankGauge total={3} spent={[]} format={(v) => `${v} dots`} label="Dot bank" />);
    expect(screen.getByText("3 dots left of 3 dots")).toBeTruthy();
    expect(screen.queryByText(/^-/)).toBeNull();
  });
});
