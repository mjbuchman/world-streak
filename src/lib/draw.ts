// The prize draw (T43): one ticket per drawable entry, one winner per won cycle. The app draws the
// ticket with crypto.randomInt (passed in, so the choice is testable); the database checks the
// cycle may be drawn and stores the winner once. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { PAYOUT_WITHIN_DAYS } from "@/config/prize";
import { isAdmin } from "@/lib/admin";
import { refuse, type EditState } from "@/lib/adminForm";
import { dbInteger } from "@/lib/db/numeric";
import { addDays } from "@/lib/gameDay";
import type { Database } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/** The player holding ticket `randomInt(total)`, counting tickets in the order given. */
export function pickWinner(entries: readonly { userId: string; tickets: number }[], randomInt: (max: number) => number): string {
  const total = entries.reduce((sum, entry) => sum + entry.tickets, 0);
  if (total <= 0) throw new Error("No tickets to draw from");
  const drawn = randomInt(total);
  let ticket = drawn;
  for (const entry of entries) {
    if (ticket < entry.tickets) return entry.userId;
    ticket -= entry.tickets;
  }
  throw new Error(`Ticket ${drawn} is out of range`);
}

export type DrawCycle = {
  number: number;
  startDate: string;
  endDate: string;
  goalReachedOn: string | null;
  drawnAt: string | null;
  paidOn: string | null;
};

/** Whether a cycle may be drawn on `today` (a game date): won, ended and not drawn yet. */
export function canDraw(cycle: Pick<DrawCycle, "endDate" | "goalReachedOn" | "drawnAt">, today: string): boolean {
  return cycle.goalReachedOn !== null && cycle.endDate < today && cycle.drawnAt === null;
}

/** Every cycle, newest first. */
export async function readDrawCycles(db: Pick<Db, "from">): Promise<DrawCycle[]> {
  const { data, error } = await db
    .from("cycles_public")
    .select("number, start_date, end_date, goal_reached_on, drawn_at, paid_on")
    .order("number", { ascending: false });
  if (error) throw new Error(`Cycle lookup failed: ${error.message}`);
  return data.map((row) => ({
    number: dbInteger(row.number, "number"),
    startDate: row.start_date,
    endDate: row.end_date,
    goalReachedOn: row.goal_reached_on,
    drawnAt: row.drawn_at,
    paidOn: row.paid_on,
  }));
}

/** The winner must be paid by this game date (DESIGN.md: within 45 days of the cycle ending). */
export const payoutDeadline = (endDate: string) => addDays(endDate, PAYOUT_WITHIN_DAYS);

export type Winner = { email: string; verified: boolean };

/** Each drawn cycle's winner, by cycle number (admins only; the database checks). */
export async function readWinners(db: Pick<Db, "rpc">): Promise<Map<number, Winner>> {
  const { data, error } = await db.rpc("admin_cycle_winners");
  if (error) throw new Error(`Winner lookup failed: ${error.message}`);
  return new Map(
    data.map((row) => [
      dbInteger(row.cycle_number, "cycle_number"),
      // An account need not have an email (auth allows phone sign-in); keep the row readable.
      { email: row.email ?? "(no email)", verified: row.email_verified },
    ]),
  );
}

const PAID_MESSAGES: Record<string, (cycle: number) => string> = {
  "not-drawn": (cycle) => `Cycle ${cycle} has no winner yet.`,
  "already-paid": (cycle) => `Cycle ${cycle} is already marked paid.`,
};

/** Marks cycle `form.cycle`'s prize paid today, as the signed-in admin. */
export async function markPaid(db: Pick<Db, "rpc">, form: FormData): Promise<EditState> {
  if (!(await isAdmin(db))) return refuse("Only admins can mark a prize paid.");
  const parsed = cycleSchema.safeParse(form.get("cycle") || undefined);
  if (!parsed.success) return refuse("Unknown cycle.");
  const cycle = parsed.data;
  const { data, error } = await db.rpc("admin_mark_paid", { p_cycle: cycle });
  if (error) throw new Error(`Marking the prize paid failed: ${error.message}`);
  if (data === "paid") return { ok: true, message: `Cycle ${cycle} marked paid.` };
  return refuse((PAID_MESSAGES[data] ?? (() => `Unexpected answer: ${String(data)}`))(cycle));
}

const cycleSchema = z.coerce.number().int().positive();

const STATUS_MESSAGES: Record<string, (cycle: number) => string> = {
  "already-drawn": (cycle) => `Cycle ${cycle} already has a winner.`,
  "not-ready": (cycle) => `Cycle ${cycle} cannot be drawn yet.`,
  // A winner was flagged, or their entry removed, between listing the tickets and storing.
  "not-entered": () => "The entries changed while drawing. Draw again.",
};

/** Draws cycle `form.cycle` as the signed-in admin (their own client). */
export async function drawCycle(db: Pick<Db, "rpc">, form: FormData, randomInt: (max: number) => number): Promise<EditState> {
  if (!(await isAdmin(db))) return refuse("Only admins can draw a winner.");
  const parsed = cycleSchema.safeParse(form.get("cycle") || undefined);
  if (!parsed.success) return refuse("Unknown cycle.");
  const cycle = parsed.data;

  const tickets = await db.rpc("admin_draw_tickets", { p_cycle: cycle });
  if (tickets.error) throw new Error(`Ticket lookup failed: ${tickets.error.message}`);
  const entries = tickets.data.map((row) => ({
    userId: row.user_id,
    tickets: dbInteger(row.tickets, "tickets"),
  }));
  if (entries.length === 0) {
    return refuse(`Cycle ${cycle} cannot be drawn: it has not ended with the goal reached, or it has no entries left.`);
  }

  const winner = pickWinner(entries, randomInt);
  const recorded = await db.rpc("admin_record_winner", { p_cycle: cycle, p_user: winner });
  if (recorded.error) throw new Error(`Recording the winner failed: ${recorded.error.message}`);
  if (recorded.data === "drawn") return { ok: true, message: `Cycle ${cycle} drawn.` };
  return refuse((STATUS_MESSAGES[recorded.data] ??(() => `Unexpected answer: ${String(recorded.data)}`))(cycle));
}
