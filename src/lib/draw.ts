// The prize draw (T43): one ticket per drawable entry, one winner per won cycle. The app draws the
// ticket with crypto.randomInt (passed in, so the choice is testable); the database checks the
// cycle may be drawn and stores the winner once. Server only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import type { EditState } from "@/lib/adminEdit";
import { dbInteger } from "@/lib/db/numeric";

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

export type DrawCycle = { number: number; startDate: string; endDate: string; goalReachedOn: string | null; drawnAt: string | null };

/** Whether a cycle may be drawn on `today` (a game date): won, ended and not drawn yet. */
export function canDraw(cycle: Pick<DrawCycle, "endDate" | "goalReachedOn" | "drawnAt">, today: string): boolean {
  return cycle.goalReachedOn !== null && cycle.endDate < today && cycle.drawnAt === null;
}

/** Every cycle, newest first. */
export async function readDrawCycles(db: Pick<SupabaseClient, "from">): Promise<DrawCycle[]> {
  const { data, error } = await db
    .from("cycles_public")
    .select("number, start_date, end_date, goal_reached_on, drawn_at")
    .order("number", { ascending: false });
  if (error) throw new Error(`Cycle lookup failed: ${error.message}`);
  type Row = { number: unknown; start_date: string; end_date: string; goal_reached_on: string | null; drawn_at: string | null };
  return (data as Row[]).map((row) => ({
    number: dbInteger(row.number, "number"),
    startDate: row.start_date,
    endDate: row.end_date,
    goalReachedOn: row.goal_reached_on,
    drawnAt: row.drawn_at,
  }));
}

const cycleSchema = z.coerce.number().int().positive();

const STATUS_MESSAGES: Record<string, (cycle: number) => string> = {
  "already-drawn": (cycle) => `Cycle ${cycle} already has a winner.`,
  "not-ready": (cycle) => `Cycle ${cycle} cannot be drawn yet.`,
  // A winner was flagged, or their entry removed, between listing the tickets and storing.
  "not-entered": () => "The entries changed while drawing. Draw again.",
};

/** Draws cycle `form.cycle` as the signed-in admin (their own client). */
export async function drawCycle(db: Pick<SupabaseClient, "rpc">, form: FormData, randomInt: (max: number) => number): Promise<EditState> {
  if (!(await isAdmin(db))) return { ok: false, message: "Only admins can draw a winner." };
  const parsed = cycleSchema.safeParse(form.get("cycle") || undefined);
  if (!parsed.success) return { ok: false, message: "Unknown cycle." };
  const cycle = parsed.data;

  const tickets = await db.rpc("admin_draw_tickets", { p_cycle: cycle });
  if (tickets.error) throw new Error(`Ticket lookup failed: ${tickets.error.message}`);
  const entries = (tickets.data as { user_id: string; tickets: unknown }[]).map((row) => ({
    userId: row.user_id,
    tickets: dbInteger(row.tickets, "tickets"),
  }));
  if (entries.length === 0) {
    return { ok: false, message: `Cycle ${cycle} cannot be drawn: it has not ended with the goal reached, or it has no entries left.` };
  }

  const winner = pickWinner(entries, randomInt);
  const recorded = await db.rpc("admin_record_winner", { p_cycle: cycle, p_user: winner });
  if (recorded.error) throw new Error(`Recording the winner failed: ${recorded.error.message}`);
  if (recorded.data === "drawn") return { ok: true, message: `Cycle ${cycle} drawn.` };
  return { ok: false, message: (STATUS_MESSAGES[recorded.data as string] ?? (() => `Unexpected answer: ${String(recorded.data)}`))(cycle) };
}
