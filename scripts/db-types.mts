/**
 * The database types, generated from the LOCAL schema (T65):
 *   npm run db:types         writes src/lib/supabase/database.types.ts
 *   npm run db:types:check   fails when the committed file is out of date with the migrations
 * Generating needs local Supabase running with every migration applied.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const TYPES_FILE = "src/lib/supabase/database.types.ts";

/** Git may check the file out with CRLF on Windows; only the content counts. */
export function sameTypes(committed: string, generated: string): boolean {
  const normalise = (text: string) => text.replace(/\r\n/g, "\n").trimEnd();
  return normalise(committed) === normalise(generated);
}

export type DbTypesDeps = {
  generate(): string;
  read(): string;
  write(text: string): void;
  log(line: string): void;
};

/** Returns the exit code. */
export function runDbTypes(mode: "write" | "check", deps: DbTypesDeps): number {
  const generated = deps.generate();
  if (mode === "write") {
    deps.write(generated.replace(/\r\n/g, "\n"));
    deps.log(`Wrote ${TYPES_FILE}.`);
    return 0;
  }
  if (sameTypes(deps.read(), generated)) return 0;
  deps.log(`${TYPES_FILE} is out of date with the migrations: run \`npm run db:types\` and commit it.`);
  return 1;
}

const fileDeps: DbTypesDeps = {
  generate: () => execSync("npx supabase gen types typescript", { encoding: "utf8" }),
  read: () => readFileSync(TYPES_FILE, "utf8"),
  write: (text) => writeFileSync(TYPES_FILE, text),
  log: (line) => console.log(line),
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runDbTypes(process.argv.includes("--check") ? "check" : "write", fileDeps);
}
