import { NextResponse } from "next/server";
import { withServerErrors } from "@/lib/http/route";
import { meterCacheSeconds } from "@/lib/meter";
import { readMeter } from "@/lib/meterRead";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/meter: today's pass rate against the survival threshold. Public on purpose (the
 * meter is for everyone) and read-only, so it needs no sign-in and takes no input. It reads the
 * server-only counters with the service role (no cookies, no session) and answers only what
 * the meter may show, so the answer is safe to cache at the edge for a short time. The proxy
 * skips this path, so no session refresh can add a cookie to a shared answer.
 */
export const GET = withServerErrors("Reading the meter failed", async () => {
  const now = new Date();
  const body = await readMeter(createSupabaseAdminClient(), now);
  const seconds = meterCacheSeconds(body, now);
  // In the last moments before a window change, nothing may be cached at all.
  const cacheControl = seconds > 0 ? `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}` : "no-store";
  return NextResponse.json(body, { headers: { "cache-control": cacheControl } });
});
