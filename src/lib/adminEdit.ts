// Saving an admin's edit to one game day (T99). The database enforces the same rules (row-level
// security: admins only, open days only, the editable columns only; triggers lock a started day's
// pass target, T102, and challenge, T111); this gives clear messages first.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHALLENGE_TYPES } from "@/challenges/shared/types";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { isAdmin } from "@/lib/admin";
import { dayLabel } from "@/lib/streak/streak";

/** The Tower's board has 15 rows: a target outside 1-15 would be drawn off the grid (T77). */
export const STACKING_TARGET_RANGE = { min: 1, max: 15 } as const;

export type EditState = { ok: boolean; message: string };

/** The database's refusal to move a started day's pass target (T102). */
const TARGET_LOCKED = "WS002";
/** The database's refusal to change a started day's challenge (T111). */
const CHALLENGE_LOCKED = "WS003";

const number = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform(Number)
    .pipe(z.number({ message: `${label} must be a number.` }).finite(`${label} must be a number.`));

const editSchema = z.object({
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Unknown game day."),
  // Absent on a started day (its challenge is locked). The database's foreign key to
  // challenge_types refuses anything else too.
  challengeType: z.enum(CHALLENGE_TYPES, "Unknown challenge.").optional(),
  passTarget: number("Pass target").pipe(z.number().min(0, "Pass target cannot be negative.")),
  thresholdPercent: number("Survival threshold").pipe(
    z.number().min(0, "Survival threshold must be from 0% to 100%.").max(100, "Survival threshold must be from 0% to 100%."),
  ),
});

const refuse = (message: string): EditState => ({ ok: false, message });

/**
 * Checks and saves an edit from the admin form. `db` is the caller's own (cookie) client, so the
 * update runs under their row-level security rather than the service role.
 */
export async function saveGameDayEdit(db: Pick<SupabaseClient, "from" | "rpc">, form: FormData): Promise<EditState> {
  if (!(await isAdmin(db))) return refuse("Only admins can edit game days.");

  const parsed = editSchema.safeParse({
    gameDate: form.get("gameDate") ?? "",
    challengeType: form.get("challengeType") ?? undefined,
    passTarget: form.get("passTarget") ?? "",
    thresholdPercent: form.get("thresholdPercent") ?? "",
  });
  if (!parsed.success) return refuse(parsed.error.issues[0].message);
  const { gameDate, challengeType, passTarget, thresholdPercent } = parsed.data;

  // Read first only for clear messages (closed, or the Tower's range); the update's own
  // `closed_at is null` filter and row-level security are what actually guard the write.
  const day = await db.from("game_days").select("challenge_type, closed_at, pass_target").eq("game_date", gameDate).maybeSingle();
  if (day.error) throw new Error(`Game day lookup failed: ${day.error.message}`);
  if (!day.data) return refuse("Unknown game day.");
  if (day.data.closed_at !== null) return refuse(`${dayLabel(gameDate)} has closed, so it can no longer change.`);

  const newType = challengeType !== undefined && challengeType !== day.data.challenge_type ? challengeType : null;
  // With a new type and the old target left as it was, the database gives the day the new type's
  // default target (T111), so there is no typed target to check.
  const defaultTarget = newType !== null && passTarget === Number(day.data.pass_target);
  const { min, max } = STACKING_TARGET_RANGE;
  if ((newType ?? day.data.challenge_type) === "stacking" && !defaultTarget && (passTarget < min || passTarget > max)) {
    return refuse(`The Teetering Tower's pass target must be a row from ${min} to ${max}.`);
  }

  const saved = await db
    .from("game_days")
    .update({
      ...(newType !== null && { challenge_type: newType }),
      pass_target: passTarget,
      survival_threshold: thresholdPercent / 100,
      edited: true,
    })
    .eq("game_date", gameDate)
    .is("closed_at", null)
    .select("game_date");
  if (saved.error?.code === TARGET_LOCKED) {
    return refuse(`${dayLabel(gameDate)} has started, so its pass target can no longer change. The threshold still can.`);
  }
  if (saved.error?.code === CHALLENGE_LOCKED) {
    return refuse(`${dayLabel(gameDate)} has started, so its challenge can no longer change.`);
  }
  if (saved.error) throw new Error(`Saving the game day failed: ${saved.error.message}`);
  // No row: it closed between the check above and the save.
  if (saved.data.length === 0) return refuse(`${dayLabel(gameDate)} has closed, so it can no longer change.`);
  if (newType === null) return { ok: true, message: `Saved ${dayLabel(gameDate)}.` };
  const target = defaultTarget ? ", with that challenge's default pass target" : "";
  return { ok: true, message: `Saved ${dayLabel(gameDate)}. It is now ${CHALLENGE_NAMES[newType]}${target}.` };
}
