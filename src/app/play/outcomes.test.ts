import { describe, expect, it } from "vitest";
import {
  daySoFar,
  dayVerdict,
  START_DAY_CLOSED,
  START_FAILED,
  startOutcome,
  statusLabel,
  SUBMIT_FAILED,
  submitOutcome,
  unfinishedNote,
} from "./outcomes";

const started = { attemptId: "a1", position: 2, challengeType: "stacking", params: { seed: 1 }, passTarget: 10 };
const SESSION_ENDED = "Your session has ended. Sign in again to play.";

describe("startOutcome", () => {
  it.each([
    ["a started game, with its position", 200, started, { name: "playing", ...started }],
    ["an unknown challenge", 200, { ...started, challengeType: "chess" }, { name: "ready", error: START_FAILED }],
    ["401", 401, { error: "unauthenticated" }, { name: "ready", error: SESSION_ENDED }],
    ["403", 403, { error: "profile-required" }, { name: "ready", error: "Finish setting up your account to play." }],
    ["409 day-closed: the next day's lineup, saying why", 409, { error: "day-closed" }, { name: "refresh", notice: START_DAY_CLOSED }],
    ["409 already-started (another tab)", 409, { error: "already-started" }, { name: "refresh" }],
    ["409 day-complete", 409, { error: "day-complete" }, { name: "refresh" }],
    ["the status wins over the error", 401, { error: "day-closed" }, { name: "ready", error: SESSION_ENDED }],
    ["429", 429, { error: "busy" }, { name: "ready", error: START_FAILED }],
    ["another status", 500, { error: "server-error" }, { name: "ready", error: START_FAILED }],
  ] as const)("%s", (_, status, body, outcome) => {
    expect(startOutcome(status, body)).toEqual(outcome);
  });
});

describe("submitOutcome", () => {
  const day = { wins: 1, losses: 1, outcome: null, nextPosition: 3 };
  it.each([
    [
      "a verdict and the day so far",
      { score: 12, passed: true, passTarget: 10, day },
      { name: "result", verdict: { score: 12, passed: true, passTarget: 10 }, day },
    ],
    ["already-submitted", { error: "already-submitted" }, { name: "refresh" }],
    [
      "day-closed",
      { error: "day-closed" },
      { name: "failed", heading: "Counted as lost", message: "Today's games closed before your result arrived, so this game counted as lost." },
    ],
    [
      "implausible-timing",
      { error: "implausible-timing" },
      { name: "failed", heading: "Counted as lost", message: "Your result could not be checked, so this game counted as lost." },
    ],
    ["an unknown error", { error: "server-error" }, { name: "failed", ...SUBMIT_FAILED }],
  ] as const)("%s", (_, body, outcome) => {
    expect(submitOutcome(body)).toEqual(outcome);
  });
});

describe("the day's wording", () => {
  it.each([
    [0, 0, "0 wins, 0 losses"],
    [1, 0, "1 win, 0 losses"],
    [1, 1, "1 win, 1 loss"],
    [2, 1, "2 wins, 1 loss"],
    [0, 2, "0 wins, 2 losses"],
  ])("%i wins and %i losses read %s", (wins, losses, text) => {
    expect(daySoFar({ wins, losses })).toBe(text);
  });

  it.each([
    ["passed", "You passed today: two wins"],
    ["failed", "Not today: two losses"],
    [null, null],
  ] as const)("a %s day's verdict", (outcome, text) => {
    expect(dayVerdict(outcome)).toBe(text);
  });

  it.each([
    ["won", "Won"],
    ["lost", "Lost"],
    // Started and left: a loss (T153), with the unfinished note beside it.
    ["in-progress", "Lost"],
    ["not-started", "Not played"],
  ] as const)("a %s game reads %s", (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  it("words a game started and left as the approved unfinished note, for that game", () => {
    expect(unfinishedNote(2)).toBe(
      "You started game 2 but haven't finished it here. If it's still open in another tab, finish it there before the day ends. Otherwise it counts as lost.",
    );
  });
});
