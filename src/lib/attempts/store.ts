import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import type { AttemptStore } from "./start";
import { RECORD_STATUSES, type RecordStatus, type SubmitStore } from "./submit";
import type { DayAttempt, GameDay } from "./types";

const UNIQUE_VIOLATION = "23505";
// Raised by the attempt insert trigger when the game day is already closed (migration T93).
const DAY_CLOSED = "WS001";

function throwDbError(operation: string, error: PostgrestError): never {
  throw new Error(`${operation} failed: ${error.message}`);
}

type GameDayRow = { challenge_type: string; pass_target: number | string; closed_at: string | null };
type DayAttemptRow = {
  score: number | string | null;
  passed: boolean | null;
  submitted_at: string | null;
  game_days: { pass_target: number | string };
};
type AttemptRow = { user_id: string; game_date: string; seed: number; started_at: string; submitted_at: string | null };

/**
 * The attempt store over Supabase, for starting and submitting attempts. Pass the service-role
 * client: players have no write access to attempts or game days under row-level security, by
 * design. `findAttemptForDay` alone also works with a player's own client (see `todaysAttempt`).
 */
export function supabaseAttemptStore(db: Pick<SupabaseClient, "from" | "rpc">): AttemptStore & SubmitStore {
  return {
    async hasProfile(userId) {
      const { data, error } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (error) throwDbError("Profile lookup", error);
      return data !== null;
    },

    async ensureGameDay(gameDate) {
      const { error } = await db.rpc("ensure_game_day", { d: gameDate });
      if (error) throwDbError("ensure_game_day", error);
    },

    async gameDay(gameDate): Promise<GameDay> {
      const { data, error } = await db
        .from("game_days")
        .select("challenge_type, pass_target, closed_at")
        .eq("game_date", gameDate)
        .single();
      if (error) throwDbError("Game day lookup", error);
      const row = data as GameDayRow;
      return { challengeType: row.challenge_type, passTarget: dbNumber(row.pass_target, "pass_target"), closed: row.closed_at !== null };
    },

    async findAttemptForDay(userId, gameDate): Promise<DayAttempt | null> {
      const { data, error } = await db
        .from("attempts")
        .select("score, passed, submitted_at, game_days(pass_target)")
        .eq("user_id", userId)
        .eq("game_date", gameDate)
        .maybeSingle();
      if (error) throwDbError("Day attempt lookup", error);
      if (!data) return null;
      const row = data as unknown as DayAttemptRow;
      if (row.submitted_at === null) return { submitted: false };
      return {
        submitted: true,
        score: dbNumber(row.score, "score"),
        passed: row.passed === true,
        passTarget: dbNumber(row.game_days.pass_target, "pass_target"),
      };
    },

    async insertAttempt({ userId, gameDate, seed }) {
      const { data, error } = await db
        .from("attempts")
        .insert({ user_id: userId, game_date: gameDate, seed })
        .select("id")
        .single();
      if (error?.code === UNIQUE_VIOLATION) return "duplicate";
      if (error?.code === DAY_CLOSED) return "day-closed";
      if (error) throwDbError("Attempt insert", error);
      return { id: (data as { id: string }).id };
    },

    async findAttemptById(attemptId) {
      const { data, error } = await db
        .from("attempts")
        .select("user_id, game_date, seed, started_at, submitted_at")
        .eq("id", attemptId)
        .maybeSingle();
      if (error) throwDbError("Attempt lookup by id", error);
      if (!data) return null;
      const row = data as AttemptRow;
      return {
        userId: row.user_id,
        gameDate: row.game_date,
        seed: dbInteger(row.seed, "seed"),
        startedAt: new Date(row.started_at),
        submitted: row.submitted_at !== null,
      };
    },

    async recordResult({ attemptId, inputs, score, passed }) {
      const { data, error } = await db.rpc("record_attempt_result", {
        p_attempt_id: attemptId,
        p_inputs: inputs,
        p_score: score,
        p_passed: passed,
      });
      if (error) throwDbError("record_attempt_result", error);
      if (!RECORD_STATUSES.includes(data as RecordStatus)) throw new Error(`record_attempt_result returned "${String(data)}"`);
      return data as RecordStatus;
    },
  };
}
