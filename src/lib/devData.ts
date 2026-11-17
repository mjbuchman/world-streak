// Fake data for play-testing on the LOCAL database (T117): seeding players, closing a day and
// removing the fake players again. Shared by `npm run seed:dev`, `npm run close-day` and the
// admin page's local tools. Callers check that the database is local first (they create, close
// and delete). Relative imports with extensions, so the node scripts can load this file too.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHALLENGE_NAMES } from "../config/challenges.ts";
import { dbInteger, dbNumber } from "./db/numeric.ts";

/** The data of a Supabase reply, or a throw naming the step that failed. */
export function check<T>(operation: string, result: { data: T; error: null } | { data: unknown; error: { message: string } }): T {
  if (result.error) throw new Error(`${operation} failed: ${result.error.message}`);
  return result.data;
}

/** Fake players' emails: `seed-<run>-<n>@example.test`. */
export const FAKE_PLAYER_EMAIL = /^seed-[^@]+@example\.test$/;

export type SeedArgs = {
  players: number;
  passRate: number;
  /** Null means today's game date, which the database works out. */
  date: string | null;
};

/**
 * Which players (0-based) pass: exactly round(players × rate) of them, spread evenly through the
 * batch so a meter watched mid-run already shows roughly the final rate.
 */
export function passingIndices(players: number, passRate: number): Set<number> {
  const passes = Math.round(players * passRate);
  const indices = new Set<number>();
  for (let k = 0; k < passes; k++) indices.add(Math.floor((k * players) / passes));
  return indices;
}

/** A fake score just past the target on the winning or losing side, like real near misses. */
export function nearMissScore(target: number, won: boolean, higherBetter = true): number {
  return won === higherBetter ? target + 1 : Math.max(0, target - 1);
}

/** Which of a day's games (in order) a fake player wins: a bare majority for a passed day, else a bare minority. */
export function gameWins(games: number, passedDay: boolean): boolean[] {
  const majority = Math.floor(games / 2) + 1;
  return Array.from({ length: games }, (_, i) => (passedDay ? i < majority : i >= majority));
}

/** One game of a day's lineup. */
export type LineupGame = { position: number; challenge: string; target: number; higherBetter: boolean };

/** The games' display names, for the scripts' and tools' messages. */
export function lineupNames(challenges: string[]): string {
  return challenges.map((type) => (CHALLENGE_NAMES as Record<string, string>)[type] ?? type).join(", ");
}

/** Starts and records every game of `lineup` in order for one player, so the day ends `passedDay`. */
export async function playDay(
  start: (userId: string, date: string, position: number) => Promise<string>,
  record: (attemptId: string, score: number, passed: boolean) => Promise<string>,
  userId: string,
  date: string,
  lineup: LineupGame[],
  passedDay: boolean,
): Promise<void> {
  const wins = gameWins(lineup.length, passedDay);
  for (const [k, game] of lineup.entries()) {
    const attemptId = await start(userId, date, game.position);
    const status = await record(attemptId, nearMissScore(game.target, wins[k], game.higherBetter), wins[k]);
    if (status !== "recorded") throw new Error(`The result of game ${game.position} on ${date} answered "${status}".`);
  }
}

/** The database steps a seed run needs (see `supabaseSeedDeps`). */
export type SeedDeps = {
  todayGameDate: () => Promise<string>;
  ensureGameDay: (date: string) => Promise<void>;
  /** The day's games in order, with their targets. */
  lineup: (date: string) => Promise<LineupGame[]>;
  /** Creates a confirmed account and its profile; returns the user id. */
  createPlayer: (email: string) => Promise<string>;
  /** Inserts the attempt at game `position` (the counters count it on insert, T17); returns its id. */
  startAttempt: (userId: string, date: string, position: number) => Promise<string>;
  /** record_attempt_result, which only accepts today's game date; returns its status word. */
  recordResult: (attemptId: string, score: number, passed: boolean) => Promise<string>;
  /** Whether the day has been closed (results can no longer change it). */
  dayClosed: (date: string) => Promise<boolean>;
  /**
   * For another day: record_attempt_result_unchecked, which skips the today check but keeps the
   * counters, day result and entry in step (T153); returns its status word.
   */
  recordPastResult: (attemptId: string, score: number, passed: boolean) => Promise<string>;
  log: (message: string) => void;
};

/** Seeds one batch. Every run uses fresh emails (`runId`), so it can be repeated for one date. */
export async function runSeed(args: SeedArgs, runId: string, deps: SeedDeps): Promise<void> {
  const today = await deps.todayGameDate();
  const date = args.date ?? today;
  await deps.ensureGameDay(date);
  // A closed day's outcome is final; seeding it would change its counters after the fact.
  if (await deps.dayClosed(date)) throw new Error(`Game day ${date} is already closed; seed an open day instead.`);
  const lineup = await deps.lineup(date);
  if (lineup.length === 0) throw new Error(`Game day ${date} has no games.`);
  const passing = passingIndices(args.players, args.passRate);
  const record = date === today ? deps.recordResult : deps.recordPastResult;

  for (let i = 0; i < args.players; i++) {
    const userId = await deps.createPlayer(`seed-${runId}-${i + 1}@example.test`);
    await playDay(deps.startAttempt, record, userId, date, lineup, passing.has(i));
  }
  const names = lineupNames(lineup.map((game) => game.challenge));
  deps.log(`Seeded ${args.players} players for ${date} (${names}): ${passing.size} passed the day, ${args.players - passing.size} did not.`);
}

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** The seed steps over a service-role client to the local database. */
export function supabaseSeedDeps(db: SupabaseClient, log: (message: string) => void = console.log): SeedDeps {
  type Direction = { direction: string };
  const record = async (fn: string, attemptId: string, score: number, passed: boolean) =>
    check(fn, await db.rpc(fn, { p_attempt_id: attemptId, p_inputs: { seeded: true }, p_score: score, p_passed: passed })) as string;
  return {
    async todayGameDate() {
      return check("game_date_at", await db.rpc("game_date_at", { ts: new Date().toISOString() })) as string;
    },
    async ensureGameDay(date) {
      check("ensure_game_day", await db.rpc("ensure_game_day", { d: date }));
    },
    async lineup(date) {
      const rows = check(
        "Lineup lookup",
        await db
          .from("game_day_games")
          .select("position, challenge_type, pass_target, challenge_types(direction)")
          .eq("game_date", date)
          .order("position"),
      ) as { position: unknown; challenge_type: string; pass_target: unknown; challenge_types: Direction | Direction[] | null }[];
      return rows.map((row) => ({
        position: dbInteger(row.position, "position"),
        challenge: row.challenge_type,
        // Strict, like the app: a malformed target would otherwise seed NaN scores.
        target: dbNumber(row.pass_target, "pass_target"),
        // One row per game; an untyped client types the join as a list, PostgREST sends an object.
        higherBetter: [row.challenge_types].flat()[0]?.direction !== "lower-better",
      }));
    },
    async createPlayer(email) {
      const created = await db.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`Creating ${email} failed: ${created.error?.message}`);
      const id = created.data.user.id;
      check("Profile insert", await db.from("profiles").insert({ id, birth_date: "1990-01-01", country: "US" }));
      return id;
    },
    async startAttempt(userId, date, position) {
      const row = check(
        "Attempt insert",
        await db.from("attempts").insert({ user_id: userId, game_date: date, position, seed: randomSeed() }).select("id").single(),
      );
      return (row as { id: string }).id;
    },
    recordResult: (attemptId, score, passed) => record("record_attempt_result", attemptId, score, passed),
    recordPastResult: (attemptId, score, passed) => record("record_attempt_result_unchecked", attemptId, score, passed),
    async dayClosed(date) {
      const row = check("Game day lookup", await db.from("game_days").select("closed_at").eq("game_date", date).single());
      return (row as { closed_at: string | null }).closed_at !== null;
    },
    log,
  };
}

export type CloseDayDeps = {
  closeDay(date: string): Promise<string>;
  /** The day's games in order (none for a day without a lineup). */
  lineup(date: string): Promise<string[]>;
  worldStreak(): Promise<{ current: number; best: number }>;
};

/** Closes `date` and returns the line to show. */
export async function runCloseDay(date: string, deps: CloseDayDeps): Promise<string> {
  const outcome = await deps.closeDay(date);
  const lineup = await deps.lineup(date);
  const streak = await deps.worldStreak();
  return `${date} (${lineupNames(lineup)}) ${outcome}. World streak: ${streak.current} (best ${streak.best}).`;
}

export function supabaseCloseDayDeps(db: SupabaseClient): CloseDayDeps {
  return {
    async closeDay(date) {
      const outcome = check("Close", await db.rpc("close_game_day", { d: date }));
      if (outcome !== "survived" && outcome !== "broken") throw new Error(`Unexpected outcome ${JSON.stringify(outcome)}`);
      return outcome;
    },
    async lineup(date) {
      return (check("Lineup lookup", await db.rpc("lineup_of", { d: date })) as string[] | null) ?? [];
    },
    async worldStreak() {
      const row = check("World streak lookup", await db.rpc("world_streak").single()) as { current: unknown; best: unknown };
      return { current: dbInteger(row.current, "current"), best: dbInteger(row.best, "best") };
    },
  };
}

/** Auth's page size when listing users. */
const USERS_PER_PAGE = 1000;

/**
 * Deletes every fake player (their profiles and attempts go with them), then recounts each open
 * day's counters from the attempts left, since a deleted attempt does not uncount itself. Closed
 * days keep their counters: their outcome is already final. Returns how many were removed.
 */
export async function removeFakePlayers(db: SupabaseClient): Promise<number> {
  const fake: string[] = [];
  for (let page = 1; ; page++) {
    const listed = await db.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (listed.error) throw new Error(`Listing users failed: ${listed.error.message}`);
    const { users } = listed.data;
    fake.push(...users.filter((user) => FAKE_PLAYER_EMAIL.test(user.email ?? "")).map((user) => user.id));
    if (users.length < USERS_PER_PAGE) break;
  }
  for (const id of fake) {
    const deleted = await db.auth.admin.deleteUser(id);
    if (deleted.error) throw new Error(`Deleting a fake player failed: ${deleted.error.message}`);
  }

  const open = check("Open day lookup", await db.from("game_days").select("game_date").is("closed_at", null)) as { game_date: string }[];
  // One database call per day, so a start in progress cannot lose its count (T129).
  for (const { game_date } of open) check("Recount", await db.rpc("recount_game_day", { d: game_date }));
  return fake.length;
}
