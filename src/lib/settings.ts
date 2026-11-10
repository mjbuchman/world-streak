import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

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

// Postgres numerics may reach us as JSON numbers or as strings, depending on the driver.
const numeric = z.union([z.number(), z.string().trim().min(1).transform(Number)]).pipe(z.number().finite());
const fraction = numeric.pipe(z.number().min(0).max(1));
const nonNegative = numeric.pipe(z.number().min(0));

// Ranges mirror the table's check constraints, so a row the database accepts always parses.
const rowSchema = z.object({
  default_survival_threshold: fraction,
  pass_target_percentile: fraction,
  pass_target_streak_step: nonNegative,
  threshold_streak_step: nonNegative,
  percentile_lookback_days: z.number().int().min(1),
  percentile_min_sample: z.number().int().min(1),
  default_pass_targets: z.record(z.string(), z.number().finite().min(0)),
  new_account_weight: fraction,
  full_weight_after_days: z.number().int().min(0),
});

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
  const { data, error } = await db.from("game_settings").select("*").single();
  if (error) throw new Error(`game_settings lookup failed: ${error.message}`);
  return parseGameSettings(data);
}
