import { NextResponse } from "next/server";
import { METER_CACHE_SECONDS } from "@/config/meter";
import { withServerErrors } from "@/lib/http/route";
import { readMeter } from "@/lib/meter";
import { createSupabasePublicClient } from "@/lib/supabase/public";

/**
 * GET /api/meter: today's pass rate against the survival threshold. Public on purpose (the
 * meter is for everyone) and read-only, so it needs no sign-in and takes no input. Readings
 * are cached at the edge for a short time, so polling players cost one query per period.
 */
export const GET = withServerErrors("Reading the meter failed", async () => {
  const body = await readMeter(createSupabasePublicClient(), new Date());
  return NextResponse.json(body, {
    headers: { "cache-control": `public, s-maxage=${METER_CACHE_SECONDS}, stale-while-revalidate=${METER_CACHE_SECONDS}` },
  });
});
