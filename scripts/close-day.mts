/**
 * Closes one game day on the LOCAL database for play-testing, as the scheduled job would:
 * `npm run close-day -- --date YYYY-MM-DD`. Prints the day's outcome and the world streak.
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (the npm script
 * loads it) and refuses to run unless the URL is localhost, because closing a day is final.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { dbInteger } from "../src/lib/db/numeric.ts";
import { isCalendarDate } from "./lib/dates.mts";
import { assertLocalSupabaseUrl, check, createServiceClient } from "./lib/localSupabase.mts";

/** Reads `--date YYYY-MM-DD`; throws a one-line message on bad input. */
export function parseCloseDayArgs(argv: string[]): string {
  const { values } = parseArgs({ args: argv, strict: true, options: { date: { type: "string" } } });
  if (values.date === undefined || !isCalendarDate(values.date)) throw new Error("--date must be a real date as YYYY-MM-DD.");
  return values.date;
}

export type CloseDayDeps = {
  closeDay(date: string): Promise<string>;
  worldStreak(): Promise<{ current: number; best: number }>;
};

/** Closes `date` and returns the line to print. */
export async function runCloseDay(date: string, deps: CloseDayDeps): Promise<string> {
  const outcome = await deps.closeDay(date);
  const streak = await deps.worldStreak();
  return `${date} ${outcome}. World streak: ${streak.current} (best ${streak.best}).`;
}

export function supabaseCloseDayDeps(db: SupabaseClient): CloseDayDeps {
  return {
    async closeDay(date) {
      const outcome = check("Close", await db.rpc("close_game_day", { d: date }));
      if (outcome !== "survived" && outcome !== "broken") throw new Error(`Unexpected outcome ${JSON.stringify(outcome)}`);
      return outcome;
    },
    async worldStreak() {
      const row = check("World streak lookup", await db.rpc("world_streak").single()) as { current: unknown; best: unknown };
      return { current: dbInteger(row.current, "current"), best: dbInteger(row.best, "best") };
    },
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
  assertLocalSupabaseUrl(url, "close a game day", "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing; copy it from `npx supabase status` into .env.local.");
  const date = parseCloseDayArgs(argv);
  log(await runCloseDay(date, supabaseCloseDayDeps(makeClient(url, serviceRoleKey))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.env, process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
