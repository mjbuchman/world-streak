// The admin settings editor (T42): reads the one game_settings row as form values and saves an
// admin's edit. The table's checks and the rotation trigger refuse bad values too; this gives
// clear messages first. Server only: the zod schemas must not ship to the browser.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHALLENGE_TYPES } from "@/challenges/shared/types";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { isAdmin } from "@/lib/admin";
import { STACKING_TARGET_RANGE, type EditState } from "@/lib/adminEdit";
import { parseGameSettings } from "@/lib/settings";

/** A trimmed, required number field, with messages naming the field. */
const number = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform(Number)
    .pipe(z.number({ message: `${label} must be a number.` }).finite(`${label} must be a number.`));

const between = (label: string, min: number, max: number) => {
  const message = `${label} must be from ${min} to ${max}.`;
  return number(label).pipe(z.number().min(min, message).max(max, message));
};
const atLeastZero = (label: string) => number(label).pipe(z.number().min(0, `${label} must be 0 or more.`));
/** Postgres `integer`'s largest value: beyond it the database refuses the row. */
const MAX_INTEGER = 2_147_483_647;
const wholeNumber = (label: string, min: number, message: string, max = MAX_INTEGER) =>
  number(label).pipe(z.number().int(message).min(min, message).max(max, message));

/** The scalar settings, in form order: column name, label, a hint for the admin, and its check. */
export const SETTINGS_FIELDS = [
  {
    name: "default_survival_threshold",
    label: "Survival threshold",
    hint: "Share of players who must pass for the streak to survive (0.6 = 60%).",
    schema: between("Survival threshold", 0, 1),
  },
  {
    name: "pass_target_percentile",
    label: "Pass target percentile",
    hint: "The pass target is the score this share of recent players reached (0.8 = 80%).",
    schema: between("Pass target percentile", 0.5, 0.99),
  },
  {
    name: "pass_target_streak_step",
    label: "Pass target step",
    hint: "How much harder the pass target gets per streak day.",
    schema: atLeastZero("Pass target step"),
  },
  {
    name: "threshold_streak_step",
    label: "Threshold step",
    hint: "How much the survival threshold rises per streak day (0.01 = 1 point).",
    schema: between("Threshold step", 0, 1),
  },
  {
    name: "percentile_lookback_days",
    label: "Lookback days",
    hint: "Days of recent scores the pass target is taken from.",
    schema: wholeNumber("Lookback days", 1, "Lookback days must be a whole number from 1 to 365.", 365),
  },
  {
    name: "percentile_min_sample",
    label: "Minimum sample",
    hint: "Fewer recent scores than this, and the challenge's default target is used.",
    schema: wholeNumber("Minimum sample", 1, "Minimum sample must be a whole number, at least 1."),
  },
  {
    name: "new_account_weight",
    label: "New account weight",
    hint: "How much a new account's attempt counts in the pass rate (1 = fully).",
    schema: between("New account weight", 0, 1),
  },
  {
    name: "full_weight_after_days",
    label: "Full weight after",
    hint: "Days until a new account counts fully.",
    schema: wholeNumber("Full weight after", 0, "Full weight after must be a whole number, 0 or more."),
  },
] as const;

export type SettingsForm = Record<string, string>;

const targetField = (type: string) => `target-${type}`;

function targetSchema(type: (typeof CHALLENGE_TYPES)[number]) {
  const label = `${CHALLENGE_NAMES[type]}'s default pass target`;
  if (type !== "stacking") return atLeastZero(label);
  const { min, max } = STACKING_TARGET_RANGE;
  const message = `${label} must be a row from ${min} to ${max}.`;
  return number(label).pipe(z.number().min(min, message).max(max, message));
}

const rotationSchema = z
  .string()
  .transform((text) => text.split(",").map((entry) => entry.trim()).filter(Boolean))
  .pipe(z.array(z.string()).min(1, "The rotation needs at least one challenge."))
  .superRefine((entries, ctx) => {
    const unknown = entries.find((entry) => !(CHALLENGE_TYPES as readonly string[]).includes(entry));
    if (unknown !== undefined) {
      ctx.addIssue({ code: "custom", message: `The rotation can only name ${CHALLENGE_TYPES.join(", ")}; "${unknown}" is not one.` });
    }
  });

const refuse = (message: string): EditState => ({ ok: false, message });

/** The first problem with a value, or its parsed value. */
function check<T>(schema: z.ZodType<T, string>, raw: FormDataEntryValue | null): { value: T } | { error: string } {
  const parsed = schema.safeParse(typeof raw === "string" ? raw : "");
  return parsed.success ? { value: parsed.data } : { error: parsed.error.issues[0].message };
}

/** Checks and saves the settings form as the caller (their own client, under row-level security). */
export async function saveGameSettings(db: Pick<SupabaseClient, "from" | "rpc">, form: FormData): Promise<EditState> {
  if (!(await isAdmin(db))) return refuse("Only admins can change the settings.");

  const update: Record<string, unknown> = {};
  for (const field of SETTINGS_FIELDS) {
    const result = check(field.schema, form.get(field.name));
    if ("error" in result) return refuse(result.error);
    update[field.name] = result.value;
  }
  const targets: Record<string, number> = {};
  for (const type of CHALLENGE_TYPES) {
    const result = check(targetSchema(type), form.get(targetField(type)));
    if ("error" in result) return refuse(result.error);
    targets[type] = result.value;
  }
  update.default_pass_targets = targets;
  const rotation = check(rotationSchema, form.get("rotation"));
  if ("error" in rotation) return refuse(rotation.error);
  update.rotation = rotation.value;

  const saved = await db.from("game_settings").update(update).eq("id", true).select("id");
  if (saved.error) throw new Error(`Saving the settings failed: ${saved.error.message}`);
  if (saved.data.length === 0) return refuse("The settings were not saved. Reload the page and try again.");
  return { ok: true, message: "Settings saved." };
}

/** The settings as the form's starting values. */
export async function readSettingsForm(db: Pick<SupabaseClient, "from">): Promise<SettingsForm> {
  const { data, error } = await db.from("game_settings").select("*").single();
  if (error) throw new Error(`game_settings lookup failed: ${error.message}`);
  const settings = parseGameSettings(data);
  const rotation = z.array(z.string()).parse((data as { rotation: unknown }).rotation);
  const values: SettingsForm = {
    default_survival_threshold: String(settings.defaultSurvivalThreshold),
    pass_target_percentile: String(settings.passTargetPercentile),
    pass_target_streak_step: String(settings.passTargetStreakStep),
    threshold_streak_step: String(settings.thresholdStreakStep),
    percentile_lookback_days: String(settings.percentileLookbackDays),
    percentile_min_sample: String(settings.percentileMinSample),
    new_account_weight: String(settings.newAccountWeight),
    full_weight_after_days: String(settings.fullWeightAfterDays),
  };
  for (const type of CHALLENGE_TYPES) values[targetField(type)] = String(settings.defaultPassTargets[type] ?? "");
  values.rotation = rotation.join(", ");
  return values;
}
