// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoundProgress } from "./RoundProgress";

afterEach(cleanup);

const counter = () => screen.getByRole("img");
const steps = () => [...counter().querySelectorAll<HTMLElement>("[data-step]")].map((step) => step.dataset.step);
const bars = () => [...counter().querySelectorAll<HTMLElement>("[data-bar]")].map((bar) => bar.dataset.bar);

describe("RoundProgress (T224)", () => {
  it.each([
    [0, ["current", "later", "later", "later"], ["unlit", "unlit", "unlit"]],
    [2, ["done", "done", "current", "later"], ["lit", "lit", "unlit"]],
    [3, ["done", "done", "done", "current"], ["lit", "lit", "lit"]],
  ])("marks the numbers and bars for round %i of 4", (current, expectedSteps, expectedBars) => {
    render(<RoundProgress total={4} current={current} />);
    expect(steps()).toEqual(expectedSteps);
    expect(bars()).toEqual(expectedBars);
    expect(counter().textContent).toBe("1234");
  });

  it("puts a bar between each pair of numbers and none after the last", () => {
    render(<RoundProgress total={5} current={0} />);
    const kinds = [...counter().children].map((child) => ((child as HTMLElement).dataset.step ? "number" : "bar"));
    expect(kinds).toEqual(["number", "bar", "number", "bar", "number", "bar", "number", "bar", "number"]);
  });

  it("colours a failed round's number and leaves its bar unlit", () => {
    render(<RoundProgress total={4} current={2} failedRound={2} />);
    expect(steps()).toEqual(["done", "done", "failed", "later"]);
    expect(bars()).toEqual(["lit", "lit", "unlit"]);
  });

  it.each([
    [4, 1, "Round 2 of 4"],
    [5, 4, "Round 5 of 5"],
  ])("labels %i rounds at step %i as %s", (total, current, label) => {
    render(<RoundProgress total={total} current={current} />);
    expect(screen.getByRole("img", { name: label }).querySelectorAll("[data-step]")).toHaveLength(total);
  });
});
