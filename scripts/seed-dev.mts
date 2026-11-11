/**
 * Creates a batch of fake players with submitted attempts on the LOCAL database, so the meter
 * has something to show: `npm run seed:dev -- --players 200 --pass-rate 0.7 [--date YYYY-MM-DD]`.
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (the npm script
 * loads it) and refuses to run unless the URL is localhost, because it creates accounts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { dbNumber } from "../src/lib/db/numeric.ts";
import { assertLocalSupabaseUrl, check, createServiceClient } from "./lib/localSupabase.mts";

/** At most this many players per run, so a typo cannot create a million accounts. */
const MAX_PLAYERS = 10_000;

export type SeedArgs = {
  players: number;
  passRate: number;
  /** Null means today's game date, which the database works out. */
  date: string | null;
};

/** Reads `--players N --pass-rate R [--date YYYY-MM-DD]`; throws a one-line message on bad input. */
export function parseSeedArgs(argv: string[]): SeedArgs {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: { players: { type: "string" }, "pass-rate": { type: "string" }, date: { type: "string" } },
  });

  const players = Number(values.players);
  if (!Number.isInteger(players) || players < 1 || players > MAX_PLAYERS) {
    throw new Error(`--players must be a whole number from 1 to ${MAX_PLAYERS}.`);
  }
  const passRate = Number(values["pass-rate"]);
  if (values["pass-rate"] === undefined || !Number.isFinite(passRate) || passRate < 0 || passRate > 1) {
    throw new Error("--pass-rate must be a number from 0 to 1, for example 0.7.");
  }
  const date = values.date ?? null;
  if (date !== null && !isCalendarDate(date)) throw new Error("--date must be a real date as YYYY-MM-DD.");
  return { players, passRate, date };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

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

/** The database steps a seed run needs (see `supabaseSeedDeps`). */
export type SeedDeps = {
  todayGameDate: () => Promise<string>;
  ensureGameDay: (date: string) => Promise<void>;
  passTarget: (date: string) => Promise<number>;
  /** Creates a confirmed account and its profile; returns the user id. */
  createPlayer: (email: string) => Promise<string>;
  /** Inserts the attempt (the counters count it on insert, T17); returns its id. */
  startAttempt: (userId: string, date: string) => Promise<string>;
  /** record_attempt_result, which only accepts today's game date; returns its status word. */
  recordResult: (attemptId: string, score: number, passed: boolean) => Promise<string>;
  /** Whether the day has been closed (results can no longer change it). */
  dayClosed: (date: string) => Promise<boolean>;
  /** For another day: write the result directly, since record_attempt_result refuses it. */
  writePastResult: (attemptId: string, score: number, passed: boolean) => Promise<void>;
  /**
   * For another day: add one pass, with the attempt's own counted weight, to the day's counters,
   * as record_attempt_result would have.
   */
  addPastPass: (date: string, attemptId: string) => Promise<void>;
  log: (message: string) => void;
};

/** Seeds one batch. Every run uses fresh emails (`runId`), so it can be repeated for one date. */
export async function runSeed(args: SeedArgs, runId: string, deps: SeedDeps): Promise<void> {
  const today = await deps.todayGameDate();
  const date = args.date ?? today;
  await deps.ensureGameDay(date);
  // A closed day's outcome is final; seeding it would change its counters after the fact.
  if (await deps.dayClosed(date)) throw new Error(`Game day ${date} is already closed; seed an open day instead.`);
  const target = await deps.passTarget(date);
  const passing = passingIndices(args.players, args.passRate);

  for (let i = 0; i < args.players; i++) {
    const userId = await deps.createPlayer(`seed-${runId}-${i + 1}@example.test`);
    const attemptId = await deps.startAttempt(userId, date);
    const passed = passing.has(i);
    // Just over or just under the target, like real near misses.
    const score = passed ? target + 1 : Math.max(0, target - 1);
    if (date === today) {
      const status = await deps.recordResult(attemptId, score, passed);
      if (status !== "recorded") throw new Error(`record_attempt_result answered "${status}" for player ${i + 1}.`);
    } else {
      // Each pass right after its result, so a run that stops halfway leaves at most one out of step.
      await deps.writePastResult(attemptId, score, passed);
      if (passed) await deps.addPastPass(date, attemptId);
    }
  }
  deps.log(`Seeded ${args.players} players for ${date}: ${passing.size} passed, ${args.players - passing.size} did not.`);
}


const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** The seed steps over a service-role client to the local database. */
export function supabaseSeedDeps(db: SupabaseClient): SeedDeps {
  return {
    async todayGameDate() {
      return check("game_date_at", await db.rpc("game_date_at", { ts: new Date().toISOString() })) as string;
    },
    async ensureGameDay(date) {
      check("ensure_game_day", await db.rpc("ensure_game_day", { d: date }));
    },
    async passTarget(date) {
      const row = check("Game day lookup", await db.from("game_days").select("pass_target").eq("game_date", date).single());
      // Strict, like the app: a malformed target would otherwise seed NaN scores.
      return dbNumber((row as { pass_target: unknown }).pass_target, "pass_target");
    },
    async createPlayer(email) {
      const created = await db.auth.admin.createUser({ email, password: crypto.randomUUID(), email_confirm: true });
      if (created.error || !created.data.user) throw new Error(`Creating ${email} failed: ${created.error?.message}`);
      const id = created.data.user.id;
      check("Profile insert", await db.from("profiles").insert({ id, birth_date: "1990-01-01", country: "US" }));
      return id;
    },
    async startAttempt(userId, date) {
      const row = check(
        "Attempt insert",
        await db.from("attempts").insert({ user_id: userId, game_date: date, seed: randomSeed() }).select("id").single(),
      );
      return (row as { id: string }).id;
    },
    async recordResult(attemptId, score, passed) {
      const inputs = { seeded: true };
      return check(
        "record_attempt_result",
        await db.rpc("record_attempt_result", { p_attempt_id: attemptId, p_inputs: inputs, p_score: score, p_passed: passed }),
      ) as string;
    },
    async dayClosed(date) {
      const row = check("Game day lookup", await db.from("game_days").select("closed_at").eq("game_date", date).single());
      return (row as { closed_at: string | null }).closed_at !== null;
    },
    async writePastResult(attemptId, score, passed) {
      const update = { inputs: { seeded: true }, score, passed, submitted_at: new Date().toISOString() };
      check("Result update", await db.from("attempts").update(update).eq("id", attemptId));
    },
    async addPastPass(date, attemptId) {
      // The same weight the start was counted with (T17), like record_attempt_result. A dev
      // script runs one at a time, so this read-then-write cannot race another seed run.
      const attempt = check(
        "Attempt weight lookup",
        await db.from("attempts").select("counted_weight").eq("id", attemptId).single(),
      ) as { counted_weight: number | string };
      const row = check(
        "Counters lookup",
        await db.from("game_day_counters").select("passes, weighted_passes").eq("game_date", date).single(),
      ) as { passes: number; weighted_passes: number | string };
      const update = {
        passes: row.passes + 1,
        weighted_passes: dbNumber(row.weighted_passes, "weighted_passes") + dbNumber(attempt.counted_weight, "counted_weight"),
      };
      check("Counters update", await db.from("game_day_counters").update(update).eq("game_date", date));
    },
    log: (message) => console.log(message),
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
): Promise<void> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  assertLocalSupabaseUrl(url, "seed", "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing; copy it from `npx supabase status` into .env.local.");
  const args = parseSeedArgs(argv);
  await runSeed(args, Date.now().toString(36), supabaseSeedDeps(makeClient(url, serviceRoleKey)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.env, process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
