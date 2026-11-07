import { NextResponse } from "next/server";
import { checkDatabase } from "@/lib/health";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Public on purpose: a liveness probe for monitoring. It takes no input and reveals only
// whether the database answers, so it is exempt from the authentication requirement.
export async function GET() {
  const { status, body } = await checkDatabase(async () =>
    (await createSupabaseServerClient()).rpc("health_check"),
  );
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
