/**
 * Closes one game day on the LOCAL database for play-testing, as the scheduled job would:
 * `npm run close-day -- --date YYYY-MM-DD`. Prints the day's outcome and the world streak.
 * The admin page's local tools do the same (T117); the shared code is `src/lib/devData.ts`.
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (the npm script
 * loads it) and refuses to run unless the URL is localhost, because closing a day is final.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { runCloseDay, supabaseCloseDayDeps, type CloseDayDeps } from "../src/lib/devData.ts";
import { isCalendarDate } from "./lib/dates.mts";
import { assertLocalSupabaseUrl, createServiceClient } from "./lib/localSupabase.mts";

export { runCloseDay, supabaseCloseDayDeps, type CloseDayDeps };

/** Reads `--date YYYY-MM-DD`; throws a one-line message on bad input. */
export function parseCloseDayArgs(argv: string[]): string {
  const { values } = parseArgs({ args: argv, strict: true, options: { date: { type: "string" } } });
  if (values.date === undefined || !isCalendarDate(values.date)) throw new Error("--date must be a real date as YYYY-MM-DD.");
  return values.date;
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
