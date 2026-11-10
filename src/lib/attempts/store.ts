import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AttemptStore } from "./start";
import { RECORD_STATUSES, type RecordStatus, type SubmitStore } from "./submit";

const UNIQUE_VIOLATION = "23505";

function fail(operation: string, error: PostgrestError): never {
  throw new Error(`${operation} failed: ${error.message}`);
}

/**
 * The attempt store over Supabase. Pass the service-role client: players have no write access
 * to attempts or game days under row-level security, by design.
 */
export function supabaseAttemptStore(db: SupabaseClient): AttemptStore {
  return {
    async hasProfile(userId) {
      const { data, error } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (error) fail("Profile lookup", error);
      return data !== null;
    },

    async ensureGameDay(gameDate) {
      const { error } = await db.rpc("ensure_game_day", { d: gameDate });
      if (error) fail("ensure_game_day", error);
    },

    async gameDayFor(gameDate) {
      const { data, error } = await db.from("game_days").select("challenge_type, pass_target").eq("game_date", gameDate).single();
      if (error) fail("Game day lookup", error);
      const row = data as { challenge_type: string; pass_target: number | string };
      return { challengeType: row.challenge_type, passTarget: Number(row.pass_target) };
    },

    async findAttempt(userId, gameDate) {
      const { data, error } = await db
        .from("attempts")
        .select("submitted_at")
        .eq("user_id", userId)
        .eq("game_date", gameDate)
        .maybeSingle();
      if (error) fail("Attempt lookup", error);
      return data ? { submitted: (data as { submitted_at: string | null }).submitted_at !== null } : null;
    },

    async insertAttempt({ userId, gameDate, seed }) {
      const { data, error } = await db
        .from("attempts")
        .insert({ user_id: userId, game_date: gameDate, seed })
        .select("id")
        .single();
      if (error?.code === UNIQUE_VIOLATION) return "duplicate";
      if (error) fail("Attempt insert", error);
      return { id: (data as { id: string }).id };
    },
  };
}

type AttemptRow = { user_id: string; game_date: string; seed: number; started_at: string; submitted_at: string | null };
type GameDayRow = { challenge_type: string; pass_target: number | string; closed_at: string | null };

/** The submit store over Supabase. Pass the service-role client, as for `supabaseAttemptStore`. */
export function supabaseSubmitStore(db: SupabaseClient): SubmitStore {
  return {
    async findAttempt(attemptId) {
      const { data, error } = await db
        .from("attempts")
        .select("user_id, game_date, seed, started_at, submitted_at")
        .eq("id", attemptId)
        .maybeSingle();
      if (error) fail("Attempt lookup", error);
      if (!data) return null;
      const row = data as AttemptRow;
      return {
        userId: row.user_id,
        gameDate: row.game_date,
        seed: Number(row.seed),
        startedAt: new Date(row.started_at),
        submitted: row.submitted_at !== null,
      };
    },

    async gameDay(gameDate) {
      const { data, error } = await db
        .from("game_days")
        .select("challenge_type, pass_target, closed_at")
        .eq("game_date", gameDate)
        .single();
      if (error) fail("Game day lookup", error);
      const row = data as GameDayRow;
      return { challengeType: row.challenge_type, passTarget: Number(row.pass_target), closed: row.closed_at !== null };
    },

    async recordResult({ attemptId, inputs, score, passed }) {
      const { data, error } = await db.rpc("record_attempt_result", {
        p_attempt_id: attemptId,
        p_inputs: inputs,
        p_score: score,
        p_passed: passed,
      });
      if (error) fail("record_attempt_result", error);
      if (!RECORD_STATUSES.includes(data as RecordStatus)) throw new Error(`record_attempt_result returned "${String(data)}"`);
      return data as RecordStatus;
    },
  };
}
