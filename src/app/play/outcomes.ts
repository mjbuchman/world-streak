// What /play does with each reply from the start and submit endpoints (T121, T156), and how it
// words the day: pure, so every branch of the Daily Three is unit-tested. PlayToday only fetches
// and applies them.
import { isChallengeType } from "@/challenges/registry";
import type { ChallengeType } from "@/challenges/shared/types";
import type { StartResult } from "@/lib/attempts/start";
import type { DayProgress, SubmitResult } from "@/lib/attempts/submit";
import type { GameStatus, TodaysDay } from "@/lib/attempts/today";
// Type-only imports: no server code reaches the browser bundle.

type Submitted = Extract<SubmitResult, { status: 200 }>["body"];
export type Verdict = Pick<Submitted, "score" | "passed" | "passTarget">;

type Started = Extract<StartResult, { status: 200 }>["body"];

// The parts of the endpoints' JSON this page reads, picked from the server's own types (T86), so
// a renamed or added field shows up here. Refusals stay loose: the route handler adds its own
// (sign-in, bad request, outage), and the page must cope with any.
export type StartBody = Pick<Started, "attemptId" | "position" | "challengeType" | "params" | "passTarget"> | { error: string };
export type SubmitBody = Pick<Submitted, "score" | "passed" | "passTarget" | "day"> | { error: string };

/** The day's results page (T157). */
export const RESULTS_PATH = "/play/results";

export const START_FAILED = "The game could not be started. Please try again.";
// Start raced the deadline and the day closed first; nothing was stored, so nothing counted.
export const START_DAY_CLOSED = "Today's games just closed. These are the next day's.";
// Trying again cannot fix these two, so say what will.
const START_REFUSED: Record<number, string> = {
  401: "Your session has ended. Sign in again to play.",
  403: "Finish setting up your account to play.",
};
// A refused result still counts as a lost game. One that never arrived may or may not have been
// recorded, so it says only that.
export const SUBMIT_FAILED = { heading: "Result not sent", message: "Your result could not be sent. Continue to see whether it counted." };
const REFUSED_HEADING = "Counted as lost";
const SUBMIT_REFUSED: Record<string, string> = {
  "day-closed": "Today's games closed before your result arrived, so this game counted as lost.",
  "implausible-timing": "Your result could not be checked, so this game counted as lost.",
};

export type StartOutcome =
  | { name: "playing"; attemptId: string; position: number; challengeType: ChallengeType; params: unknown; passTarget: number }
  | { name: "ready"; error: string }
  // The server knows more than the page (another tab started this game, the day is complete, or a
  // new day began): the refreshed page shows it, with `notice` if it needs saying.
  | { name: "refresh"; notice?: string };

export function startOutcome(status: number, body: StartBody): StartOutcome {
  if ("attemptId" in body) {
    const { attemptId, position, challengeType, params, passTarget } = body;
    // A challenge this page cannot draw would leave the game unplayable: report it.
    if (!isChallengeType(challengeType)) return { name: "ready", error: START_FAILED };
    return { name: "playing", attemptId, position, challengeType, params, passTarget };
  }
  if (status === 409 && body.error === "day-closed") return { name: "refresh", notice: START_DAY_CLOSED };
  if (status === 409) return { name: "refresh" };
  return { name: "ready", error: START_REFUSED[status] ?? START_FAILED };
}

export type SubmitOutcome =
  | { name: "result"; verdict: Verdict; day: DayProgress }
  // Already recorded (perhaps from another tab): the refreshed page shows the stored result.
  | { name: "refresh" }
  | { name: "failed"; heading: string; message: string };

export function submitOutcome(body: SubmitBody): SubmitOutcome {
  if (!("error" in body)) {
    const { day, ...verdict } = body;
    return { name: "result", verdict, day };
  }
  if (body.error === "already-submitted") return { name: "refresh" };
  const refused = SUBMIT_REFUSED[body.error];
  return { name: "failed", ...(refused ? { heading: REFUSED_HEADING, message: refused } : SUBMIT_FAILED) };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The day so far: "1 win, 1 loss". */
export function daySoFar({ wins, losses }: Pick<TodaysDay, "wins" | "losses">): string {
  return `${count(wins, "win", "wins")}, ${count(losses, "loss", "losses")}`;
}

/** The decided day's verdict, or null while it is still open. */
export function dayVerdict(outcome: TodaysDay["outcome"]): string | null {
  if (outcome === "passed") return "You passed today: two wins";
  if (outcome === "failed") return "Not today: two losses";
  return null;
}

/** A game's status in the day's list. A game started and left is a loss (T153). */
export function statusLabel(status: GameStatus["status"]): string {
  return { won: "Won", lost: "Lost", "in-progress": "Lost", "not-started": "Not played" }[status];
}

// The human-approved wording for a started, unsubmitted run (T74, T91), for one game of three:
// runs have no time limit (T87), so it may still be open in another tab.
export function unfinishedNote(position: number): string {
  return `You started game ${position} but haven't finished it here. If it's still open in another tab, finish it there before the day ends. Otherwise it counts as lost.`;
}
