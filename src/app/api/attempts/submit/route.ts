import { NextResponse } from "next/server";
import { supabaseSubmitStore } from "@/lib/attempts/store";
import { submitAttempt } from "@/lib/attempts/submit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NO_STORE = { "cache-control": "no-store" };

/**
 * POST /api/attempts/submit with `{ attemptId, inputs }`: the server replays the engine on the
 * attempt's seed, decides pass or fail, and stores the result once. See `submitAttempt` for
 * every status it can answer.
 */
export async function POST(request: Request) {
  // getUser checks the session with the Auth server, so a forged cookie is rejected.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-body" }, { status: 400, headers: NO_STORE });
  }

  try {
    const result = await submitAttempt({
      userId: user.id,
      body,
      now: new Date(),
      store: supabaseSubmitStore(createSupabaseAdminClient()),
    });
    return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
  } catch (error) {
    console.error("Submitting an attempt failed", error);
    return NextResponse.json({ error: "server-error" }, { status: 500, headers: NO_STORE });
  }
}
