import { z } from "zod";
import { challengeForGameDay } from "@/challenges/registry";
import type { ChallengeModule } from "@/challenges/shared/types";
import { INPUT_TIMING_SLACK_MS } from "@/config/attempts";
import { gameDateAt } from "@/lib/gameDay";
import { passes } from "@/lib/scoring/pass";
import type { GameDay } from "./types";

/** What `record_attempt_result` can answer. */
export const RECORD_STATUSES = ["recorded", "already-submitted", "day-closed", "not-found"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** The database operations submitting an attempt needs (see `supabaseAttemptStore`). */
export type SubmitStore = {
  findAttemptById: (
    attemptId: string,
  ) => Promise<{ userId: string; gameDate: string; seed: number; startedAt: Date; submitted: boolean } | null>;
  gameDay: (gameDate: string) => Promise<GameDay>;
  /** Writes the result atomically and only once; reports why not if it cannot. */
  recordResult: (result: { attemptId: string; inputs: unknown; score: number; passed: boolean }) => Promise<RecordStatus>;
};

type ErrorCode = "invalid-body" | "invalid-inputs" | "not-found" | "already-submitted" | "day-closed" | "implausible-timing";

export type SubmitResult =
  | { status: 200; body: { score: number; passed: boolean; passTarget: number } }
  | { status: 400 | 404 | 409 | 422; body: { error: ErrorCode } };

// Only these two fields are read. Anything else the client sends (a claimed score or pass) is
// dropped, because the server decides both.
const bodySchema = z.object({ attemptId: z.guid(), inputs: z.unknown() });

const fail = (status: 400 | 404 | 409 | 422, error: ErrorCode): SubmitResult => ({ status, body: { error } });

const FROM_RECORD_STATUS = {
  "already-submitted": fail(409, "already-submitted"),
  "day-closed": fail(409, "day-closed"),
  "not-found": fail(404, "not-found"),
} as const;

/** Validates the raw inputs with the challenge's schema and replays the engine on the seed. */
function replay<Params, Inputs>(module: ChallengeModule<Params, Inputs>, seed: number, rawInputs: unknown) {
  const parsed = module.inputsSchema.safeParse(rawInputs);
  if (!parsed.success) return null;
  const inputs = parsed.data;
  const params = module.paramsFromSeed(seed);
  // The game submits only finished runs; anything else is not a real submission.
  if (!module.finished(params, inputs)) return null;
  return { inputs, score: module.score(params, inputs), lastInputMs: module.lastInputMs(inputs) };
}

/**
 * Scores a signed-in player's submitted attempt. The client sends only its inputs; the server
 * replays the engine on the seed it issued, decides pass or fail from the day's target, and
 * stores the result once. Database errors are thrown, for the endpoint to answer 500.
 */
export async function submitAttempt({
  userId,
  body,
  now,
  store,
}: {
  userId: string;
  body: unknown;
  now: Date;
  store: SubmitStore;
}): Promise<SubmitResult> {
  const request = bodySchema.safeParse(body);
  if (!request.success) return fail(400, "invalid-body");
  const { attemptId } = request.data;

  // Someone else's attempt looks the same as a missing one, so ids cannot be probed.
  const attempt = await store.findAttemptById(attemptId);
  if (!attempt || attempt.userId !== userId) return fail(404, "not-found");
  if (attempt.submitted) return fail(409, "already-submitted");

  // Submissions after the deadline record nothing, even for an attempt started before it.
  const day = await store.gameDay(attempt.gameDate);
  if (day.closed || attempt.gameDate !== gameDateAt(now)) return fail(409, "day-closed");
  const challenge = challengeForGameDay(attempt.gameDate, day.challengeType);

  const replayed = replay(challenge, attempt.seed, request.data.inputs);
  if (!replayed) return fail(400, "invalid-inputs");

  // No taps from the future. There is no upper limit: a run may take as long as the player
  // likes (human decision, T87); the day's deadline above is the only limit. started_at is the
  // database clock and `now` the app server's; INPUT_TIMING_SLACK_MS also absorbs a small
  // difference between the two.
  const elapsedMs = now.getTime() - attempt.startedAt.getTime();
  if (replayed.lastInputMs > elapsedMs + INPUT_TIMING_SLACK_MS) return fail(422, "implausible-timing");

  const passed = passes(replayed.score, day.passTarget, challenge.direction);
  const recorded = await store.recordResult({ attemptId, inputs: replayed.inputs, score: replayed.score, passed });
  if (recorded !== "recorded") return FROM_RECORD_STATUS[recorded];
  return { status: 200, body: { score: replayed.score, passed, passTarget: day.passTarget } };
}
