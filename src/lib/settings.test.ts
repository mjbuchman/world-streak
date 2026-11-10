import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadGameSettings, parseGameSettings, type GameSettings } from "./settings";

/** The launch row as PostgREST returns it. */
const launchRow = {
  id: true,
  default_survival_threshold: 0.6,
  pass_target_percentile: 0.8,
  pass_target_streak_step: 0,
  threshold_streak_step: 0,
  percentile_lookback_days: 14,
  percentile_min_sample: 50,
  default_pass_targets: { stacking: 10 },
  new_account_weight: 1,
  full_weight_after_days: 0,
};

const launchSettings: GameSettings = {
  defaultSurvivalThreshold: 0.6,
  passTargetPercentile: 0.8,
  passTargetStreakStep: 0,
  thresholdStreakStep: 0,
  percentileLookbackDays: 14,
  percentileMinSample: 50,
  defaultPassTargets: { stacking: 10 },
  newAccountWeight: 1,
  fullWeightAfterDays: 0,
};

describe("parseGameSettings", () => {
  it("turns the launch row into typed settings", () => {
    expect(parseGameSettings(launchRow)).toEqual(launchSettings);
  });

  it("accepts numeric columns sent as strings, as Postgres numerics can be", () => {
    const row = { ...launchRow, default_survival_threshold: "0.60", new_account_weight: "1.0", pass_target_streak_step: "0.5" };
    expect(parseGameSettings(row)).toEqual({ ...launchSettings, passTargetStreakStep: 0.5 });
  });

  it("accepts the edges of each range", () => {
    const row = {
      ...launchRow,
      default_survival_threshold: 0,
      pass_target_percentile: 1,
      new_account_weight: 0,
      percentile_lookback_days: 1,
      percentile_min_sample: 1,
      full_weight_after_days: 30,
      default_pass_targets: { stacking: 0, flashCount: 7.5 },
    };
    expect(parseGameSettings(row)).toMatchObject({
      defaultSurvivalThreshold: 0,
      passTargetPercentile: 1,
      newAccountWeight: 0,
      percentileLookbackDays: 1,
      percentileMinSample: 1,
      fullWeightAfterDays: 30,
      defaultPassTargets: { stacking: 0, flashCount: 7.5 },
    });
  });

  it.each([
    ["a missing row", null],
    ["a missing column", { ...launchRow, pass_target_percentile: undefined }],
    ["a null column", { ...launchRow, default_survival_threshold: null }],
    ["a threshold above 1", { ...launchRow, default_survival_threshold: 1.5 }],
    ["a negative percentile", { ...launchRow, pass_target_percentile: -0.1 }],
    ["a negative pass-target step", { ...launchRow, pass_target_streak_step: -1 }],
    ["a negative threshold step", { ...launchRow, threshold_streak_step: -0.01 }],
    ["a zero-day lookback", { ...launchRow, percentile_lookback_days: 0 }],
    ["a fractional lookback", { ...launchRow, percentile_lookback_days: 1.5 }],
    ["a zero minimum sample", { ...launchRow, percentile_min_sample: 0 }],
    ["a new-account weight above 1", { ...launchRow, new_account_weight: 1.1 }],
    ["a negative full-weight wait", { ...launchRow, full_weight_after_days: -1 }],
    ["a non-numeric string", { ...launchRow, new_account_weight: "lots" }],
    ["an empty string", { ...launchRow, new_account_weight: "" }],
    ["pass targets as an array", { ...launchRow, default_pass_targets: [10] }],
    ["a pass target that is not a number", { ...launchRow, default_pass_targets: { stacking: "ten" } }],
    ["a negative pass target", { ...launchRow, default_pass_targets: { stacking: -1 } }],
  ])("refuses %s", (_, row) => {
    expect(() => parseGameSettings(row)).toThrow(/game_settings/);
  });
});

type Result = { data: unknown; error: { message: string } | null };

/** Records the query and resolves it to `result`, like the Supabase query builder. */
function fakeDb(result: Result) {
  const calls: unknown[][] = [];
  const query: object = new Proxy(
    {},
    {
      get(_, method) {
        if (method === "then") return (resolve: (value: Result) => void) => resolve(result);
        return (...args: unknown[]) => {
          calls.push([method, ...args]);
          return query;
        };
      },
    },
  );
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe("loadGameSettings", () => {
  it("reads the single settings row", async () => {
    const { db, calls } = fakeDb({ data: launchRow, error: null });
    expect(await loadGameSettings(db)).toEqual(launchSettings);
    expect(calls).toEqual([["from", "game_settings"], ["select", "*"], ["single"]]);
  });

  it("throws when the query fails", async () => {
    const { db } = fakeDb({ data: null, error: { message: "connection refused" } });
    await expect(loadGameSettings(db)).rejects.toThrow("game_settings lookup failed: connection refused");
  });

  it("throws when the row is invalid", async () => {
    const { db } = fakeDb({ data: { ...launchRow, default_survival_threshold: 2 }, error: null });
    await expect(loadGameSettings(db)).rejects.toThrow(/game_settings/);
  });
});
