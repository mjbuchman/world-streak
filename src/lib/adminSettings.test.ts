import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { readSettingsForm, saveGameSettings, SETTINGS_FIELDS } from "./adminSettings";

type Result = { data: unknown; error: { message: string } | null };

/** A client whose calls answer `results` in order, recording each call and its builder steps. */
function fakeDb(results: Result[]) {
  const calls: unknown[][][] = [];
  const start = (first: unknown[]) => {
    const log: unknown[][] = [first];
    calls.push(log);
    const result = results.shift();
    const query: object = new Proxy(
      {},
      {
        get(_, method) {
          if (method === "then") return (resolve: (value: unknown) => void) => resolve(result);
          return (...args: unknown[]) => {
            log.push([method, ...args]);
            return query;
          };
        },
      },
    );
    return query;
  };
  const db = { from: (table: string) => start(["from", table]), rpc: (name: string) => start(["rpc", name]) };
  return { db: db as unknown as SupabaseClient, calls };
}

const ADMIN: Result = { data: true, error: null };

const VALID: Record<string, string> = {
  default_survival_threshold: "0.6",
  pass_target_percentile: "0.8",
  pass_target_streak_step: "0",
  threshold_streak_step: "0.01",
  percentile_lookback_days: "14",
  percentile_min_sample: "50",
  new_account_weight: "1",
  full_weight_after_days: "0",
  "target-stacking": "10",
  "target-inner-clock": "0.5",
  "target-flash-count": "15",
  rotation: "stacking, inner-clock, flash-count",
};

const form = (over: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...VALID, ...over })) data.set(name, value);
  return data;
};

describe("saveGameSettings", () => {
  it("saves every field, with the pass targets as one object and the rotation as a list", async () => {
    const { db, calls } = fakeDb([ADMIN, { data: [{ id: true }], error: null }]);
    expect(await saveGameSettings(db, form())).toEqual({ ok: true, message: "Settings saved." });
    expect(calls[1]).toEqual([
      ["from", "game_settings"],
      [
        "update",
        {
          default_survival_threshold: 0.6,
          pass_target_percentile: 0.8,
          pass_target_streak_step: 0,
          threshold_streak_step: 0.01,
          percentile_lookback_days: 14,
          percentile_min_sample: 50,
          new_account_weight: 1,
          full_weight_after_days: 0,
          default_pass_targets: { stacking: 10, "inner-clock": 0.5, "flash-count": 15 },
          rotation: ["stacking", "inner-clock", "flash-count"],
        },
      ],
      ["eq", "id", true],
      ["select", "id"],
    ]);
  });

  it("refuses anyone who is not an admin, before validating or writing", async () => {
    const { db, calls } = fakeDb([{ data: false, error: null }]);
    expect(await saveGameSettings(db, form({ default_survival_threshold: "lots" }))).toEqual({
      ok: false,
      message: "Only admins can change the settings.",
    });
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["a threshold above 1", { default_survival_threshold: "1.2" }, "Survival threshold must be from 0 to 1."],
    ["a threshold that is not a number", { default_survival_threshold: "high" }, "Survival threshold must be a number."],
    ["a percentile below 0.5", { pass_target_percentile: "0.4" }, "Pass target percentile must be from 0.5 to 0.99."],
    ["a percentile above 0.99", { pass_target_percentile: "1" }, "Pass target percentile must be from 0.5 to 0.99."],
    ["a negative target step", { pass_target_streak_step: "-1" }, "Pass target step must be 0 or more."],
    ["a threshold step above 1", { threshold_streak_step: "2" }, "Threshold step must be from 0 to 1."],
    ["a lookback of 0 days", { percentile_lookback_days: "0" }, "Lookback days must be a whole number from 1 to 365."],
    ["a fractional sample", { percentile_min_sample: "2.5" }, "Minimum sample must be a whole number, at least 1."],
    ["a weight above 1", { new_account_weight: "1.5" }, "New account weight must be from 0 to 1."],
    ["negative full-weight days", { full_weight_after_days: "-3" }, "Full weight after must be a whole number, 0 or more."],
    ["a missing field", { percentile_min_sample: "" }, "Minimum sample is required."],
    ["a negative pass target", { "target-flash-count": "-1" }, "Swift Sum's default pass target must be 0 or more."],
    ["a Tower target off the board", { "target-stacking": "16" }, "Teetering Tower's default pass target must be a row from 1 to 15."],
    ["an unknown challenge in the rotation", { rotation: "stacking, chess" }, 'The rotation can only name stacking, inner-clock, flash-count; "chess" is not one.'],
    ["an empty rotation", { rotation: " , " }, "The rotation needs at least one challenge."],
  ])("refuses %s, writing nothing", async (_name, over, message) => {
    const { db, calls } = fakeDb([ADMIN]);
    expect(await saveGameSettings(db, form(over))).toEqual({ ok: false, message });
    expect(calls).toHaveLength(1);
  });

  it("accepts the edges of each range", async () => {
    const { db } = fakeDb([ADMIN, { data: [{ id: true }], error: null }]);
    const edges = {
      default_survival_threshold: "0",
      pass_target_percentile: "0.99",
      threshold_streak_step: "1",
      percentile_lookback_days: "365",
      percentile_min_sample: "1",
      new_account_weight: "0",
      "target-stacking": "1",
      rotation: "flash-count",
    };
    expect(await saveGameSettings(db, form(edges))).toEqual({ ok: true, message: "Settings saved." });
  });

  it("says so when the update changed no row (the policy refused it), and throws on a database error", async () => {
    expect(await saveGameSettings(fakeDb([ADMIN, { data: [], error: null }]).db, form())).toEqual({
      ok: false,
      message: "The settings were not saved. Reload the page and try again.",
    });
    await expect(saveGameSettings(fakeDb([ADMIN, { data: null, error: { message: "down" } }]).db, form())).rejects.toThrow(
      "Saving the settings failed: down",
    );
  });
});

describe("readSettingsForm", () => {
  it("reads the row as the form's starting values", async () => {
    const row = {
      default_survival_threshold: "0.60",
      pass_target_percentile: 0.8,
      pass_target_streak_step: 0,
      threshold_streak_step: "0.01",
      percentile_lookback_days: 14,
      percentile_min_sample: 50,
      default_pass_targets: { stacking: 10, "inner-clock": 0.5, "flash-count": 15 },
      new_account_weight: 1,
      full_weight_after_days: 0,
      rotation: ["stacking", "inner-clock", "flash-count"],
    };
    const { db, calls } = fakeDb([{ data: row, error: null }]);
    expect(await readSettingsForm(db)).toEqual(VALID);
    expect(calls[0]).toEqual([["from", "game_settings"], ["select", "*"], ["single"]]);
  });

  it("leaves a challenge without a default target blank, and throws on a failed read", async () => {
    const row = {
      default_survival_threshold: 0.6,
      pass_target_percentile: 0.8,
      pass_target_streak_step: 0,
      threshold_streak_step: 0,
      percentile_lookback_days: 14,
      percentile_min_sample: 50,
      default_pass_targets: { stacking: 10 },
      new_account_weight: 1,
      full_weight_after_days: 0,
      rotation: ["stacking"],
    };
    expect(await readSettingsForm(fakeDb([{ data: row, error: null }]).db)).toMatchObject({ "target-flash-count": "", rotation: "stacking" });
    await expect(readSettingsForm(fakeDb([{ data: null, error: { message: "down" } }]).db)).rejects.toThrow("game_settings lookup failed: down");
  });

  it("lists a label and a hint for every field", () => {
    expect(SETTINGS_FIELDS.map((field) => field.name)).toEqual([
      "default_survival_threshold",
      "pass_target_percentile",
      "pass_target_streak_step",
      "threshold_streak_step",
      "percentile_lookback_days",
      "percentile_min_sample",
      "new_account_weight",
      "full_weight_after_days",
    ]);
    for (const field of SETTINGS_FIELDS) expect(field.label && field.hint).toBeTruthy();
  });
});
