/**
 * Prints the three `.env.local` lines for LOCAL Supabase: `npm run env:local`, then copy them into
 * `.env.local`. It reads `supabase status` the way `npm run test:e2e:local` does, never writes a
 * file, and refuses anything but a localhost URL (T70).
 */
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { type AppEnv, localSupabaseEnv, NOT_RUNNING, STATUS_COMMAND } from "./e2e-local.mts";

export function envLocalLines(env: AppEnv): string {
  return Object.entries(env)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n");
}

export type EnvLocalDeps = {
  /** Output of `supabase status`; throws when the CLI exits with an error (Supabase stopped). */
  readStatus: () => string;
  log: (text: string) => void;
  logError: (message: string) => void;
};

/** Returns the process exit code. Problems are one line, never a stack trace. */
export function runEnvLocal(deps: EnvLocalDeps): number {
  let statusOutput: string;
  try {
    statusOutput = deps.readStatus();
  } catch {
    deps.logError(NOT_RUNNING);
    return 1;
  }
  try {
    deps.log(envLocalLines(localSupabaseEnv(statusOutput, "print .env.local values")));
    return 0;
  } catch (error) {
    deps.logError((error as Error).message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runEnvLocal({
    readStatus: () => execSync(STATUS_COMMAND, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
    log: (text) => console.log(text),
    logError: (message) => console.error(message),
  });
}
