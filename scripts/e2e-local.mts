/**
 * Runs the Playwright suite against local Supabase: `npm run test:e2e:local [playwright args]`.
 *
 * It reads the local URL and keys from `supabase status` and passes them to Playwright (and so
 * to the app it starts), so no `.env.local` and no shell `export` step is needed.
 */
import { execSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const APP_VARIABLES = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;

type AppEnv = Record<(typeof APP_VARIABLES)[number], string>;

const STATUS_COMMAND =
  "npx supabase status -o env" +
  " --override-name api.url=NEXT_PUBLIC_SUPABASE_URL" +
  " --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY" +
  " --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY";

/** Picks the app's variables out of `supabase status -o env` output (with the overrides above). */
export function localSupabaseEnv(statusOutput: string): AppEnv {
  const values = new Map<string, string>();
  for (const line of statusOutput.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) values.set(match[1], match[2]);
  }

  const missing = APP_VARIABLES.filter((name) => !values.get(name));
  if (missing.length > 0) {
    throw new Error(`Local Supabase did not report ${missing.join(", ")}. Is it running? Try \`npx supabase start\`.`);
  }

  const env = Object.fromEntries(APP_VARIABLES.map((name) => [name, values.get(name)!])) as AppEnv;
  // The suite creates and deletes accounts, so it must never point at a real project.
  const { hostname } = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error(`Refusing to run e2e tests against ${hostname}; the Supabase URL must be localhost.`);
  }
  return env;
}

function main(): number {
  const statusOutput = execSync(STATUS_COMMAND, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const env = localSupabaseEnv(statusOutput);
  // A shell lets Windows find npx.cmd. The extra arguments are the caller's own Playwright flags.
  const command = ["npx playwright test", ...process.argv.slice(2)].join(" ");
  const run = spawnSync(command, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  return run.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
