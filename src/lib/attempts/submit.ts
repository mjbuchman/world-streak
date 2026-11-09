import { z } from "zod";
import { CHALLENGES, isChallengeType } from "@/challenges/registry";
import type { ChallengeModule, ScoreDirection } from "@/challenges/shared/types";
import { ATTEMPT_MAX_AGE_MS, INPUT_TIMING_SLACK_MS } from "@/config/attempts";
import { gameDateAt } from "@/lib/gameDay";

export type RecordStatus = "recorded" | "already-submitted" | "day-closed" | "not-found";

/** The database operations submitting an attempt needs (see `supabaseSubmitStore`). */
export type SubmitStore = {
  findAttempt: (
    attemptId: string,
  ) => Promise<{ userId: string; gameDate: string; seed: number; startedAt: Date; submitted: boolean } | null>;
  gameDay: (gameDate: string) => Promise<{ challengeType: string; passTarget: number; closed: boolean }>;
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
  return { inputs, score: module.score(module.paramsFromSeed(seed), inputs), lastInputMs: module.lastInputMs(inputs) };
}

/** Whether a score meets the day's target: at least it when higher is better, at most it otherwise. */
export function passes(score: number, target: number, direction: ScoreDirection): boolean {
  return direction === "higher-better" ? score >= target : score <= target;
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
  const attempt = await store.findAttempt(attemptId);
  if (!attempt || attempt.userId !== userId) return fail(404, "not-found");
  if (attempt.submitted) return fail(409, "already-submitted");

  // Submissions after the deadline record nothing, even for an attempt started before it.
  const day = await store.gameDay(attempt.gameDate);
  if (day.closed || attempt.gameDate !== gameDateAt(now)) return fail(409, "day-closed");
  if (!isChallengeType(day.challengeType)) {
    throw new Error(`Game day ${attempt.gameDate} has unknown challenge type "${day.challengeType}"`);
  }
  const challenge = CHALLENGES[day.challengeType];

  const replayed = replay(challenge, attempt.seed, request.data.inputs);
  if (!replayed) return fail(400, "invalid-inputs");

  const elapsedMs = now.getTime() - attempt.startedAt.getTime();
  if (elapsedMs > ATTEMPT_MAX_AGE_MS || replayed.lastInputMs > elapsedMs + INPUT_TIMING_SLACK_MS) {
    return fail(422, "implausible-timing");
  }

  const passed = passes(replayed.score, day.passTarget, challenge.direction);
  const recorded = await store.recordResult({ attemptId, inputs: replayed.inputs, score: replayed.score, passed });
  if (recorded !== "recorded") return FROM_RECORD_STATUS[recorded];
  return { status: 200, body: { score: replayed.score, passed, passTarget: day.passTarget } };
}
