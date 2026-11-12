/**
 * Creates a batch of fake players with submitted attempts on the LOCAL database, so the meter
 * has something to show: `npm run seed:dev -- --players 200 --pass-rate 0.7 [--date YYYY-MM-DD]`.
 * The admin page's local tools do the same (T117); the shared code is `src/lib/devData.ts`.
 *
 * It reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (the npm script
 * loads it) and refuses to run unless the URL is localhost, because it creates accounts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { passingIndices, runSeed, supabaseSeedDeps, type SeedArgs, type SeedDeps } from "../src/lib/devData.ts";
import { isCalendarDate } from "./lib/dates.mts";
import { assertLocalSupabaseUrl, createServiceClient } from "./lib/localSupabase.mts";

export { passingIndices, runSeed, supabaseSeedDeps, type SeedArgs, type SeedDeps };

/** At most this many players per run, so a typo cannot create a million accounts. */
const MAX_PLAYERS = 10_000;

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
