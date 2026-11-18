// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoundProgress } from "./RoundProgress";

afterEach(cleanup);

const steps = () => [...screen.getByRole("img").children].map((step) => (step as HTMLElement).dataset.step);

describe("RoundProgress", () => {
  it.each([
    [0, ["current", "later", "later", "later"]],
    [2, ["done", "done", "current", "later"]],
    [3, ["done", "done", "done", "current"]],
  ])("marks the steps for round %i of 4", (current, expected) => {
    render(<RoundProgress total={4} current={current} />);
    expect(steps()).toEqual(expected);
    expect(screen.getByRole("img").textContent).toBe("1234");
  });

  it("fills a failed round in its own colour", () => {
    render(<RoundProgress total={4} current={1} failedRound={1} />);
    expect(steps()).toEqual(["done", "failed", "later", "later"]);
  });

  it.each([
    [4, 1, "Round 2 of 4"],
    [5, 4, "Round 5 of 5"],
  ])("labels %i rounds at step %i as %s", (total, current, label) => {
    render(<RoundProgress total={total} current={current} />);
    expect(screen.getByRole("img", { name: label }).children).toHaveLength(total);
  });
});
