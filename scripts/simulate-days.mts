/**
 * Plays and closes a run of game days on the LOCAL database, to play-test a prize cycle and the
 * draw: `npm run simulate:days -- --from 2027-01-01 --days 30 --players 50 --pass-rate 0.8`.
 * The same fake players play every day; each day closes in order, whatever its deadline (T37,
 * option A in docs/DECISIONS.md). Afterwards `npm run db:reset` puts the database back.
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (the npm script
 * loads it) and refuses to run unless the URL is localhost.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { check, nearMissScore, passingIndices, supabaseCloseDayDeps, supabaseSeedDeps } from "../src/lib/devData.ts";
import { addDays, isCalendarDate } from "./lib/dates.mts";
import { assertLocalSupabaseUrl, createServiceClient } from "./lib/localSupabase.mts";

export type SimulateArgs = { from: string; days: number; players: number; passRate: number };

const MAX_DAYS = 366;
const MAX_PLAYERS = 1_000;

function wholeNumber(value: string | undefined, name: string, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`--${name} must be a whole number from 1 to ${max}.`);
  return n;
}

/** Reads `--from YYYY-MM-DD --days N --players N --pass-rate R`; throws a one-line message on bad input. */
export function parseSimulateArgs(argv: string[]): SimulateArgs {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      from: { type: "string" },
      days: { type: "string" },
      players: { type: "string" },
      "pass-rate": { type: "string" },
    },
  });
  if (values.from === undefined || !isCalendarDate(values.from)) throw new Error("--from must be a real date as YYYY-MM-DD.");
  const passRate = Number(values["pass-rate"]);
  if (values["pass-rate"] === undefined || !Number.isFinite(passRate) || passRate < 0 || passRate > 1) {
    throw new Error("--pass-rate must be a number from 0 to 1, for example 0.8.");
  }
  return {
    from: values.from,
    days: wholeNumber(values.days, "days", MAX_DAYS),
    players: wholeNumber(values.players, "players", MAX_PLAYERS),
    passRate,
  };
}

/** The database steps a simulation needs (see `supabaseSimulateDeps`). */
export type SimulateDeps = {
  /** The earliest open game day before `date`, with how many attempts it has, or null. */
  earliestOpenBefore: (date: string) => Promise<{ date: string; attempts: number } | null>;
  /** The earliest closed game day on or after `date`, or null. */
  firstClosedFrom: (date: string) => Promise<string | null>;
  ensureGameDay: (date: string) => Promise<void>;
  passTarget: (date: string) => Promise<number>;
  createPlayer: (email: string) => Promise<string>;
  startAttempt: (userId: string, date: string) => Promise<string>;
  /** record_attempt_result_unchecked; returns its status word. */
  recordResult: (attemptId: string, score: number, passed: boolean) => Promise<string>;
  /** close_game_day_unchecked; returns the outcome. */
  closeDay: (date: string) => Promise<string>;
  worldStreak: () => Promise<{ current: number; best: number }>;
  log: (message: string) => void;
};

/**
 * Closes the open days before `from` (each close opens the next), so the simulated days can
 * close in order. Only empty days: a day someone played is real play-testing, kept for db:reset.
 */
async function closeEmptyDaysBefore(from: string, deps: SimulateDeps): Promise<number> {
  let closed = 0;
  for (let open = await deps.earliestOpenBefore(from); open; open = await deps.earliestOpenBefore(from)) {
    if (open.attempts > 0) {
      throw new Error(`Game day ${open.date} is open and has attempts; run \`npm run db:reset\` first, or pick an earlier --from.`);
    }
    await deps.closeDay(open.date);
    closed += 1;
  }
  return closed;
}

/** The whole simulation. Fake players use fresh emails (`runId`), which remove-fake-players matches. */
export async function runSimulation(args: SimulateArgs, runId: string, deps: SimulateDeps): Promise<void> {
  // A day closed on or after --from would make the run close out of order.
  const closedLater = await deps.firstClosedFrom(args.from);
  if (closedLater !== null) {
    throw new Error(`Game day ${closedLater} is already closed; run \`npm run db:reset\` first, or pick a later --from.`);
  }
  const emptied = await closeEmptyDaysBefore(args.from, deps);
  if (emptied > 0) deps.log(`Closed ${emptied} empty days before ${args.from} (broken).`);

  const players: string[] = [];
  for (let i = 0; i < args.players; i++) players.push(await deps.createPlayer(`seed-${runId}-${i + 1}@example.test`));
  const passing = passingIndices(args.players, args.passRate);

  for (let day = 0; day < args.days; day++) {
    const date = addDays(args.from, day);
    await deps.ensureGameDay(date);
    const target = await deps.passTarget(date);
    for (const [i, userId] of players.entries()) {
      const attemptId = await deps.startAttempt(userId, date);
      const passed = passing.has(i);
      const status = await deps.recordResult(attemptId, nearMissScore(target, passed), passed);
      if (status !== "recorded") throw new Error(`The result for player ${i + 1} on ${date} answered "${status}".`);
    }
    deps.log(`${date} ${await deps.closeDay(date)}.`);
  }
  const streak = await deps.worldStreak();
  deps.log(`Simulated ${args.days} days with ${args.players} players. World streak: ${streak.current} (best ${streak.best}).`);
}

/** The simulation steps over a service-role client to the local database. */
export function supabaseSimulateDeps(db: SupabaseClient, log: (message: string) => void = console.log): SimulateDeps {
  const seed = supabaseSeedDeps(db, log);
  return {
    async earliestOpenBefore(date) {
      const rows = check(
        "Open day lookup",
        await db.from("game_days").select("game_date").is("closed_at", null).lt("game_date", date).order("game_date").limit(1),
      ) as { game_date: string }[];
      if (rows.length === 0) return null;
      const open = rows[0].game_date;
      const counted = await db.from("attempts").select("id", { count: "exact", head: true }).eq("game_date", open);
      check("Attempt count", counted);
      return { date: open, attempts: counted.count ?? 0 };
    },
    async firstClosedFrom(date) {
      const rows = check(
        "Closed day lookup",
        await db.from("game_days").select("game_date").not("closed_at", "is", null).gte("game_date", date).order("game_date").limit(1),
      ) as { game_date: string }[];
      return rows[0]?.game_date ?? null;
    },
    ensureGameDay: seed.ensureGameDay,
    passTarget: seed.passTarget,
    createPlayer: seed.createPlayer,
    startAttempt: seed.startAttempt,
    async recordResult(attemptId, score, passed) {
      const params = { p_attempt_id: attemptId, p_inputs: { seeded: true }, p_score: score, p_passed: passed };
      return check("record_attempt_result_unchecked", await db.rpc("record_attempt_result_unchecked", params)) as string;
    },
    async closeDay(date) {
      const outcome = check("Close", await db.rpc("close_game_day_unchecked", { d: date }));
      if (outcome !== "survived" && outcome !== "broken") throw new Error(`Unexpected outcome ${JSON.stringify(outcome)}`);
      return outcome;
    },
    worldStreak: supabaseCloseDayDeps(db).worldStreak,
    log,
  };
}

type MakeClient = (url: string, serviceRoleKey: string) => SupabaseClient;

/**
 * The whole command. The localhost guard runs first, before the key is read or any client is
 * made, so the script can never reach a real project.
 */
export async function main(
  env: Record<string, string | undefined>,
  argv: string[],
  makeClient: MakeClient = createServiceClient,
  log: (line: string) => void = console.log,
): Promise<void> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  assertLocalSupabaseUrl(url, "simulate game days", "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing; copy it from `npx supabase status` into .env.local.");
  const args = parseSimulateArgs(argv);
  await runSimulation(args, `sim${Date.now().toString(36)}`, supabaseSimulateDeps(makeClient(url, serviceRoleKey), log));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.env, process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
