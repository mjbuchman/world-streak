import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { AttemptStore } from "./start";

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

    async challengeTypeFor(gameDate) {
      const { data, error } = await db.from("game_days").select("challenge_type").eq("game_date", gameDate).single();
      if (error) fail("Game day lookup", error);
      return (data as { challenge_type: string }).challenge_type;
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
