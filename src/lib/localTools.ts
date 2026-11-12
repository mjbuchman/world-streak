// The admin page's local tools (T116): play-testing shortcuts for what used to be SQL commands.
// They change or delete data freely, so they run only against the local Supabase, for admins.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHALLENGE_TYPES, type ChallengeType } from "@/challenges/shared/types";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { isAdmin } from "@/lib/admin";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import { gameDateAt } from "@/lib/gameDay";
import { dayLabel } from "@/lib/streak/streak";
import { isLocalSupabaseUrl } from "@/lib/supabase/local";

export type ToolState = { ok: boolean; message: string };

type Db = Pick<SupabaseClient, "from" | "rpc">;
type Caller = Pick<SupabaseClient, "rpc" | "auth">;

/** The rotation a fresh database starts with (the migration's default). */
export const DEFAULT_ROTATION: readonly ChallengeType[] = CHALLENGE_TYPES;

/** Whether the tools may run: only when the app talks to the local Supabase (as the scripts). */
export function localToolsEnabled(url = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  return isLocalSupabaseUrl(url);
}

const refuse = (message: string): ToolState => ({ ok: false, message });
const done = (message: string): ToolState => ({ ok: true, message });

const failed = (step: string, error: { message: string }) => new Error(`${step} failed: ${error.message}`);

const gameDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Unknown game day.");
const toolSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("set-challenge"), gameDate, challenge: z.enum(CHALLENGE_TYPES, "Unknown challenge.") }),
  z.object({ tool: z.literal("clear-my-attempt") }),
  z.object({ tool: z.literal("reset-day"), gameDate }),
  z.object({ tool: z.literal("restore-rotation") }),
]);

/** A day's closed flag and whether anybody has started it; null if the day does not exist. */
async function dayStatus(db: Db, date: string): Promise<{ closed: boolean; started: boolean } | null> {
  const [day, counters] = await Promise.all([
    db.from("game_days").select("closed_at").eq("game_date", date).maybeSingle(),
    db.from("game_day_counters").select("attempts").eq("game_date", date).maybeSingle(),
  ]);
  if (day.error) throw failed("Game day lookup", day.error);
  if (counters.error) throw failed("Counters lookup", counters.error);
  if (!day.data) return null;
  const attempts = counters.data ? dbInteger((counters.data as { attempts: unknown }).attempts, "attempts") : 0;
  return { closed: (day.data as { closed_at: string | null }).closed_at !== null, started: attempts > 0 };
}

/** Gives an open day nobody has started another challenge, with that challenge's pass target. */
async function setChallenge(db: Db, date: string, challenge: ChallengeType): Promise<ToolState> {
  const ensured = await db.rpc("ensure_game_day", { d: date });
  if (ensured.error) throw failed("Preparing the game day", ensured.error);
  const status = await dayStatus(db, date);
  if (!status) return refuse("Unknown game day.");
  if (status.closed) return refuse(`${dayLabel(date)} has closed, so its challenge can no longer change.`);
  if (status.started) return refuse(`${dayLabel(date)} has started. Reset it first, then change its challenge.`);

  const streak = await db.rpc("world_streak").single();
  if (streak.error) throw failed("World streak lookup", streak.error);
  const current = dbInteger((streak.data as { current: unknown }).current, "current");
  const target = await db.rpc("pass_target_for", { challenge, d: date, streak: current });
  if (target.error) throw failed("Pass target lookup", target.error);

  // Edited, so the rotation leaves it alone.
  const saved = await db
    .from("game_days")
    .update({ challenge_type: challenge, pass_target: dbNumber(target.data, "pass_target"), edited: true })
    .eq("game_date", date)
    .is("closed_at", null);
  if (saved.error) throw failed("Saving the challenge", saved.error);
  return done(`${dayLabel(date)} is now ${CHALLENGE_NAMES[challenge]}.`);
}

/** Deletes the caller's own attempt today and takes it back out of the day's counters. */
async function clearMyAttempt(caller: Caller, db: Db, now: Date): Promise<ToolState> {
  const { data: auth, error: authError } = await caller.auth.getUser();
  if (authError || !auth.user) return refuse("Sign in again, then try once more.");
  const today = gameDateAt(now);

  const found = await db
    .from("attempts")
    .select("id, passed, counted_weight")
    .eq("user_id", auth.user.id)
    .eq("game_date", today)
    .maybeSingle();
  if (found.error) throw failed("Attempt lookup", found.error);
  if (!found.data) return refuse("You have no attempt today.");
  const attempt = found.data as { id: string; passed: boolean | null; counted_weight: unknown };

  const counters = await db
    .from("game_day_counters")
    .select("attempts, passes, weighted_attempts, weighted_passes")
    .eq("game_date", today)
    .single();
  if (counters.error) throw failed("Counters lookup", counters.error);
  const row = counters.data as Record<"attempts" | "passes" | "weighted_attempts" | "weighted_passes", unknown>;
  // Rows from before weights were stamped count as weight 0 (T17), so they take nothing back.
  const weight = attempt.counted_weight === null ? 0 : dbNumber(attempt.counted_weight, "counted_weight");
  const passed = attempt.passed === true;

  const deleted = await db.from("attempts").delete().eq("id", attempt.id);
  if (deleted.error) throw failed("Deleting the attempt", deleted.error);
  // Local only, one person at a time: this read-then-write cannot race another change.
  const updated = await db
    .from("game_day_counters")
    .update({
      attempts: Math.max(0, dbInteger(row.attempts, "attempts") - 1),
      passes: Math.max(0, dbInteger(row.passes, "passes") - (passed ? 1 : 0)),
      weighted_attempts: Math.max(0, dbNumber(row.weighted_attempts, "weighted_attempts") - weight),
      weighted_passes: Math.max(0, dbNumber(row.weighted_passes, "weighted_passes") - (passed ? weight : 0)),
    })
    .eq("game_date", today);
  if (updated.error) throw failed("Updating the counters", updated.error);
  return done("Your attempt today is gone. You can play again.");
}

/**
 * Empties an open day: no attempts, zero counters, and back on the rotation. A closed day is
 * refused, because the world streak already counts its outcome.
 */
async function resetDay(db: Db, date: string): Promise<ToolState> {
  const status = await dayStatus(db, date);
  if (!status) return refuse("Unknown game day.");
  if (status.closed) return refuse(`${dayLabel(date)} has closed and the streak counts it, so it cannot be reset.`);

  const deleted = await db.from("attempts").delete().eq("game_date", date);
  if (deleted.error) throw failed("Deleting the attempts", deleted.error);
  const zeroed = await db
    .from("game_day_counters")
    .update({ attempts: 0, passes: 0, weighted_attempts: 0, weighted_passes: 0 })
    .eq("game_date", date);
  if (zeroed.error) throw failed("Clearing the counters", zeroed.error);
  const unedited = await db.from("game_days").update({ edited: false }).eq("game_date", date).is("closed_at", null);
  if (unedited.error) throw failed("Clearing the edit", unedited.error);
  // Now untouched, so this sets the rotation's challenge and target again.
  const ensured = await db.rpc("ensure_game_day", { d: date });
  if (ensured.error) throw failed("Preparing the game day", ensured.error);
  return done(`${dayLabel(date)} is reset: no attempts, and it follows the rotation again.`);
}

async function restoreRotation(db: Db): Promise<ToolState> {
  const saved = await db.from("game_settings").update({ rotation: DEFAULT_ROTATION }).eq("id", true);
  if (saved.error) throw failed("Saving the rotation", saved.error);
  return done(`The rotation is back to ${DEFAULT_ROTATION.map((type) => CHALLENGE_NAMES[type]).join(", ")}.`);
}

/**
 * Runs the tool a local-tools form asks for. `caller` is the signed-in admin's own (cookie)
 * client, for the admin check and their user id; `db` is the service role, since the tools reach
 * past row-level security (and only ever run locally).
 */
export async function runLocalTool(caller: Caller, db: Db, form: FormData, now: Date): Promise<ToolState> {
  if (!localToolsEnabled()) return refuse("Local tools work only with the local Supabase.");
  if (!(await isAdmin(caller))) return refuse("Only admins can use local tools.");

  const parsed = toolSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return refuse(parsed.error.issues[0].message);
  const input = parsed.data;
  switch (input.tool) {
    case "set-challenge":
      return setChallenge(db, input.gameDate, input.challenge);
    case "clear-my-attempt":
      return clearMyAttempt(caller, db, now);
    case "reset-day":
      return resetDay(db, input.gameDate);
    case "restore-rotation":
      return restoreRotation(db);
  }
}
