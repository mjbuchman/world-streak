// What /play does with each reply from the start and submit endpoints (T121): pure, so every
// branch of the one scored attempt is unit-tested. PlayToday only fetches and applies them.
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";

export type Verdict = { score: number; passed: boolean; passTarget: number };

// The parts of the endpoints' JSON this page reads (see src/lib/attempts/start.ts and submit.ts).
export type StartBody =
  | { attemptId: string; challengeType: string; params: unknown; passTarget: number }
  | { error: string; submitted?: boolean };
export type SubmitBody = Verdict | { error: string };

export const START_FAILED = "Today's attempt could not be started. Please try again.";
// Start raced the deadline and the day closed first; nothing was stored, so nothing counted.
export const START_DAY_CLOSED = "Today's challenge just closed. Press Start to play the next one.";
// Trying again cannot fix these two, so say what will.
const START_REFUSED: Record<number, string> = {
  401: "Your session has ended. Sign in again to play.",
  403: "Finish setting up your account to play.",
};
// A refused result still counts as an attempt that did not pass (started attempts count, T17).
// One that never arrived may or may not have been recorded, so it says only that.
export const SUBMIT_FAILED = { heading: "Result not sent", message: "Your result could not be sent. Reload the page to see whether it counted." };
const REFUSED_HEADING = "Counted as not passed";
const SUBMIT_REFUSED: Record<string, string> = {
  "day-closed": "Today's challenge closed before your result arrived, so it counted as not passed.",
  "implausible-timing": "Your result could not be checked, so it counted as not passed.",
};

export type StartOutcome =
  | { name: "playing"; attemptId: string; challengeType: ChallengeType; params: unknown; passTarget: number }
  | { name: "ready"; error: string }
  | { name: "abandoned" }
  // Already submitted (perhaps in another tab): the refreshed page shows that result.
  | { name: "refresh" };

export function startOutcome(status: number, body: StartBody): StartOutcome {
  if ("attemptId" in body) {
    const { attemptId, challengeType, params, passTarget } = body;
    // A challenge this page cannot draw would leave the attempt unplayable: report it.
    if (!isChallengeType(challengeType)) return { name: "ready", error: START_FAILED };
    return { name: "playing", attemptId, challengeType, params, passTarget };
  }
  if (status === 409 && body.error === "day-closed") return { name: "ready", error: START_DAY_CLOSED };
  if (status === 409) return body.submitted ? { name: "refresh" } : { name: "abandoned" };
  return { name: "ready", error: START_REFUSED[status] ?? START_FAILED };
}

export type SubmitOutcome =
  | { name: "result"; verdict: Verdict }
  // Already recorded (perhaps from another tab): the refreshed page shows the stored result.
  | { name: "refresh" }
  | { name: "failed"; heading: string; message: string };

export function submitOutcome(body: SubmitBody): SubmitOutcome {
  if (!("error" in body)) return { name: "result", verdict: body };
  if (body.error === "already-submitted") return { name: "refresh" };
  const refused = SUBMIT_REFUSED[body.error];
  return { name: "failed", ...(refused ? { heading: REFUSED_HEADING, message: refused } : SUBMIT_FAILED) };
}
