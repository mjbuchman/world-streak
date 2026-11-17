// Saving an admin's edit to one game day: its three games in order, each game's pass target and
// the survival threshold (T99, T161). The database enforces the same rules (row-level security:
// admins only, open days only; triggers lock a started day's lineup, WS003, and a started game's
// pass target, WS002); this gives clear messages first.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHALLENGE_TYPES, type ChallengeType } from "@/challenges/shared/types";
import { CHALLENGE_NAMES } from "@/config/challenges";
import { isAdmin } from "@/lib/admin";
import { inTowerRange, numberField as number, refuse, towerRowMessage, type EditState } from "@/lib/adminForm";
import { dayLabel } from "@/lib/streak/streak";

export type { EditState } from "@/lib/adminForm";

/** The database's refusal to move a started game's pass target (T102, T161). */
const TARGET_LOCKED = "WS002";
/** The database's refusal to change a started day's games (T111, T161). */
const LINEUP_LOCKED = "WS003";

const POSITIONS = [1, 2, 3] as const;

const game = z.enum(CHALLENGE_TYPES, "Unknown game.");
const target = (n: number) => number(`Pass target for game ${n}`).pipe(z.number().min(0, `Pass target for game ${n} cannot be negative.`));

const editSchema = z.object({
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Unknown game day."),
  games: z.tuple([game, game, game]).refine((games) => new Set(games).size === 3, "Pick three different games."),
  targets: z.tuple([target(1), target(2), target(3)]),
  thresholdPercent: number("Survival threshold").pipe(
    z.number().min(0, "Survival threshold must be from 0% to 100%.").max(100, "Survival threshold must be from 0% to 100%."),
  ),
});

const lineupSchema = z
  .array(z.object({ position: z.number(), challenge_type: z.enum(CHALLENGE_TYPES), pass_target: z.coerce.number() }))
  .length(3);

/**
 * Checks and saves an edit from the admin form. `db` is the caller's own (cookie) client, so the
 * save runs under their row-level security rather than the service role.
 */
export async function saveGameDayEdit(db: Pick<SupabaseClient, "from" | "rpc">, form: FormData): Promise<EditState> {
  if (!(await isAdmin(db))) return refuse("Only admins can edit game days.");

  const parsed = editSchema.safeParse({
    gameDate: form.get("gameDate") ?? "",
    games: POSITIONS.map((n) => form.get(`game${n}`) ?? ""),
    targets: POSITIONS.map((n) => form.get(`target${n}`) ?? ""),
    thresholdPercent: form.get("thresholdPercent") ?? "",
  });
  if (!parsed.success) return refuse(parsed.error.issues[0].message);
  const { gameDate, games, targets, thresholdPercent } = parsed.data;
  const label = dayLabel(gameDate);

  // Read first only for clear messages (closed, or the Tower's range); the save's own open-day
  // filter and row-level security are what actually guard the write.
  const day = await db
    .from("game_days")
    .select("closed_at, game_day_games(position, challenge_type, pass_target)")
    .eq("game_date", gameDate)
    .maybeSingle();
  if (day.error) throw new Error(`Game day lookup failed: ${day.error.message}`);
  if (!day.data) return refuse("Unknown game day.");
  if (day.data.closed_at !== null) return refuse(`${label} has closed, so it can no longer change.`);
  const lineup = lineupSchema.parse(day.data.game_day_games).sort((a, b) => a.position - b.position);

  // A slot whose game changed but whose target was left as it was takes the new game's default
  // target in the database (T111), so there is no typed target to check.
  const takesDefault = lineup.map((slot, i) => games[i] !== slot.challenge_type && targets[i] === slot.pass_target);
  const offBoard = games.findIndex((type, i) => type === "stacking" && !takesDefault[i] && !inTowerRange(targets[i]));
  if (offBoard !== -1) return refuse(towerRowMessage(`Game ${offBoard + 1}'s pass target`));

  const saved = await db.rpc("save_game_day", { d: gameDate, games, targets, threshold: thresholdPercent / 100 });
  if (saved.error?.code === LINEUP_LOCKED) return refuse(`${label} has started, so its games can no longer change.`);
  if (saved.error?.code === TARGET_LOCKED) {
    return refuse(`A game on ${label} has started, so its pass target can no longer change. The rest still can.`);
  }
  if (saved.error) throw new Error(`Saving the game day failed: ${saved.error.message}`);
  // False: it closed between the check above and the save.
  if (saved.data !== true) return refuse(`${label} has closed, so it can no longer change.`);
  return { ok: true, message: savedMessage(label, lineup.map((slot) => slot.challenge_type), games, takesDefault) };
}

function savedMessage(label: string, before: ChallengeType[], after: ChallengeType[], takesDefault: boolean[]): string {
  if (after.every((type, i) => type === before[i])) return `Saved ${label}.`;
  const names = after.map((type) => CHALLENGE_NAMES[type]).join(", ");
  const defaults = takesDefault.some(Boolean) ? " A changed game with its old target left as it was takes its default pass target." : "";
  return `Saved ${label}. Its games are now ${names}.${defaults}`;
}
