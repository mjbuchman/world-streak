import { NextResponse } from "next/server";
import { errorResponse, withServerErrors } from "@/lib/http/route";
import { meterCacheSeconds } from "@/lib/meter";
import { createMeterCache } from "@/lib/meterCache";
import { readMeter } from "@/lib/meterRead";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// One per server instance: a spike past the CDN still reads the database once per window (T48).
const cache = createMeterCache({ read: () => readMeter(createSupabaseAdminClient(), new Date()), now: () => new Date() });

/**
 * GET /api/meter: today's pass rate against the survival threshold. Public on purpose (the
 * meter is for everyone) and read-only, so it needs no sign-in and takes no input. It reads the
 * server-only counters with the service role (no cookies, no session) and answers only what
 * the meter may show, so the answer is safe to cache at the edge for a short time. The proxy
 * skips this path, so no session refresh can add a cookie to a shared answer.
 *
 * While the database fails, it answers the last good reading with `stale: true` (never cached)
 * for a few minutes, then 503.
 */
export const GET = withServerErrors("Reading the meter failed", async () => {
  const answer = await cache.get();
  if (!answer) return errorResponse(503, "unavailable");
  if (answer.stale) return NextResponse.json({ ...answer.body, stale: true }, { headers: { "cache-control": "no-store" } });
  const seconds = meterCacheSeconds(answer.body, new Date());
  // In the last moments before a window change, nothing may be cached at all.
  const cacheControl = seconds > 0 ? `public, s-maxage=${seconds}, stale-while-revalidate=${seconds}` : "no-store";
  return NextResponse.json(answer.body, { headers: { "cache-control": cacheControl } });
});
