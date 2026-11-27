// supabase/tests/lineups.test.sql re-runs the T241 pool update on pools the migration must leave
// alone or extend (pgTAP cannot run a migration file). This keeps that copy the same statement.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION = "supabase/migrations/20261128000000_confusing_colors_pool.sql";
const PGTAP = "supabase/tests/lineups.test.sql";
// The update that appends `ink`, from `update` to its semicolon.
const POOL_UPDATE = /update public\.game_settings set pool = pool \|\| '\{ink\}'[^;]*;/;

function poolUpdate(file: string): string {
  const match = readFileSync(file, "utf8").match(POOL_UPDATE);
  if (!match) throw new Error(`${file} has no ink pool update`);
  return match[0].replace(/\s+/g, " ");
}

describe("the T241 pool update", () => {
  it("is the same statement in the migration and in the pgTAP test", () => {
    expect(poolUpdate(PGTAP)).toBe(poolUpdate(MIGRATION));
  });

  it("only extends the five-game launch pool that lacks ink", () => {
    expect(poolUpdate(MIGRATION)).toContain("where not 'ink' = any(pool) and pool @> '{stacking,inner-clock,flash-count,echo-path,fair-split}' and cardinality(pool) = 5;");
  });
});
