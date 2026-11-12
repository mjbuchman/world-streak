import { describe, expect, it } from "vitest";
import { START_DAY_CLOSED, START_FAILED, startOutcome, SUBMIT_FAILED, submitOutcome } from "./outcomes";

const started = { attemptId: "a1", challengeType: "stacking", params: { seed: 1 }, passTarget: 10 };

describe("startOutcome", () => {
  it.each([
    ["a started attempt", 200, started, { name: "playing", ...started }],
    ["an unknown challenge", 200, { ...started, challengeType: "chess" }, { name: "ready", error: START_FAILED }],
    ["401", 401, { error: "unauthenticated" }, { name: "ready", error: "Your session has ended. Sign in again to play." }],
    ["403", 403, { error: "no-profile" }, { name: "ready", error: "Finish setting up your account to play." }],
    ["409 day-closed", 409, { error: "day-closed" }, { name: "ready", error: START_DAY_CLOSED }],
    ["409 submitted", 409, { error: "already-started", submitted: true }, { name: "refresh" }],
    ["another 409", 409, { error: "already-started" }, { name: "abandoned" }],
    ["another status", 500, { error: "server-error" }, { name: "ready", error: START_FAILED }],
  ] as const)("%s", (_, status, body, outcome) => {
    expect(startOutcome(status, body)).toEqual(outcome);
  });
});

describe("submitOutcome", () => {
  it.each([
    ["a verdict", { score: 12, passed: true, passTarget: 10 }, { name: "result", verdict: { score: 12, passed: true, passTarget: 10 } }],
    ["already-submitted", { error: "already-submitted" }, { name: "refresh" }],
    [
      "day-closed",
      { error: "day-closed" },
      { name: "failed", heading: "Counted as not passed", message: "Today's challenge closed before your result arrived, so it counted as not passed." },
    ],
    [
      "implausible-timing",
      { error: "implausible-timing" },
      { name: "failed", heading: "Counted as not passed", message: "Your result could not be checked, so it counted as not passed." },
    ],
    ["an unknown error", { error: "server-error" }, { name: "failed", ...SUBMIT_FAILED }],
  ] as const)("%s", (_, body, outcome) => {
    expect(submitOutcome(body)).toEqual(outcome);
  });
});
