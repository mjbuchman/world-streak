import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import type { Database, Json, TablesInsert } from "@/lib/supabase/database.types";
import type { AttemptStore } from "./start";
import { RECORD_STATUSES, type RecordStatus, type SubmitStore } from "./submit";
import type { DayAttempt, GameDay } from "./types";

const UNIQUE_VIOLATION = "23505";
// Raised by the attempt insert trigger when the game day is already closed (migration T93).
const DAY_CLOSED = "WS001";

function throwDbError(operation: string, error: PostgrestError): never {
  throw new Error(`${operation} failed: ${error.message}`);
}

const RECENT_SCORES = 20;

/**
 * The attempt store over Supabase, for starting and submitting attempts. Pass the service-role
 * client: players have no write access to attempts or game days under row-level security, by
 * design. `findAttemptForDay` alone also works with a player's own client (see `todaysAttempt`).
 */
export function supabaseAttemptStore(db: Pick<SupabaseClient<Database>, "from" | "rpc">): AttemptStore & SubmitStore {
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
      return { challengeType: data.challenge_type, passTarget: dbNumber(data.pass_target, "pass_target"), closed: data.closed_at !== null };
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
      if (data.submitted_at === null) return { submitted: false };
      return {
        submitted: true,
        score: dbNumber(data.score, "score"),
        passed: data.passed === true,
        passTarget: dbNumber(data.game_days.pass_target, "pass_target"),
      };
    },

    async insertAttempt({ userId, gameDate, seed }) {
      const { data, error } = await db
        .from("attempts")
        // counted_weight is NOT NULL but stamped by a trigger (T46), which the generated types cannot see.
        .insert({ user_id: userId, game_date: gameDate, seed } as TablesInsert<"attempts">)
        .select("id")
        .single();
      if (error?.code === UNIQUE_VIOLATION) return "duplicate";
      if (error?.code === DAY_CLOSED) return "day-closed";
      if (error) throwDbError("Attempt insert", error);
      return { id: data.id };
    },

    async findAttemptById(attemptId) {
      const { data, error } = await db
        .from("attempts")
        .select("user_id, game_date, seed, started_at, submitted_at")
        .eq("id", attemptId)
        .maybeSingle();
      if (error) throwDbError("Attempt lookup by id", error);
      if (!data) return null;
      return {
        userId: data.user_id,
        gameDate: data.game_date,
        seed: dbInteger(data.seed, "seed"),
        startedAt: new Date(data.started_at),
        submitted: data.submitted_at !== null,
      };
    },

    async recordResult({ attemptId, inputs, score, passed }) {
      const { data, error } = await db.rpc("record_attempt_result", {
        p_attempt_id: attemptId,
        // The inputs came from a parsed JSON request body, so they are JSON.
        p_inputs: inputs as Json,
        p_score: score,
        p_passed: passed,
      });
      if (error) throwDbError("record_attempt_result", error);
      if (!RECORD_STATUSES.includes(data as RecordStatus)) throw new Error(`record_attempt_result returned "${String(data)}"`);
      return data as RecordStatus;
    },

    async recentScores(userId, gameDate) {
      // Enough to hold the latest five of any one challenge while the rotation mixes three.
      const { data, error } = await db
        .from("attempts")
        .select("score, game_days(challenge_type)")
        .eq("user_id", userId)
        .lt("game_date", gameDate)
        .not("score", "is", null)
        .order("game_date", { ascending: false })
        .limit(RECENT_SCORES);
      if (error) throwDbError("Recent scores lookup", error);
      return data.map((row) => ({
        challengeType: row.game_days.challenge_type,
        score: dbNumber(row.score, "score"),
      }));
    },

    async recordFlags(attemptId, reasons) {
      const { error } = await db.rpc("record_cheat_flags", { p_attempt_id: attemptId, p_reasons: reasons });
      if (error) throwDbError("record_cheat_flags", error);
    },
  };
}
