import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { numericSchema } from "@/lib/db/numeric";

/** Game-wide settings from the single `game_settings` row (see its migration for meanings). */
export type GameSettings = {
  defaultSurvivalThreshold: number;
  passTargetPercentile: number;
  passTargetStreakStep: number;
  thresholdStreakStep: number;
  percentileLookbackDays: number;
  percentileMinSample: number;
  /** Keyed by challenge type, for example `{ stacking: 10 }`. */
  defaultPassTargets: Record<string, number>;
  newAccountWeight: number;
  fullWeightAfterDays: number;
};

// Numeric columns take numbers or decimal strings (see numericSchema); integer columns always
// arrive as JSON numbers, so they take numbers only.
const fraction = numericSchema.pipe(z.number().min(0).max(1));
const nonNegative = numericSchema.pipe(z.number().min(0));

// Ranges mirror the table's check constraints, so a row the database accepts always parses.
const rowSchema = z.object({
  default_survival_threshold: fraction,
  pass_target_percentile: fraction,
  pass_target_streak_step: nonNegative,
  threshold_streak_step: nonNegative,
  percentile_lookback_days: z.number().int().min(1),
  percentile_min_sample: z.number().int().min(1),
  default_pass_targets: z
    .record(z.string(), z.number().finite().min(0))
    .refine((targets) => "stacking" in targets, "must include stacking"),
  new_account_weight: fraction,
  full_weight_after_days: z.number().int().min(0),
});

const SETTINGS_COLUMNS = Object.keys(rowSchema.shape).join(", ");

/** Parses a `game_settings` row; throws if it is missing or out of range. */
export function parseGameSettings(row: unknown): GameSettings {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) throw new Error(`Invalid game_settings row: ${z.prettifyError(parsed.error)}`);
  const r = parsed.data;
  return {
    defaultSurvivalThreshold: r.default_survival_threshold,
    passTargetPercentile: r.pass_target_percentile,
    passTargetStreakStep: r.pass_target_streak_step,
    thresholdStreakStep: r.threshold_streak_step,
    percentileLookbackDays: r.percentile_lookback_days,
    percentileMinSample: r.percentile_min_sample,
    defaultPassTargets: r.default_pass_targets,
    newAccountWeight: r.new_account_weight,
    fullWeightAfterDays: r.full_weight_after_days,
  };
}

/** Reads the game settings. Any client works: everyone may read them under RLS. */
export async function loadGameSettings(db: Pick<SupabaseClient, "from">): Promise<GameSettings> {
  // By name, not "*", so a new column is read only once the parser knows it (T89).
  const { data, error } = await db.from("game_settings").select(SETTINGS_COLUMNS).single();
  if (error) throw new Error(`game_settings lookup failed: ${error.message}`);
  return parseGameSettings(data);
}
