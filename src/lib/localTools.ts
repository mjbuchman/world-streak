// The admin page's local tools (T116): play-testing shortcuts for what used to be SQL commands.
// They change or delete data freely, so they run only against the local Supabase, for admins.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHALLENGE_TYPES, type ChallengeType } from "@/challenges/shared/types";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { isAdmin } from "@/lib/admin";
import { dbInteger, dbNumber } from "@/lib/db/numeric";
import { check, removeFakePlayers, runCloseDay, runSeed, supabaseCloseDayDeps, supabaseSeedDeps, type SeedArgs } from "@/lib/devData";
import { gameDateAt } from "@/lib/gameDay";
import { dayLabel } from "@/lib/streak/streak";
import type { Database } from "@/lib/supabase/database.types";
import { isLocalSupabaseUrl } from "@/lib/supabase/local";

export type ToolState = { ok: boolean; message: string };

type Db = Pick<SupabaseClient<Database>, "from" | "rpc">;
type Caller = Pick<SupabaseClient<Database>, "rpc" | "auth">;

/** Each fake player takes a moment to create, so one press seeds at most this many (T117). */
export const MAX_SEED_PLAYERS = 500;

/** The pool a fresh database starts with (the migration's default, T150): every game. */
export const DEFAULT_POOL: readonly ChallengeType[] = CHALLENGE_TYPES;

/** Whether the tools may run: only when the app talks to the local Supabase (as the scripts). */
export function localToolsEnabled(url = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  return isLocalSupabaseUrl(url);
}

const refuse = (message: string): ToolState => ({ ok: false, message });
const done = (message: string): ToolState => ({ ok: true, message });

const gameDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Unknown game day.");
const game = z.enum(CHALLENGE_TYPES, "Unknown challenge.");
const toolSchema = z.discriminatedUnion("tool", [
  z
    .object({ tool: z.literal("set-lineup"), gameDate, game1: game, game2: game, game3: game })
    .refine(({ game1, game2, game3 }) => new Set([game1, game2, game3]).size === 3, "Pick three different games."),
  z.object({ tool: z.literal("clear-my-day") }),
  z.object({ tool: z.literal("reset-day"), gameDate }),
  z.object({ tool: z.literal("restore-pool") }),
  z.object({
    tool: z.literal("seed"),
    gameDate,
    players: z.coerce
      .number()
      .int("Players must be a whole number.")
      .min(1, `Players must be from 1 to ${MAX_SEED_PLAYERS}.`)
      .max(MAX_SEED_PLAYERS, `Players must be from 1 to ${MAX_SEED_PLAYERS}.`),
    passPercent: z.coerce.number().min(0, "The pass rate must be from 0% to 100%.").max(100, "The pass rate must be from 0% to 100%."),
  }),
  z.object({ tool: z.literal("close-day"), gameDate }),
  z.object({ tool: z.literal("remove-fake-players") }),
]);

/** A day's closed flag, threshold and whether anybody has started it; null if the day does not exist. */
async function dayStatus(db: Db, date: string): Promise<{ closed: boolean; started: boolean; threshold: unknown } | null> {
  const [day, counters] = await Promise.all([
    db.from("game_days").select("closed_at, survival_threshold").eq("game_date", date).maybeSingle(),
    db.from("game_day_counters").select("attempts").eq("game_date", date).maybeSingle(),
  ]);
  const dayRow = check("Game day lookup", day);
  const counterRow = check("Counters lookup", counters);
  if (!dayRow) return null;
  const attempts = counterRow ? dbInteger(counterRow.attempts, "attempts") : 0;
  return { closed: dayRow.closed_at !== null, started: attempts > 0, threshold: dayRow.survival_threshold };
}

/**
 * Gives an open day nobody has started three games, each with its usual pass target, through the
 * admin editor's own save (T161), which marks the day edited so the lineup rule leaves it alone.
 */
async function setLineup(db: Db, date: string, games: ChallengeType[]): Promise<ToolState> {
  check("Preparing the game day", await db.rpc("ensure_game_day", { d: date }));
  const status = await dayStatus(db, date);
  if (!status) return refuse("Unknown game day.");
  if (status.closed) return refuse(`${dayLabel(date)} has closed, so its lineup can no longer change.`);
  if (status.started) return refuse(`${dayLabel(date)} has started. Reset it first, then change its lineup.`);

  const streak = await db.rpc("world_streak").single();
  check("World streak lookup", streak);
  const current = dbInteger(streak.data?.current, "current");
  const targets = await Promise.all(
    games.map(async (challenge) =>
      dbNumber(check("Pass target lookup", await db.rpc("pass_target_for", { challenge, d: date, streak: current })), "pass_target"),
    ),
  );
  const params = { d: date, games, targets, threshold: dbNumber(status.threshold, "survival_threshold") };
  if (!check("Saving the lineup", await db.rpc("save_game_day", params))) {
    return refuse(`${dayLabel(date)} could not be saved; it may have closed.`);
  }
  return done(`${dayLabel(date)} is now ${games.map((type) => CHALLENGE_NAMES[type]).join(", ")}.`);
}

/**
 * Deletes the caller's own games today. Their day result goes with them (a trigger), and the
 * recount takes both out of the day's counters.
 */
async function clearMyDay(caller: Caller, db: Db, now: Date): Promise<ToolState> {
  const { data: auth, error: authError } = await caller.auth.getUser();
  if (authError || !auth.user) return refuse("Sign in again, then try once more.");
  const today = gameDateAt(now);

  const deleted = await db.from("attempts").delete().eq("user_id", auth.user.id).eq("game_date", today).select("id");
  const games = check("Deleting your games", deleted);
  if (games.length === 0) return refuse("You have not played today.");
  check("Recounting the day", await db.rpc("recount_game_day", { d: today }));
  return done(`Your day is cleared (${games.length} ${games.length === 1 ? "game" : "games"}). You can play it again.`);
}

/**
 * Empties an open day: no attempts or day results, recounted to zero, and back on the lineup
 * rule. A closed day is refused, because the world streak already counts its outcome.
 */
async function resetDay(db: Db, date: string): Promise<ToolState> {
  const status = await dayStatus(db, date);
  if (!status) return refuse("Unknown game day.");
  if (status.closed) return refuse(`${dayLabel(date)} has closed and the streak counts it, so it cannot be reset.`);

  const deleted = await db.from("attempts").delete().eq("game_date", date);
  check("Deleting the attempts", deleted);
  check("Recounting the day", await db.rpc("recount_game_day", { d: date }));
  const unedited = await db.from("game_days").update({ edited: false }).eq("game_date", date).is("closed_at", null);
  check("Clearing the edit", unedited);
  // Now untouched, so this sets the lineup rule's games and targets again.
  const ensured = await db.rpc("ensure_game_day", { d: date });
  check("Preparing the game day", ensured);
  return done(`${dayLabel(date)} is reset: no attempts, and it follows the lineup rule again.`);
}

async function restorePool(db: Db): Promise<ToolState> {
  const saved = await db.from("game_settings").update({ pool: [...DEFAULT_POOL] }).eq("id", true);
  check("Saving the pool", saved);
  return done(`The pool is back to ${DEFAULT_POOL.map((type) => CHALLENGE_NAMES[type]).join(", ")}.`);
}

/**
 * Runs the tool a local-tools form asks for. `caller` is the signed-in admin's own (cookie)
 * client, for the admin check and their user id; `db` is the service role, since the tools reach
 * past row-level security (and only ever run locally).
 */
export async function runLocalTool(caller: Caller, db: Db, form: FormData, now: Date, data: DevData): Promise<ToolState> {
  if (!localToolsEnabled()) return refuse("Local tools work only with the local Supabase.");
  if (!(await isAdmin(caller))) return refuse("Only admins can use local tools.");

  const parsed = toolSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return refuse(parsed.error.issues[0].message);
  // One rule for every tool: a failed step comes back as a message, never an error page.
  try {
    return await runTool(caller, db, parsed.data, now, data);
  } catch (error) {
    return refuse(error instanceof Error ? error.message : String(error));
  }
}

async function runTool(caller: Caller, db: Db, input: z.infer<typeof toolSchema>, now: Date, data: DevData): Promise<ToolState> {
  switch (input.tool) {
    case "set-lineup":
      return setLineup(db, input.gameDate, [input.game1, input.game2, input.game3]);
    case "clear-my-day":
      return clearMyDay(caller, db, now);
    case "reset-day":
      return resetDay(db, input.gameDate);
    case "restore-pool":
      return restorePool(db);
    case "seed":
      return seedPlayers(input.gameDate, input.players, input.passPercent / 100, data);
    case "close-day":
      return closeDay(input.gameDate, data, now);
    case "remove-fake-players":
      return done(`Removed ${await data.removeFakePlayers()} fake players.`);
  }
}

/** The fake-data steps (`src/lib/devData.ts`), injectable for tests. */
export type DevData = {
  seed(args: SeedArgs): Promise<string>;
  closeDay(date: string): Promise<string>;
  removeFakePlayers(): Promise<number>;
};

/** The real steps, over the service-role client. Each seed run gets fresh emails. */
export function supabaseDevData(db: SupabaseClient): DevData {
  return {
    async seed(args) {
      let line = "";
      await runSeed(args, Date.now().toString(36), supabaseSeedDeps(db, (message) => (line = message)));
      return line;
    },
    closeDay: (date) => runCloseDay(date, supabaseCloseDayDeps(db)),
    removeFakePlayers: () => removeFakePlayers(db),
  };
}

async function seedPlayers(date: string, players: number, passRate: number, data: DevData): Promise<ToolState> {
  return done(await data.seed({ players, passRate, date }));
}

async function closeDay(date: string, data: DevData, now: Date): Promise<ToolState> {
  // The database refuses a day before its deadline too; this says why in plain words.
  if (date >= gameDateAt(now)) return refuse(`${dayLabel(date)} has not reached its deadline yet, so it cannot close.`);
  return done(await data.closeDay(date));
}
