/**
 * Runs the Playwright suite against local Supabase: `npm run test:e2e:local [playwright args]`.
 *
 * It reads the local URL and keys from `supabase status` and passes them to Playwright (and so
 * to the app it starts), so no `.env.local` and no shell `export` step is needed.
 */
import { execSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { assertLocalSupabaseUrl } from "./lib/localSupabase.mts";

const APP_VARIABLES = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export type AppEnv = Record<(typeof APP_VARIABLES)[number], string>;

export const STATUS_COMMAND =
  "npx supabase status -o env" +
  " --override-name api.url=NEXT_PUBLIC_SUPABASE_URL" +
  " --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY" +
  " --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY";

export const NOT_RUNNING = "Local Supabase is not running. Start it with `npm run db:start`, then try again.";

/** Picks the app's variables out of `supabase status -o env` output (with the overrides above). */
export function localSupabaseEnv(statusOutput: string, purpose = "run e2e tests"): AppEnv {
  const values = new Map<string, string>();
  for (const line of statusOutput.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }

  const missing = APP_VARIABLES.filter((name) => !values.get(name));
  if (missing.length > 0) {
    throw new Error(`Local Supabase did not report ${missing.join(", ")}. ${NOT_RUNNING}`);
  }

  const env = Object.fromEntries(APP_VARIABLES.map((name) => [name, values.get(name)!])) as AppEnv;
  // The suite creates and deletes accounts, so it must never point at a real project.
  assertLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL, purpose, "the Supabase URL");
  return env;
}

export type E2eDeps = {
  /** Output of `supabase status`; throws when the CLI exits with an error (Supabase stopped). */
  readStatus: () => string;
  /** Runs Playwright with these arguments and extra environment, returning its exit code. */
  runPlaywright: (args: string[], env: AppEnv) => number;
  logError: (message: string) => void;
};

/**
 * The environment Playwright (and the app it starts) runs with: the local keys, plus its own
 * server on its own port and build folder, so it never reuses a dev server started with other
 * keys and never clashes with one running on port 3000.
 */
export function playwrightEnv<Base extends Record<string, string | undefined>>(base: Base, appEnv: AppEnv) {
  return { ...base, ...appEnv, E2E_FRESH_SERVER: "1", E2E_PORT: "3100", E2E_DIST_DIR: ".next-e2e" };
}

/** Returns the process exit code. Problems are reported as one line, never a stack trace. */
export function runE2e(args: string[], deps: E2eDeps): number {
  let statusOutput: string;
  try {
    statusOutput = deps.readStatus();
  } catch {
    deps.logError(NOT_RUNNING);
    return 1;
  }

  let env: AppEnv;
  try {
    env = localSupabaseEnv(statusOutput);
  } catch (error) {
    deps.logError((error as Error).message);
    return 1;
  }
  return deps.runPlaywright(args, env);
}

const realDeps: E2eDeps = {
  readStatus: () => execSync(STATUS_COMMAND, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
  runPlaywright: (args, env) => {
    // Run Playwright's CLI with this Node directly: no shell, so arguments arrive exactly as given.
    const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
    const run = spawnSync(process.execPath, [cli, "test", ...args], { stdio: "inherit", env: playwrightEnv(process.env, env) });
    return run.status ?? 1;
  },
  logError: (message) => console.error(message),
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runE2e(process.argv.slice(2), realDeps);
}
